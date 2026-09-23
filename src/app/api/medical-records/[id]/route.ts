import type { NextRequest } from 'next/server'
import { requireAdmin, requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { deleteRecord, getRecord, updateRecord } from '@/server/repos/records'
import { updateRecordSchema } from '@/server/schemas'

type P = { id: string }

export const GET = route<P>(async (_req, { params }) => {
  await requireUser()
  const record = await getRecord(parseId((await params).id, 'Prontuario'))
  if (!record) throw notFound('Prontuario')
  return json(record)
})

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Prontuario')
  const data = await readBody(req, updateRecordSchema)
  if (!(await getRecord(id))) throw notFound('Prontuario')
  const record = await updateRecord(id, data, user.id)
  await audit(req, user, 'update', 'medical_record', id, { fields: Object.keys(data) })
  return json(record)
})

/** Exclusao de prontuario e so para admin (documento clinico com guarda obrigatoria). */
export const DELETE = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireAdmin()
  const id = parseId((await params).id, 'Prontuario')
  const record = await getRecord(id)
  if (!record) throw notFound('Prontuario')
  await deleteRecord(id)
  await audit(req, user, 'delete', 'medical_record', id, { patient: record.patient_name, title: record.title })
  return json({ ok: true })
})
