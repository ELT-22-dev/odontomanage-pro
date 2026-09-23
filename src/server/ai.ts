import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { queryOne } from './db'
import { HttpError } from './http'
import type { SessionUser } from '@/lib/types'

/*
 * Assistente de IA (Claude, da Anthropic).
 *
 * - A chave (ANTHROPIC_API_KEY) fica SO no servidor; o navegador nunca a ve.
 * - Desligado por padrao: precisa da chave configurada E do admin ligar em
 *   Configuracoes (clinic_settings.ai_enabled).
 * - Minimizacao de dados (LGPD): nao enviamos nome, CPF, telefone, email nem
 *   endereco do paciente — so o conteudo clinico necessario para a tarefa.
 * - A IA so SUGERE: nada e salvo sem o dentista revisar e clicar em salvar.
 * - Cada uso vai para a auditoria e ha limite por usuario (AI_HOURLY_LIMIT).
 */

export const AI_MODEL = 'claude-opus-5'
const AI_HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT || 40)

let client: Anthropic | null = null
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, 'IA nao configurada neste servidor (falta ANTHROPIC_API_KEY).')
  }
  // Timeout curto o bastante para a tela nao ficar pendurada; o SDK ja refaz
  // 2x em erro transitorio (429/5xx/rede).
  client ??= new Anthropic({ timeout: 55_000 })
  return client
}

export async function aiStatus() {
  const row = await queryOne<{ ai_enabled: boolean }>('select ai_enabled from clinic_settings where id = 1')
  return { configured: !!process.env.ANTHROPIC_API_KEY, enabled: !!row?.ai_enabled }
}

/** Barra o uso se a IA estiver desligada ou se o usuario passou do limite por hora. */
export async function assertAiAllowed(user: SessionUser) {
  const status = await aiStatus()
  if (!status.configured) throw new HttpError(503, 'IA nao configurada neste servidor (falta ANTHROPIC_API_KEY).')
  if (!status.enabled) throw new HttpError(403, 'O assistente de IA esta desligado. O administrador pode liga-lo em Configuracoes.')
  const used = await queryOne<{ n: number }>(
    `select count(*) as n from audit_log where user_id = $1 and action like 'ai_%' and created_at > now() - interval '1 hour'`,
    [user.id],
  )
  if ((used?.n ?? 0) >= AI_HOURLY_LIMIT) {
    throw new HttpError(429, `Limite de ${AI_HOURLY_LIMIT} usos da IA por hora atingido. Tente mais tarde.`)
  }
}

const SYSTEM_BASE = `Voce e um assistente de documentacao clinica de uma clinica odontologica no Brasil.
Escreva em portugues do Brasil, com terminologia odontologica correta e tom profissional.
Regras:
- Use somente informacoes presentes no material recebido. Nunca invente achados, dentes, medicamentos, doses ou datas.
- Nao faca diagnosticos novos nem recomendacoes clinicas por conta propria; organize e resuma o que o profissional registrou.
- Se uma informacao nao estiver no material, deixe o campo vazio (string vazia) ou diga que nao ha registro.
- O texto sera revisado por um cirurgiao-dentista antes de ser salvo.`

/** Traduz erros da API para mensagens em portugues (e status HTTP coerentes). */
function mapAiError(err: unknown): never {
  if (err instanceof HttpError) throw err
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error('[ai] chave invalida ou sem permissao', err.message)
    throw new HttpError(503, 'A chave da IA e invalida ou esta sem permissao. Avise o administrador.')
  }
  if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'A IA esta com muitos pedidos agora. Tente em alguns instantes.')
  if (err instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError(504, 'A IA demorou demais para responder. Tente novamente.')
  if (err instanceof Anthropic.APIError) {
    console.error('[ai] erro da API', err.status, err.message)
    throw new HttpError(502, 'A IA esta indisponivel no momento. Tente novamente.')
  }
  throw err
}

type ParsedResponse<T> = { stop_reason: string | null; parsed_output: T | null }

function unwrap<T>(response: ParsedResponse<T>): T {
  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'A IA nao conseguiu processar este conteudo. Preencha manualmente.')
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new HttpError(502, 'A resposta da IA veio incompleta. Tente com um texto menor.')
  }
  return response.parsed_output
}

// ── 1) Organizar anotacao livre em campos do prontuario ─────────────────────

export const StructuredNote = z.object({
  title: z.string().describe('Titulo curto do registro, ate 80 caracteres'),
  record_type: z.enum(['note', 'diagnosis', 'prescription', 'treatment']).describe(
    'note = evolucao/anamnese; diagnosis = diagnostico; prescription = receita; treatment = plano de tratamento. Escolha o predominante.',
  ),
  content: z.string().describe('Evolucao / anamnese: queixa, historico, procedimento realizado'),
  diagnosis: z.string().describe('Diagnostico registrado pelo profissional, ou vazio'),
  treatment_plan: z.string().describe('Plano de tratamento, ou vazio'),
  prescriptions: z.string().describe('Medicamentos com dose e posologia exatamente como escritos, ou vazio'),
})
export type StructuredNote = z.infer<typeof StructuredNote>

export async function structureNote(text: string): Promise<StructuredNote> {
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(StructuredNote) },
      system: `${SYSTEM_BASE}
Tarefa: reorganizar a anotacao livre (digitada ou ditada) do dentista nos campos do prontuario.
Corrija apenas ortografia e pontuacao; preserve numeracao de dentes (notacao FDI), faces, materiais e doses exatamente como escritos.`,
      messages: [{ role: 'user', content: `Anotacao do dentista:\n\n${text}` }],
    })
    return unwrap(response)
  } catch (err) {
    mapAiError(err)
  }
}

// ── 2) Resumo do historico do paciente ──────────────────────────────────────

export const PatientSummary = z.object({
  summary: z.string().describe('Resumo clinico em 3 a 6 frases'),
  alerts: z.array(z.string()).describe('Alertas importantes registrados (alergias, condicoes sistemicas, ansiedade, etc.); lista vazia se nao houver'),
  pending: z.array(z.string()).describe('Tratamentos em andamento ou pendentes segundo os registros; lista vazia se nao houver'),
  last_visit: z.string().describe('Data e motivo da ultima consulta realizada, ou vazio'),
})
export type PatientSummary = z.infer<typeof PatientSummary>

/** `context` ja vem sem dados identificadores (montado em /api/ai/patient-summary). */
export async function summarizePatient(context: string): Promise<PatientSummary> {
  try {
    const response = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(PatientSummary) },
      system: `${SYSTEM_BASE}
Tarefa: preparar um resumo rapido do historico do paciente para o dentista ler antes do atendimento.
Priorize o que muda a conduta: alertas de saude, tratamentos em andamento e o que foi feito por ultimo.`,
      messages: [{ role: 'user', content: context }],
    })
    return unwrap(response)
  } catch (err) {
    mapAiError(err)
  }
}
