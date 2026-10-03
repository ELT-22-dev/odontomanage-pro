import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { getFollowup, updateFollowup } from '@/server/repos/followups'
import { updateFollowupSchema } from '@/server/schemas'

type P = { id: string }

/**
 * Registrar resultado, concluir, dispensar, reabrir ou adiar (due_date).
 * Follow-ups nao sao excluidos — ficam no historico do paciente.
 */
export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Follow-up')
  const data = await readBody(req, updateFollowupSchema)
  if (!(await getFollowup(id))) throw notFound('Follow-up')
  const followup = await updateFollowup(id, data, user.id)
  await audit(req, user, 'update', 'followup', id, { status: data.status, outcome: data.outcome, due_date: data.due_date })
  return json(followup)
})
