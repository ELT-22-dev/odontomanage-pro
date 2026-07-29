// Supabase Edge Function — proxy to the Claude API.
//
// This exists because the app itself is a static SPA with no backend (see
// CLAUDE.md): the Anthropic API key is a secret and can never ship in the
// browser bundle, so this function is the only place it's allowed to live.
// It never touches the database directly — the browser already fetched
// whatever clinic data it wants summarized (through Postgres RLS) and sends
// it in the request body; this function's only job is to hold the API key
// and relay the call to Claude.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy ai
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface ChatBody {
  action: 'chat'
  question: string
  context: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}

interface SummarizeBody {
  action: 'summarize'
  rawNotes: string
  patientName: string
  recordType: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Every request must carry the caller's Supabase session — this endpoint
  // is not open to the public internet, only to logged-in clinic staff.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Nao autenticado' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Nao autenticado' }, 401)

  try {
    const body = (await req.json()) as ChatBody | SummarizeBody

    if (body.action === 'chat') {
      const { question, context, history } = body
      if (!question?.trim()) return json({ error: 'Pergunta vazia' }, 400)

      const response = await anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: [
          'Voce e o assistente interno do OdontoManage Pro, sistema de gestao de uma clinica odontologica.',
          'Responda sempre em portugues, de forma direta e objetiva.',
          'Use SOMENTE os dados fornecidos abaixo (formato JSON) para responder perguntas sobre pacientes, agenda, financeiro e prontuarios.',
          'Se a informacao pedida nao estiver nos dados, diga claramente que nao tem essa informacao disponivel - nunca invente numeros, nomes ou datas.',
          'Voce ajuda com gestao da clinica (agenda, financeiro, cadastro de pacientes). Nao de diagnosticos, orientacoes de tratamento ou conselhos clinicos/medicos - se perguntarem isso, explique que essa decisao e do dentista.',
          '',
          'DADOS ATUAIS DA CLINICA:',
          context,
        ].join('\n'),
        messages: [
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: question },
        ],
      })

      const text = response.content.find((b) => b.type === 'text')
      return json({ answer: text?.type === 'text' ? text.text : '' })
    }

    if (body.action === 'summarize') {
      const { rawNotes, patientName, recordType } = body
      if (!rawNotes?.trim()) return json({ error: 'Nenhuma anotacao para resumir' }, 400)

      const response = await anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 1536,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Evolucao/anamnese reescrita de forma clara e organizada' },
                diagnosis: { type: 'string', description: 'Diagnostico, se mencionado nas anotacoes. Vazio se nao houver.' },
                treatment_plan: { type: 'string', description: 'Plano de tratamento, se mencionado. Vazio se nao houver.' },
                prescriptions: { type: 'string', description: 'Medicamentos/prescricoes, se mencionados. Vazio se nao houver.' },
              },
              required: ['content', 'diagnosis', 'treatment_plan', 'prescriptions'],
              additionalProperties: false,
            },
          },
        },
        system: [
          'Voce organiza anotacoes clinicas odontologicas em portugues, escritas as pressas pelo dentista durante o atendimento.',
          'A partir do texto bruto, produza uma versao limpa e estruturada, separando em: evolucao/anamnese, diagnostico, plano de tratamento e prescricoes.',
          'Nunca invente informacoes que nao estejam no texto original. Se um campo nao tiver informacao correspondente no texto, retorne string vazia para ele.',
          'Isto e apenas um RASCUNHO - o dentista vai revisar e editar antes de salvar no prontuario do paciente.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `Paciente: ${patientName || 'nao informado'}\nTipo de registro: ${recordType}\n\nAnotacoes brutas do dentista:\n${rawNotes}`,
          },
        ],
      })

      const block = response.content.find((b) => b.type === 'text')
      if (!block || block.type !== 'text') return json({ error: 'Resposta vazia da IA' }, 502)
      return json(JSON.parse(block.text))
    }

    return json({ error: 'Acao invalida' }, 400)
  } catch (err) {
    console.error('ai function error:', err)
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500)
  }
})
