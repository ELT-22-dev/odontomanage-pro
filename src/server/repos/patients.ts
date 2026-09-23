import 'server-only'
import { buildInsert, buildSet, query, queryOne, transaction } from '../db'
import { PATIENT_COLUMNS } from '../schemas'
import type { Patient } from '@/lib/types'

const onlyDigits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')

export function listPatients() {
  return query<Patient>('select * from patients order by lower(name)')
}

export function getPatient(id: string) {
  return queryOne<Patient>('select * from patients where id = $1', [id])
}

/** Outro paciente com o mesmo CPF (comparando so os digitos), ou null. */
export async function findDuplicateCpf(cpf: string | null | undefined, excludeId?: string) {
  const digits = onlyDigits(cpf)
  if (!digits) return null
  return queryOne<{ id: string; name: string }>(
    `select id, name from patients
     where regexp_replace(cpf, '\\D', '', 'g') = $1 and ($2::uuid is null or id <> $2::uuid)
     limit 1`,
    [digits, excludeId ?? null],
  )
}

export async function createPatient(data: Record<string, unknown>, userId: string) {
  const { text, values } = buildInsert('patients', { ...data, created_by: userId }, [...PATIENT_COLUMNS, 'created_by'])
  return (await queryOne<Patient>(text, values))!
}

export async function updatePatient(id: string, data: Record<string, unknown>) {
  const { clause, values } = buildSet(data, PATIENT_COLUMNS, 2)
  if (!clause) return getPatient(id)
  return queryOne<Patient>(`update patients set ${clause}, updated_at = now() where id = $1 returning *`, [id, ...values])
}

export async function deletePatient(id: string) {
  const rows = await query('delete from patients where id = $1 returning id', [id])
  return rows.length > 0
}

/** Quantos registros dependem do paciente (mostrado antes de excluir). */
export async function patientUsage(id: string) {
  return (await queryOne<{ appointments: number; records: number; transactions: number }>(
    `select
       (select count(*) from appointments where patient_id = $1) as appointments,
       (select count(*) from medical_records where patient_id = $1) as records,
       (select count(*) from transactions where patient_id = $1) as transactions`,
    [id],
  ))!
}

/**
 * Importacao em massa (CSV). Tudo numa transacao. Linhas cujo CPF ja existe
 * (no banco ou repetido na propria planilha) sao puladas, nao duplicadas.
 */
export async function importPatients(rows: Record<string, unknown>[], userId: string) {
  return transaction(async (client) => {
    const existing = await query<{ digits: string }>(
      `select regexp_replace(cpf, '\\D', '', 'g') as digits from patients where cpf is not null`,
      [],
      client,
    )
    const seen = new Set(existing.map((r) => r.digits).filter(Boolean))
    let inserted = 0
    let skipped = 0
    for (const row of rows) {
      const digits = onlyDigits(row.cpf as string | null)
      if (digits && seen.has(digits)) {
        skipped++
        continue
      }
      if (digits) seen.add(digits)
      const { text, values } = buildInsert('patients', { ...row, status: 'active', created_by: userId }, [...PATIENT_COLUMNS, 'created_by'])
      await client.query(text, values)
      inserted++
    }
    return { inserted, skipped }
  })
}
