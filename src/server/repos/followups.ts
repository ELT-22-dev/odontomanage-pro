import 'server-only'
import type { PoolClient } from 'pg'
import { buildInsert, buildSet, query, queryOne } from '../db'
import { FOLLOWUP_COLUMNS, FOLLOWUP_RULE_COLUMNS } from '../schemas'
import { addDays } from '@/lib/dates'
import { CLOSED_BY_NEW_APPOINTMENT, ruleMatches } from '@/lib/followup'
import type { Appointment, Followup, FollowupRule, FollowupSettings, InactivePatient } from '@/lib/types'

type Executor = Pick<PoolClient, 'query'>

const SELECT = `
  select f.*, p.name as patient_name, p.phone as patient_phone, p.whatsapp as patient_whatsapp,
         a.type as appointment_type, a.date as appointment_date, cu.name as completed_by_name
  from followups f
  join patients p on p.id = f.patient_id
  left join appointments a on a.id = f.appointment_id
  left join users cu on cu.id = f.completed_by`

export interface FollowupFilters {
  status?: 'pending' | 'done' | 'dismissed' | null
  to?: string | null
  patientId?: string | null
}

export function listFollowups(f: FollowupFilters = {}) {
  return query<Followup>(
    `${SELECT}
     where ($1::text is null or f.status = $1)
       and ($2::date is null or f.due_date <= $2::date)
       and ($3::uuid is null or f.patient_id = $3::uuid)
     order by case when f.status = 'pending' then 0 else 1 end,
              case when f.status = 'pending' then f.due_date end asc,
              f.completed_at desc nulls last, f.created_at desc
     limit 1000`,
    [f.status ?? null, f.to ?? null, f.patientId ?? null],
  )
}

export function getFollowup(id: string) {
  return queryOne<Followup>(`${SELECT} where f.id = $1`, [id])
}

/** Quantos follow-ups pendentes vencem ate hoje (badge do menu). */
export async function countDue(today: string) {
  return (await queryOne<{ n: number }>(
    `select count(*) as n from followups where status = 'pending' and due_date <= $1::date`,
    [today],
  ))!.n
}

export async function createFollowup(data: Record<string, unknown>, userId: string) {
  const { text, values } = buildInsert('followups', { ...data, created_by: userId }, [...FOLLOWUP_COLUMNS, 'created_by'])
  const row = await queryOne<{ id: string }>(text, values)
  return (await getFollowup(row!.id))!
}

/** Atualiza; ao concluir/dispensar registra quem e quando, ao reabrir limpa. */
export async function updateFollowup(id: string, data: Record<string, unknown>, userId: string) {
  const params: unknown[] = [id]
  let completion = ''
  if (data.status === 'pending') {
    completion = ', completed_by = null, completed_at = null'
  } else if (data.status) {
    params.push(userId)
    completion = `, completed_by = $${params.length}, completed_at = now()`
  }
  const { clause, values } = buildSet(data, FOLLOWUP_COLUMNS, params.length + 1)
  await query(
    `update followups set ${clause ? clause + ', ' : ''}updated_at = now()${completion} where id = $1`,
    [...params, ...values],
  )
  return getFollowup(id)
}

/** Registra uma tentativa de contato (ex.: clicou no WhatsApp). */
export async function registerContact(id: string) {
  await query('update followups set attempts = attempts + 1, last_contact_at = now(), updated_at = now() where id = $1', [id])
  return getFollowup(id)
}

// ── Geracao automatica ──────────────────────────────────────────────────────

/**
 * Consulta FINALIZADA → aplica as regras ativas cujo padrao casa com o
 * procedimento. Idempotente: finalizar de novo nao duplica (indice unico).
 */
export async function applyRulesForCompletedAppointment(appt: Appointment, userId: string, executor?: Executor) {
  const rules = await query<FollowupRule>('select * from followup_rules where active', [], executor)
  let created = 0
  for (const rule of rules) {
    if (!ruleMatches(appt.type, rule.appointment_type)) continue
    const rows = await query(
      `insert into followups (patient_id, kind, due_date, reason, appointment_id, rule_id, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (appointment_id, rule_id) where rule_id is not null do nothing
       returning id`,
      [appt.patient_id, rule.kind, addDays(appt.date, rule.days_after), rule.reason, appt.id, rule.id, userId],
      executor,
    )
    created += rows.length
  }
  return created
}

/** Consulta marcada como FALTOU → follow-up de reagendamento para hoje. */
export async function createNoShowFollowup(appt: Appointment, today: string, userId: string) {
  const rows = await query(
    `insert into followups (patient_id, kind, due_date, reason, appointment_id, created_by)
     values ($1, 'reactivation', $2, $3, $4, $5)
     on conflict (appointment_id) where kind = 'reactivation' and appointment_id is not null do nothing
     returning id`,
    [appt.patient_id, today, `Faltou a consulta de ${appt.type} (${appt.date.split('-').reverse().join('/')}) — reagendar`, appt.id, userId],
  )
  return rows.length
}

/**
 * Paciente agendou nova consulta → encerra os follow-ups de retorno,
 * orcamento e reativacao dele (objetivo cumprido). Pos-procedimento continua.
 */
export async function closeOnNewAppointment(patientId: string, userId: string) {
  const rows = await query(
    `update followups set status = 'done', outcome = 'scheduled', completed_by = $2, completed_at = now(), updated_at = now()
     where patient_id = $1 and status = 'pending' and kind = any($3::text[])
     returning id`,
    [patientId, userId, CLOSED_BY_NEW_APPOINTMENT],
  )
  return rows.length
}

/**
 * Pacientes "sumidos": ativos, cuja ultima consulta realizada foi ha mais de
 * `months` meses, sem consulta futura marcada e sem follow-up pendente.
 */
export function listInactivePatients(months: number, today: string) {
  // Meses aproximados em dias (evita datas invalidas como 31/02).
  const cutoff = addDays(today, -Math.round(months * 30.44))
  return query<InactivePatient>(
    `select p.id, p.name, p.phone, p.whatsapp, last.date as last_visit, last.type as last_type
     from patients p
     join lateral (
       select a.date, a.type from appointments a
       where a.patient_id = p.id and a.status = 'completed'
       order by a.date desc, a.time desc limit 1
     ) last on true
     where p.status = 'active'
       and last.date < $1::date
       and not exists (select 1 from appointments f where f.patient_id = p.id and f.date >= $2::date and f.status in ('scheduled', 'confirmed'))
       and not exists (select 1 from followups fu where fu.patient_id = p.id and fu.status = 'pending')
     order by last.date asc
     limit 200`,
    [cutoff, today],
  )
}

// ── Regras e configuracoes ──────────────────────────────────────────────────

export function listRules() {
  return query<FollowupRule>('select * from followup_rules order by kind, lower(appointment_type), days_after')
}

export async function createRule(data: Record<string, unknown>) {
  const { text, values } = buildInsert('followup_rules', data, FOLLOWUP_RULE_COLUMNS)
  return (await queryOne<FollowupRule>(text, values))!
}

export async function updateRule(id: string, data: Record<string, unknown>) {
  const { clause, values } = buildSet(data, FOLLOWUP_RULE_COLUMNS, 2)
  if (!clause) return queryOne<FollowupRule>('select * from followup_rules where id = $1', [id])
  return queryOne<FollowupRule>(`update followup_rules set ${clause} where id = $1 returning *`, [id, ...values])
}

export async function deleteRule(id: string) {
  return (await query('delete from followup_rules where id = $1 returning id', [id])).length > 0
}

export async function getFollowupSettings(): Promise<FollowupSettings> {
  const row = await queryOne<FollowupSettings>('select followup_templates as templates, inactive_months from clinic_settings where id = 1')
  return row ?? { templates: {}, inactive_months: 12 }
}

export async function saveFollowupSettings(s: FollowupSettings) {
  await query('update clinic_settings set followup_templates = $1, inactive_months = $2, updated_at = now() where id = 1', [
    JSON.stringify(s.templates),
    s.inactive_months,
  ])
  return getFollowupSettings()
}
