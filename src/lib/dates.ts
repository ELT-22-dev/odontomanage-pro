/**
 * Datas do sistema. Regra: datas de calendario ("dia da consulta",
 * "vencimento") sao sempre strings 'AAAA-MM-DD', sem hora e sem fuso.
 *
 * "Hoje" e calculado no fuso da clinica (padrao America/Sao_Paulo), e nao em
 * UTC: `new Date().toISOString().slice(0, 10)` — usado na versao antiga —
 * vira o dia seguinte a partir das 21h no Brasil, e o servidor da Vercel roda
 * em UTC. Configuravel por NEXT_PUBLIC_TIMEZONE.
 */

export const CLINIC_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'America/Sao_Paulo'

/** Date → 'AAAA-MM-DD' no fuso informado. */
export function toISODate(date: Date, timeZone: string = CLINIC_TIMEZONE): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function todayISO(timeZone: string = CLINIC_TIMEZONE): string {
  return toISODate(new Date(), timeZone)
}

/** Aritmetica de dias sobre 'AAAA-MM-DD' (em UTC internamente — imune a horario de verao). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Dia da semana: 0 = domingo ... 6 = sabado. */
export function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

/** Segunda-feira da semana que contem `iso`. */
export function mondayOf(iso: string): string {
  const day = weekday(iso)
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

/** Os 7 dias (segunda a domingo) da semana de `iso`. */
export function weekOf(iso: string): string[] {
  const monday = mondayOf(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** Ultimo dia do mes de `iso` (valido para mandar ao banco — nada de "30 de fevereiro"). */
export function monthEnd(iso: string): string {
  return addDays(`${addMonths(iso.slice(0, 7), 1)}-01`, -1)
}

/** 'AAAA-MM' de n meses atras/a frente. */
export function addMonths(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return d.toISOString().slice(0, 7)
}

/** Formata 'AAAA-MM-DD' para exibicao em pt-BR (ex: 23/09/2026). */
export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return ''
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', ...opts })
}

/** Formata timestamp ISO (created_at etc.) com data e hora no fuso da clinica. */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('pt-BR', {
    timeZone: CLINIC_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Data (sem hora) de um timestamp ISO, no fuso da clinica. */
export function formatTimestampDate(ts: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('pt-BR', { timeZone: CLINIC_TIMEZONE, ...opts })
}

/** Idade em anos completos a partir de 'AAAA-MM-DD'. */
export function ageFrom(birthIso: string | null | undefined, today: string = todayISO()): number | null {
  if (!birthIso) return null
  const [by, bm, bd] = birthIso.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age >= 0 ? age : null
}
