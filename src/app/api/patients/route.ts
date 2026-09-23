import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { createPatient, findDuplicateCpf, listPatients } from '@/server/repos/patients'
import { createPatientSchema } from '@/server/schemas'

export const GET = route(async () => {
  await requireUser()
  return json(await listPatients())
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, createPatientSchema)
  const dup = await findDuplicateCpf(data.cpf)
  if (dup) throw new HttpError(409, `Ja existe um paciente com este CPF: ${dup.name}`)
  const patient = await createPatient(data, user.id)
  await audit(req, user, 'create', 'patient', patient.id, { name: patient.name })
  return json(patient, 201)
})
