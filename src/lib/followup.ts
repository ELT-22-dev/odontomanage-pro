/**
 * Follow-up: regras puras compartilhadas por API e telas (testadas em
 * followup.test.ts). Nada aqui acessa banco ou navegador.
 */
import type { FollowupKind } from './types'

export const FOLLOWUP_KIND: Record<FollowupKind, { label: string; className: string }> = {
  recall: { label: 'Retorno', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  post_procedure: { label: 'Pos-procedimento', className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  quote: { label: 'Orcamento', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  reactivation: { label: 'Reativar', className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
  other: { label: 'Outro', className: 'bg-muted text-muted-foreground border-border' },
}

export const FOLLOWUP_OUTCOME: Record<string, string> = {
  contacted: 'Conversou',
  scheduled: 'Agendou',
  no_answer: 'Nao respondeu',
  declined: 'Nao quer agora',
}

/**
 * Mensagens-modelo (a clinica pode trocar em Configuracoes → Follow-up).
 * Variaveis: {nome} primeiro nome, {clinica}, {motivo}, {data} data do
 * procedimento/consulta de origem (ou vazio).
 */
export const DEFAULT_TEMPLATES: Record<FollowupKind, string> = {
  post_procedure:
    'Ola {nome}! Aqui e da {clinica}. Passando para saber como voce esta depois do atendimento. Esta tudo bem, sentiu alguma dor ou incomodo? Qualquer coisa e so responder por aqui.',
  recall:
    'Ola {nome}! Aqui e da {clinica}. Ja esta na hora do seu retorno ({motivo}). Quer que a gente reserve um horario para voce? Me diga o melhor dia e periodo.',
  quote:
    'Ola {nome}! Aqui e da {clinica}. Ficou alguma duvida sobre o plano de tratamento que conversamos? Posso te ajudar a encontrar um horario para comecar.',
  reactivation:
    'Ola {nome}! Aqui e da {clinica}. Sentimos sua falta! Vamos marcar um novo horario para cuidar do seu sorriso? Me diga o melhor dia para voce.',
  other: 'Ola {nome}! Aqui e da {clinica}. {motivo}',
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** Preenche {nome}, {clinica}, {motivo}, {data}; variavel desconhecida fica como esta. */
export function renderTemplate(template: string, vars: { nome: string; clinica: string; motivo?: string; data?: string }): string {
  const map: Record<string, string> = { nome: vars.nome, clinica: vars.clinica, motivo: vars.motivo ?? '', data: vars.data ?? '' }
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in map ? map[key] : m)).replace(/\s{2,}/g, ' ').trim()
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** A regra vale para este procedimento? (trecho, sem acento e sem diferenciar maiusculas) */
export function ruleMatches(appointmentType: string, pattern: string): boolean {
  const p = normalize(pattern)
  return p.length > 0 && normalize(appointmentType).includes(p)
}

/** Follow-ups que fecham sozinhos quando o paciente agenda uma nova consulta. */
export const CLOSED_BY_NEW_APPOINTMENT: FollowupKind[] = ['recall', 'quote', 'reactivation']
