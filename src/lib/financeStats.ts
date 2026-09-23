/**
 * Calculos do Financeiro, separados da tela para poderem ser testados
 * (financeStats.test.ts). Tudo trabalha com datas 'AAAA-MM-DD'.
 */
import type { Transaction } from './types'
import { addMonths, monthEnd, monthStart } from './dates'

export type Period = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all'

export const PERIOD_LABELS: Record<Period, string> = {
  'this-month': 'Este mes',
  'last-month': 'Mes passado',
  'last-3-months': 'Ultimos 3 meses',
  'this-year': 'Este ano',
  all: 'Tudo',
}

/**
 * Data que "conta" para a transacao: pagamento, senao vencimento, senao
 * cadastro. (A versao antiga filtrava so por data de cadastro, entao uma
 * mensalidade lancada hoje com vencimento no mes que vem caia no mes errado.)
 */
export function effectiveDate(t: Pick<Transaction, 'paid_date' | 'due_date' | 'created_at'>): string {
  return (t.paid_date || t.due_date || t.created_at).slice(0, 10)
}

/** Intervalo [start, end] inclusivo em 'AAAA-MM-DD', ou null para "tudo". */
export function getPeriodRange(period: Period, today: string): { start: string; end: string } | null {
  const ym = today.slice(0, 7)
  switch (period) {
    case 'this-month':
      return { start: monthStart(today), end: monthEnd(today) }
    case 'last-month': {
      const prev = addMonths(ym, -1)
      return { start: `${prev}-01`, end: monthEnd(`${prev}-01`) }
    }
    case 'last-3-months':
      return { start: `${addMonths(ym, -2)}-01`, end: monthEnd(today) }
    case 'this-year':
      return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` }
    case 'all':
      return null
  }
}

export function filterByPeriod<T extends Transaction>(transactions: T[], period: Period, today: string): T[] {
  const range = getPeriodRange(period, today)
  if (!range) return transactions
  return transactions.filter((t) => {
    const d = effectiveDate(t)
    return d >= range.start && d <= range.end
  })
}

export interface FinanceTotals {
  /** Receitas pagas. */
  income: number
  /** Receitas a receber (pendentes). */
  pending: number
  /** Despesas pagas. */
  expense: number
  /** Despesas a pagar (pendentes). */
  payable: number
  /** income - expense (so o que efetivamente entrou/saiu). */
  balance: number
}

/** Transacoes canceladas nao entram em nenhum total. */
export function computeTotals(transactions: Pick<Transaction, 'type' | 'status' | 'amount'>[]): FinanceTotals {
  let income = 0
  let pending = 0
  let expense = 0
  let payable = 0
  for (const t of transactions) {
    const amt = Number(t.amount) || 0
    if (t.status === 'cancelled') continue
    if (t.type === 'income') {
      if (t.status === 'paid') income += amt
      else pending += amt
    } else {
      if (t.status === 'paid') expense += amt
      else payable += amt
    }
  }
  return { income, pending, expense, payable, balance: income - expense }
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Receitas x despesas pagas dos ultimos `months` meses, agrupadas por
 * ano-mes (a versao antiga agrupava so pelo nome do mes, somando setembro
 * deste ano com setembro do ano passado).
 */
export function monthlySeries(transactions: Transaction[], today: string, months = 6) {
  const current = today.slice(0, 7)
  const series = Array.from({ length: months }, (_, i) => {
    const ym = addMonths(current, i - (months - 1))
    return { key: ym, month: `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`, receitas: 0, despesas: 0 }
  })
  const byKey = new Map(series.map((s) => [s.key, s]))
  for (const t of transactions) {
    if (t.status !== 'paid') continue
    const bucket = byKey.get(effectiveDate(t).slice(0, 7))
    if (!bucket) continue
    if (t.type === 'income') bucket.receitas += Number(t.amount) || 0
    else bucket.despesas += Number(t.amount) || 0
  }
  return series
}

/** Despesas (nao canceladas) somadas por categoria, maior primeiro. */
export function expensesByCategory(transactions: Transaction[]) {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.status === 'cancelled') continue
    const cat = t.category || 'Outros'
    map.set(cat, (map.get(cat) ?? 0) + (Number(t.amount) || 0))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
