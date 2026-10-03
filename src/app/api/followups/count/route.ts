import { requireUser } from '@/server/auth'
import { json, route } from '@/server/http'
import { countDue } from '@/server/repos/followups'
import { todayISO } from '@/lib/dates'

/** { due: N } — pendentes vencendo ate hoje (numero no menu lateral). */
export const GET = route(async () => {
  await requireUser()
  return json({ due: await countDue(todayISO()) })
})
