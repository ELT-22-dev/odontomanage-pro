import 'server-only'
import { buildInsert, buildSet, query, queryOne } from '../db'
import { TRANSACTION_COLUMNS } from '../schemas'
import type { Transaction } from '@/lib/types'

const SELECT = `
  select t.*, p.name as patient_name
  from transactions t
  left join patients p on p.id = t.patient_id`

export function listTransactions(patientId?: string | null) {
  return query<Transaction>(
    `${SELECT}
     where ($1::uuid is null or t.patient_id = $1::uuid)
     order by coalesce(t.paid_date, t.due_date, t.created_at::date) desc, t.created_at desc`,
    [patientId ?? null],
  )
}

export function getTransaction(id: string) {
  return queryOne<Transaction>(`${SELECT} where t.id = $1`, [id])
}

export async function createTransaction(data: Record<string, unknown>, userId: string) {
  const { text, values } = buildInsert('transactions', { ...data, created_by: userId }, [...TRANSACTION_COLUMNS, 'created_by'])
  const row = await queryOne<{ id: string }>(text, values)
  return (await getTransaction(row!.id))!
}

export async function updateTransaction(id: string, data: Record<string, unknown>) {
  const { clause, values } = buildSet(data, TRANSACTION_COLUMNS, 2)
  if (clause) await query(`update transactions set ${clause}, updated_at = now() where id = $1`, [id, ...values])
  return getTransaction(id)
}

export async function deleteTransaction(id: string) {
  return (await query('delete from transactions where id = $1 returning id', [id])).length > 0
}
