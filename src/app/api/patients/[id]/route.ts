import type { NextRequest } from 'next/server'
import { requireAdmin, requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, notFound, parseId, readBody, route } from '@/server/http'
import { deletePatient, findDuplicateCpf, getPatient, patientUsage, updatePatient } from '@/server/repos/patients'
import { updatePatientSchema } from '@/server/schemas'

type P = { id: string }

export const GET = route<P>(async (_req, { params }) => {
  await requireUser()
  const id = parseId((await params).id, 'Paciente')
  const patient = await getPatient(id)
  if (!patient) throw notFound('Paciente')
  return json({ ...patient, usage: await patientUsage(id) })
})

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Paciente')
  const data = await readBody(req, updatePatientSchema)
  if (data.cpf) {
    const dup = await findDuplicateCpf(data.cpf, id)
    if (dup) throw new HttpError(409, `Ja existe um paciente com este CPF: ${dup.name}`)
  }
  const patient = await updatePatient(id, data)
  if (!patient) throw notFound('Paciente')
  await audit(req, user, 'update', 'patient', id, { fields: Object.keys(data) })
  return json(patient)
})

/** Exclusao e so para admin. Paciente com prontuario nao pode ser excluido (guarda legal). */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireAdmin()
  const id = parseId((await params).id, 'Paciente')
  const patient = await getPatient(id)
  if (!patient) throw notFound('Paciente')
  await deletePatient(id)
  await audit(req, user, 'delete', 'patient', id, { name: patient.name })
  return json({ ok: true })
})
