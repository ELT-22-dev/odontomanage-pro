import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { deleteTransaction, getTransaction, updateTransaction } from '@/server/repos/transactions'
import { updateTransactionSchema } from '@/server/schemas'
import { todayISO } from '@/lib/dates'

type P = { id: string }

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Transacao')
  const data = await readBody(req, updateTransactionSchema)
  const current = await getTransaction(id)
  if (!current) throw notFound('Transacao')
  const patch: Record<string, unknown> = { ...data }
  // Mantem paid_date coerente com o status.
  if (data.status === 'paid' && !current.paid_date && !data.paid_date) patch.paid_date = todayISO()
  if (data.status && data.status !== 'paid') patch.paid_date = null
  const tx = await updateTransaction(id, patch)
  await audit(req, user, 'update', 'transaction', id, { fields: Object.keys(data), status: data.status })
  return json(tx)
})

export const DELETE = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Transacao')
  const tx = await getTransaction(id)
  if (!tx) throw notFound('Transacao')
  await deleteTransaction(id)
  await audit(req, user, 'delete', 'transaction', id, { type: tx.type, amount: tx.amount, category: tx.category })
  return json({ ok: true })
})
