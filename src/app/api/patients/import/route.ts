import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'
import { importPatients } from '@/server/repos/patients'
import { importPatientsSchema } from '@/server/schemas'

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const { rows } = await readBody(req, importPatientsSchema)
  const result = await importPatients(rows, user.id)
  await audit(req, user, 'import', 'patient', null, result)
  return json(result, 201)
})
