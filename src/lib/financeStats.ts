/**
 * Pure calculation logic extracted from src/routes/_app/financeiro.tsx so it can
 * be unit-tested without rendering the page (which needs react-query + Supabase
 * mocked). Behavior is unchanged — the route still wraps these in useMemo, this
 * module just holds the computation itself.
 */

export interface Transaction {
  id: string; patient_id: string | null; patient_name: string | null
  type: string; category: string; description: string | null
  amount: string; payment_method: string; status: string
  installments: string; current_installment: string
  due_date: string | null; paid_date: string | null; created_at: string
}

export type Period = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all'

/** `now` is injectable so tests don't depend on the system clock. */
export function getPeriodRange(period: Period, now: Date = new Date()): { start: Date; end: Date } | null {
  switch (period) {
    case 'this-month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
    case 'last-month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: prev, end: new Date(now.getFullYear(), now.getMonth(), 0) }
    }
    case 'last-3-months': {
      const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return { start: threeAgo, end: now }
    }
    case 'this-year':
      return { start: new Date(now.getFullYear(), 0, 1), end: now }
    case 'all':
      return null
  }
}

export interface FinanceTotals {
  income: number
  expense: number
  pending: number
  balance: number
}

/** KPI totals — income only counts transactions already marked "paid". */
export function computeTotals(transactions: Transaction[]): FinanceTotals {
  let income = 0
  let expense = 0
  let pending = 0
  for (const t of transactions) {
    const amt = Number(t.amount) || 0
    if (t.type === 'income') {
      if (t.status === 'paid') income += amt
      else if (t.status === 'pending') pending += amt
    } else {
      expense += amt
    }
  }
  return { income, expense, pending, balance: income - expense }
}

export interface SummaryCounts {
  incomeCount: number
  expenseCount: number
  total: number
}

export function computeSummaryCounts(transactions: Transaction[]): SummaryCounts {
  let incomeCount = 0
  let expenseCount = 0
  for (const t of transactions) {
    if (t.type === 'income') incomeCount++
    else expenseCount++
  }
  return { incomeCount, expenseCount, total: incomeCount + expenseCount }
}
