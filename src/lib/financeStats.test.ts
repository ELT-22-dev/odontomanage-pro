import { describe, expect, it } from 'vitest'
import {
  computeTotals, effectiveDate, expensesByCategory, filterByPeriod, getPeriodRange, monthlySeries,
} from './financeStats'
import type { Transaction } from './types'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx1',
    patient_id: null,
    patient_name: null,
    type: 'income',
    category: 'Consulta',
    description: null,
    amount: 100,
    payment_method: 'pix',
    status: 'paid',
    installments: 1,
    current_installment: 1,
    due_date: null,
    paid_date: null,
    created_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('getPeriodRange', () => {
  const today = '2026-07-15'

  it('this-month cobre o mes inteiro', () => {
    expect(getPeriodRange('this-month', today)).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('last-month em janeiro volta para dezembro do ano anterior', () => {
    expect(getPeriodRange('last-month', '2026-01-10')).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('last-3-months inclui o mes atual e os 2 anteriores', () => {
    expect(getPeriodRange('last-3-months', today)).toEqual({ start: '2026-05-01', end: '2026-07-31' })
  })

  it('all = sem filtro', () => {
    expect(getPeriodRange('all', today)).toBeNull()
  })
})

describe('effectiveDate / filterByPeriod', () => {
  it('prioriza data de pagamento, depois vencimento, depois cadastro', () => {
    expect(effectiveDate(tx({ paid_date: '2026-07-02', due_date: '2026-08-01' }))).toBe('2026-07-02')
    expect(effectiveDate(tx({ due_date: '2026-08-01' }))).toBe('2026-08-01')
    expect(effectiveDate(tx({}))).toBe('2026-07-15')
  })

  it('mensalidade cadastrada hoje com vencimento no mes que vem NAO entra neste mes', () => {
    const list = [tx({ status: 'pending', due_date: '2026-08-10' })]
    expect(filterByPeriod(list, 'this-month', '2026-07-15')).toHaveLength(0)
  })
})

describe('computeTotals', () => {
  it('separa recebido de a receber', () => {
    const t = computeTotals([tx({ amount: 300 }), tx({ status: 'pending', amount: 150 })])
    expect(t.income).toBe(300)
    expect(t.pending).toBe(150)
  })

  it('canceladas nao contam em nada (inclusive despesas — bug da versao antiga)', () => {
    const t = computeTotals([tx({ status: 'cancelled', amount: 500 }), tx({ type: 'expense', status: 'cancelled', amount: 80 })])
    expect(t).toEqual({ income: 0, pending: 0, expense: 0, payable: 0, balance: 0 })
  })

  it('despesa pendente vai para "a pagar", nao desconta do saldo', () => {
    const t = computeTotals([
      tx({ amount: 1000 }),
      tx({ type: 'expense', amount: 400 }),
      tx({ type: 'expense', status: 'pending', amount: 50 }),
    ])
    expect(t.balance).toBe(600)
    expect(t.payable).toBe(50)
  })
})

describe('monthlySeries', () => {
  it('agrupa por ano-mes: setembro do ano passado nao soma com setembro deste ano', () => {
    const series = monthlySeries(
      [tx({ paid_date: '2026-09-05', amount: 100 }), tx({ paid_date: '2025-09-05', amount: 999 })],
      '2026-09-23',
    )
    expect(series).toHaveLength(6)
    expect(series[5]).toMatchObject({ key: '2026-09', receitas: 100 })
    expect(series[0].key).toBe('2026-04')
  })
})

describe('expensesByCategory', () => {
  it('soma por categoria e ordena do maior para o menor', () => {
    const data = expensesByCategory([
      tx({ type: 'expense', category: 'Aluguel', amount: 3000 }),
      tx({ type: 'expense', category: 'Material', amount: 200 }),
      tx({ type: 'expense', category: 'Material', amount: 300 }),
      tx({ type: 'income', category: 'Consulta', amount: 999 }),
    ])
    expect(data).toEqual([
      { name: 'Aluguel', value: 3000 },
      { name: 'Material', value: 500 },
    ])
  })
})
