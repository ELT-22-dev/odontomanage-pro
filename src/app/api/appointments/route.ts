import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { createAppointment, findConflict, listAppointments } from '@/server/repos/appointments'
import { getPatient } from '@/server/repos/patients'
import { createAppointmentSchema } from '@/server/schemas'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f-]{36}$/i

/** GET /api/appointments?from=AAAA-MM-DD&to=AAAA-MM-DD&patient_id=... (todos opcionais) */
export const GET = route(async (req: NextRequest) => {
  await requireUser()
  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')
  const patientId = sp.get('patient_id')
  return json(
    await listAppointments({
      from: from && DATE_RE.test(from) ? from : null,
      to: to && DATE_RE.test(to) ? to : null,
      patientId: patientId && UUID_RE.test(patientId) ? patientId : null,
    }),
  )
})

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const { force, ...data } = await readBody(req, createAppointmentSchema)
  if (!(await getPatient(data.patient_id))) throw new HttpError(400, 'Paciente nao encontrado')
  if (!force) {
    const conflict = await findConflict({
      date: data.date,
      time: data.time,
      duration: data.duration_minutes ?? 30,
      dentist: data.dentist_name,
    })
    if (conflict) {
      return json(
        { error: `${data.dentist_name} ja tem consulta as ${conflict.time} com ${conflict.patient_name}.`, conflict: true },
        409,
      )
    }
  }
  const appt = await createAppointment(data, user.id)
  await audit(req, user, 'create', 'appointment', appt.id, { date: appt.date, time: appt.time, patient: appt.patient_name })
  return json(appt, 201)
})
