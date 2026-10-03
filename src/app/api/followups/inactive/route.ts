import { requireUser } from '@/server/auth'
import { json, route } from '@/server/http'
import { getFollowupSettings, listInactivePatients } from '@/server/repos/followups'
import { todayISO } from '@/lib/dates'

/**
 * Pacientes "sumidos" (sem consulta realizada ha X meses, sem nada marcado e
 * sem follow-up pendente). Sugestoes — nada e criado automaticamente.
 */
export const GET = route(async () => {
  await requireUser()
  const { inactive_months } = await getFollowupSettings()
  return json({ months: inactive_months, patients: await listInactivePatients(inactive_months, todayISO()) })
})
