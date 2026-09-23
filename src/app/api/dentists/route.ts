import { requireUser } from '@/server/auth'
import { json, route } from '@/server/http'
import { listDentists } from '@/server/repos/appointments'

/** Nomes de dentistas ja usados na agenda (sugestoes do formulario). */
export const GET = route(async () => {
  await requireUser()
  return json(await listDentists())
})
