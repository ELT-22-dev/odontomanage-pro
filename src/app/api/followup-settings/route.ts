import type { NextRequest } from 'next/server'
import { requireAdmin, requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'
import { getFollowupSettings, saveFollowupSettings } from '@/server/repos/followups'
import { followupSettingsSchema } from '@/server/schemas'

/** Textos-modelo das mensagens e meses para considerar paciente "sumido". */
export const GET = route(async () => {
  await requireUser()
  return json(await getFollowupSettings())
})

export const PUT = route(async (req: NextRequest) => {
  const user = await requireAdmin()
  const data = await readBody(req, followupSettingsSchema)
  const saved = await saveFollowupSettings(data)
  await audit(req, user, 'update', 'followup_settings', '1', { inactive_months: data.inactive_months })
  return json(saved)
})
