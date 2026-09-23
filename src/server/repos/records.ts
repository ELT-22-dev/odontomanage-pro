import 'server-only'
import { buildInsert, buildSet, query, queryOne } from '../db'
import { RECORD_COLUMNS } from '../schemas'
import type { MedicalRecord } from '@/lib/types'

const SELECT = `
  select r.*, p.name as patient_name, cu.name as created_by_name, uu.name as updated_by_name
  from medical_records r
  join patients p on p.id = r.patient_id
  left join users cu on cu.id = r.created_by
  left join users uu on uu.id = r.updated_by`

export function listRecords(patientId?: string | null) {
  return query<MedicalRecord>(
    `${SELECT} where ($1::uuid is null or r.patient_id = $1::uuid) order by r.created_at desc`,
    [patientId ?? null],
  )
}

export function getRecord(id: string) {
  return queryOne<MedicalRecord>(`${SELECT} where r.id = $1`, [id])
}

export async function createRecord(data: Record<string, unknown>, userId: string) {
  const { text, values } = buildInsert(
    'medical_records',
    { ...data, created_by: userId, updated_by: userId },
    [...RECORD_COLUMNS, 'created_by', 'updated_by'],
  )
  const row = await queryOne<{ id: string }>(text, values)
  return (await getRecord(row!.id))!
}

export async function updateRecord(id: string, data: Record<string, unknown>, userId: string) {
  const { clause, values } = buildSet(data, RECORD_COLUMNS, 3)
  await query(
    `update medical_records set ${clause ? clause + ', ' : ''}updated_by = $2, updated_at = now() where id = $1`,
    [id, userId, ...values],
  )
  return getRecord(id)
}

export async function deleteRecord(id: string) {
  return (await query('delete from medical_records where id = $1 returning id', [id])).length > 0
}
