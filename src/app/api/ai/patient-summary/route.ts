import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertAiAllowed, summarizePatient } from '@/server/ai'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { listAppointments } from '@/server/repos/appointments'
import { getPatient } from '@/server/repos/patients'
import { listRecords } from '@/server/repos/records'
import { ageFrom, toISODate, todayISO } from '@/lib/dates'
import { APPOINTMENT_STATUS, RECORD_TYPE_STATUS } from '@/lib/statusStyles'

export const maxDuration = 60

const MAX_RECORDS = 40
const MAX_APPOINTMENTS = 30

/**
 * Resumo do historico do paciente. O contexto enviado a IA e montado aqui e
 * NAO inclui nome, CPF, RG, contato, endereco nem convenio (minimizacao — LGPD).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const { patient_id } = await readBody(req, z.object({ patient_id: z.uuid() }))
  const patient = await getPatient(patient_id)
  if (!patient) throw new HttpError(404, 'Paciente nao encontrado')
  await assertAiAllowed(user)

  const [records, appointments] = await Promise.all([listRecords(patient_id), listAppointments({ patientId: patient_id })])
  if (records.length === 0 && appointments.length === 0 && !patient.notes) {
    throw new HttpError(400, 'Este paciente ainda nao tem historico para resumir.')
  }

  const today = todayISO()
  const age = ageFrom(patient.birth_date, today)
  const lines: string[] = [
    `Data de hoje: ${today}`,
    `Paciente: ${age !== null ? `${age} anos` : 'idade nao informada'}${patient.sex ? `, sexo ${patient.sex}` : ''}`,
  ]
  if (patient.notes) lines.push(`Observacoes do cadastro: ${patient.notes}`)

  lines.push('', `## Prontuario (${Math.min(records.length, MAX_RECORDS)} registros mais recentes)`)
  for (const r of records.slice(0, MAX_RECORDS)) {
    lines.push(`### ${toISODate(new Date(r.created_at))} — ${RECORD_TYPE_STATUS[r.record_type]?.label ?? r.record_type}: ${r.title}`)
    if (r.content) lines.push(`Evolucao: ${r.content}`)
    if (r.diagnosis) lines.push(`Diagnostico: ${r.diagnosis}`)
    if (r.treatment_plan) lines.push(`Plano: ${r.treatment_plan}`)
    if (r.prescriptions) lines.push(`Prescricao: ${r.prescriptions}`)
  }

  const recentAppts = [...appointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, MAX_APPOINTMENTS)
  lines.push('', `## Consultas (${recentAppts.length} mais recentes)`)
  for (const a of recentAppts) {
    lines.push(`- ${a.date} ${a.time}: ${a.type} — ${APPOINTMENT_STATUS[a.status]?.label ?? a.status}${a.notes ? ` (${a.notes})` : ''}`)
  }

  const result = await summarizePatient(lines.join('\n'))
  await audit(req, user, 'ai_patient_summary', 'patient', patient_id, { records: records.length, appointments: appointments.length })
  return json(result)
})
