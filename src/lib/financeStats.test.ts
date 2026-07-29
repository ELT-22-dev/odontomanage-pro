import { describe, expect, it } from 'vitest'
import { computeSummaryCounts, computeTotals, getPeriodRange, type Transaction } from './financeStats'

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx1',
    patient_id: null,
    patient_name: null,
    type: 'income',
    category: 'Consulta',
    description: null,
    amount: '100',
    payment_method: 'dinheiro',
    status: 'paid',
    installments: '1',
    current_installment: '1',
    due_date: null,
    paid_date: null,
    created_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('getPeriodRange', () => {
  // Fixed reference date so the tests don't depend on when they're run.
  const now = new Date(2026, 6, 15) // 15 Jul 2026 (month is 0-indexed)

  it('this-month starts on day 1 of the current month and ends now', () => {
    const range = getPeriodRange('this-month', now)
    expect(range).toEqual({ start: new Date(2026, 6, 1), end: now })
  })

  it('last-month covers the full previous month, not a partial range', () => {
    const range = getPeriodRange('last-month', now)
    expect(range).toEqual({ start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) })
  })

  it('last-month handles a January "now" by rolling back into December of the prior year', () => {
    const january = new Date(2026, 0, 10)
    const range = getPeriodRange('last-month', january)
    expect(range).toEqual({ start: new Date(2025, 11, 1), end: new Date(2025, 11, 31) })
  })

  it('last-3-months starts 3 calendar months back, not 90 days back', () => {
    const range = getPeriodRange('last-3-months', now)
    expect(range).toEqual({ start: new Date(2026, 3, 1), end: now })
  })

  it('this-year starts on Jan 1 of the current year', () => {
    const range = getPeriodRange('this-year', now)
    expect(range).toEqual({ start: new Date(2026, 0, 1), end: now })
  })

  it('all returns null (no filtering)', () => {
    expect(getPeriodRange('all', now)).toBeNull()
  })
})

describe('computeTotals', () => {
  it('counts paid income, but keeps pending income separate from the income total', () => {
    const totals = computeTotals([
      makeTransaction({ type: 'income', status: 'paid', amount: '300' }),
      makeTransaction({ type: 'income', status: 'pending', amount: '150' }),
    ])
    expect(totals.income).toBe(300)
    expect(totals.pending).toBe(150)
  })

  it('does not count a cancelled income transaction as income or as pending', () => {
    const totals = computeTotals([
      makeTransaction({ type: 'income', status: 'cancelled', amount: '500' }),
    ])
    expect(totals.income).toBe(0)
    expect(totals.pending).toBe(0)
  })

  it('sums every expense regardless of status', () => {
    const totals = computeTotals([
      makeTransaction({ type: 'expense', status: 'paid', amount: '80' }),
      makeTransaction({ type: 'expense', status: 'pending', amount: '20' }),
    ])
    expect(totals.expense).toBe(100)
  })

  it('balance is paid income minus total expense (pending income is not counted)', () => {
    const totals = computeTotals([
      makeTransaction({ type: 'income', status: 'paid', amount: '1000' }),
      makeTransaction({ type: 'income', status: 'pending', amount: '9999' }),
      makeTransaction({ type: 'expense', status: 'paid', amount: '400' }),
    ])
    expect(totals.balance).toBe(600)
  })

  it('treats a non-numeric amount as zero instead of NaN poisoning the total', () => {
    const totals = computeTotals([
      makeTransaction({ type: 'income', status: 'paid', amount: 'nao-e-numero' }),
    ])
    expect(totals.income).toBe(0)
    expect(Number.isNaN(totals.balance)).toBe(false)
  })

  it('returns all zeros for an empty list', () => {
    expect(computeTotals([])).toEqual({ income: 0, expense: 0, pending: 0, balance: 0 })
  })
})

describe('computeSummaryCounts', () => {
  it('splits transactions into income/expense counts', () => {
    const counts = computeSummaryCounts([
      makeTransaction({ type: 'income' }),
      makeTransaction({ type: 'income' }),
      makeTransaction({ type: 'expense' }),
    ])
    expect(counts).toEqual({ incomeCount: 2, expenseCount: 1, total: 3 })
  })
})
