import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { getPatient } from '@/server/repos/patients'
import { createRecord, listRecords } from '@/server/repos/records'
import { createRecordSchema } from '@/server/schemas'

const UUID_RE = /^[0-9a-f-]{36}$/i

export const GET = route(async (req: NextRequest) => {
  await requireUser()
  const patientId = req.nextUrl.searchParams.get('patient_id')
  return json(await listRecords(patientId && UUID_RE.test(patientId) ? patientId : null))
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, createRecordSchema)
  if (!(await getPatient(data.patient_id))) throw new HttpError(400, 'Paciente nao encontrado')
  const record = await createRecord(data, user.id)
  await audit(req, user, 'create', 'medical_record', record.id, { patient: record.patient_name, title: record.title })
  return json(record, 201)
})
