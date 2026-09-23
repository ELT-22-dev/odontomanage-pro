import 'server-only'
import { buildInsert, buildSet, query, queryOne } from '../db'
import { APPOINTMENT_COLUMNS } from '../schemas'
import type { Appointment } from '@/lib/types'

const SELECT = `
  select a.*, p.name as patient_name, p.phone as patient_phone, p.whatsapp as patient_whatsapp
  from appointments a
  join patients p on p.id = a.patient_id`

export interface AppointmentFilters {
  from?: string | null
  to?: string | null
  patientId?: string | null
}

export function listAppointments(f: AppointmentFilters = {}) {
  return query<Appointment>(
    `${SELECT}
     where ($1::date is null or a.date >= $1::date)
       and ($2::date is null or a.date <= $2::date)
       and ($3::uuid is null or a.patient_id = $3::uuid)
     order by a.date, a.time`,
    [f.from ?? null, f.to ?? null, f.patientId ?? null],
  )
}

export function getAppointment(id: string) {
  return queryOne<Appointment>(`${SELECT} where a.id = $1`, [id])
}

/**
 * Outra consulta ativa do MESMO dentista que se sobrepoe no horario
 * (considerando a duracao). Sem dentista informado, nao ha como conflitar.
 */
export function findConflict(params: {
  date: string
  time: string
  duration: number
  dentist: string | null | undefined
  excludeId?: string
}) {
  if (!params.dentist) return Promise.resolve(null)
  return queryOne<Appointment>(
    `${SELECT}
     where a.date = $1::date
       and lower(a.dentist_name) = lower($2)
       and a.status not in ('cancelled', 'no_show')
       and ($5::uuid is null or a.id <> $5::uuid)
       and (split_part(a.time, ':', 1)::int * 60 + split_part(a.time, ':', 2)::int) < $4::int
       and $3::int < (split_part(a.time, ':', 1)::int * 60 + split_part(a.time, ':', 2)::int) + a.duration_minutes
     limit 1`,
    [
      params.date,
      params.dentist,
      toMinutes(params.time),
      toMinutes(params.time) + params.duration,
      params.excludeId ?? null,
    ],
  )
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function createAppointment(data: Record<string, unknown>, userId: string) {
  const { text, values } = buildInsert('appointments', { ...data, created_by: userId }, [...APPOINTMENT_COLUMNS, 'created_by'])
  const row = await queryOne<{ id: string }>(text, values)
  return (await getAppointment(row!.id))!
}

export async function updateAppointment(id: string, data: Record<string, unknown>) {
  const { clause, values } = buildSet(data, APPOINTMENT_COLUMNS, 2)
  if (clause) await query(`update appointments set ${clause}, updated_at = now() where id = $1`, [id, ...values])
  return getAppointment(id)
}

export async function deleteAppointment(id: string) {
  return (await query('delete from appointments where id = $1 returning id', [id])).length > 0
}

/** Nomes de dentistas ja usados (sugestoes no formulario). */
export async function listDentists() {
  const rows = await query<{ dentist_name: string }>(
    `select distinct dentist_name from appointments where dentist_name is not null order by dentist_name`,
  )
  return rows.map((r) => r.dentist_name)
}
