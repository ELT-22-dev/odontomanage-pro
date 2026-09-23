import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'
import { createTransaction, listTransactions } from '@/server/repos/transactions'
import { createTransactionSchema } from '@/server/schemas'
import { todayISO } from '@/lib/dates'

const UUID_RE = /^[0-9a-f-]{36}$/i

export const GET = route(async (req: NextRequest) => {
  await requireUser()
  const patientId = req.nextUrl.searchParams.get('patient_id')
  return json(await listTransactions(patientId && UUID_RE.test(patientId) ? patientId : null))
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, createTransactionSchema)
  const status = data.status ?? 'paid'
  // Pago sem data de pagamento = pago hoje.
  const paid_date = status === 'paid' ? (data.paid_date ?? todayISO()) : null
  const tx = await createTransaction({ ...data, status, paid_date }, user.id)
  await audit(req, user, 'create', 'transaction', tx.id, { type: tx.type, amount: tx.amount })
  return json(tx, 201)
})
