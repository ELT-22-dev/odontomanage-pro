import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { deleteAppointment, findConflict, getAppointment, updateAppointment } from '@/server/repos/appointments'
import { applyRulesForCompletedAppointment, createNoShowFollowup } from '@/server/repos/followups'
import { updateAppointmentSchema } from '@/server/schemas'
import { todayISO } from '@/lib/dates'

type P = { id: string }

export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Consulta')
  const { force, ...data } = await readBody(req, updateAppointmentSchema)
  const current = await getAppointment(id)
  if (!current) throw notFound('Consulta')

  // So verifica conflito se mudou algo que afeta o horario.
  const movesSlot = ['date', 'time', 'duration_minutes', 'dentist_name'].some((k) => k in data)
  const nextStatus = data.status ?? current.status
  if (movesSlot && !force && nextStatus !== 'cancelled' && nextStatus !== 'no_show') {
    const conflict = await findConflict({
      date: data.date ?? current.date,
      time: data.time ?? current.time,
      duration: data.duration_minutes ?? current.duration_minutes,
      dentist: data.dentist_name !== undefined ? data.dentist_name : current.dentist_name,
      excludeId: id,
    })
    if (conflict) {
      return json({ error: `Conflito: ja existe consulta as ${conflict.time} com ${conflict.patient_name}.`, conflict: true }, 409)
    }
  }
  const appt = (await updateAppointment(id, data))!

  // Follow-up automatico: so na TRANSICAO de status (salvar de novo nao repete).
  let followupsCreated = 0
  if (data.status && data.status !== current.status) {
    if (data.status === 'completed') followupsCreated = await applyRulesForCompletedAppointment(appt, user.id)
    if (data.status === 'no_show') followupsCreated = await createNoShowFollowup(appt, todayISO(), user.id)
  }
  await audit(req, user, 'update', 'appointment', id, { fields: Object.keys(data), status: data.status, followups_created: followupsCreated || undefined })
  return json({ ...appt, followups_created: followupsCreated })
})

export const DELETE = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Consulta')
  const appt = await getAppointment(id)
  if (!appt) throw notFound('Consulta')
  await deleteAppointment(id)
  await audit(req, user, 'delete', 'appointment', id, { date: appt.date, time: appt.time, patient: appt.patient_name })
  return json({ ok: true, google_event_id: appt.google_event_id })
})
