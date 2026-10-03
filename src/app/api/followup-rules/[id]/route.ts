import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { deleteRule, updateRule } from '@/server/repos/followups'
import { updateRuleSchema } from '@/server/schemas'

type P = { id: string }

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireAdmin()
  const id = parseId((await params).id, 'Regra')
  const data = await readBody(req, updateRuleSchema)
  const rule = await updateRule(id, data)
  if (!rule) throw notFound('Regra')
  await audit(req, user, 'update', 'followup_rule', id, { fields: Object.keys(data) })
  return json(rule)
})

/** Excluir a regra nao apaga os follow-ups que ela ja criou. */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireAdmin()
  const id = parseId((await params).id, 'Regra')
  if (!(await deleteRule(id))) throw notFound('Regra')
  await audit(req, user, 'delete', 'followup_rule', id)
  return json({ ok: true })
})
