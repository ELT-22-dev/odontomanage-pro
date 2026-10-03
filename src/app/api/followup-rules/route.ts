import type { NextRequest } from 'next/server'
import { requireAdmin, requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'
import { createRule, listRules } from '@/server/repos/followups'
import { createRuleSchema } from '@/server/schemas'

/** Regras de follow-up automatico (todos veem; so admin altera). */
export const GET = route(async () => {
  await requireUser()
  return json(await listRules())
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireAdmin()
  const data = await readBody(req, createRuleSchema)
  const rule = await createRule(data)
  await audit(req, user, 'create', 'followup_rule', rule.id, { type: rule.appointment_type, days: rule.days_after })
  return json(rule, 201)
})
