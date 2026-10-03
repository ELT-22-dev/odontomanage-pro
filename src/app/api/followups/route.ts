import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { createFollowup, listFollowups } from '@/server/repos/followups'
import { getPatient } from '@/server/repos/patients'
import { createFollowupSchema } from '@/server/schemas'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f-]{36}$/i
const STATUSES = ['pending', 'done', 'dismissed'] as const

/**
 * GET /api/followups?status=pending|done|dismissed|all&to=AAAA-MM-DD&patient_id=...
 * Padrao: pendentes. `to` = vencendo ate essa data (fila do dia: to=hoje).
 */
export const GET = route(async (req: NextRequest) => {
  await requireUser()
  const sp = req.nextUrl.searchParams
  const status = sp.get('status') ?? 'pending'
  const to = sp.get('to')
  const patientId = sp.get('patient_id')
  return json(
    await listFollowups({
      status: (STATUSES as readonly string[]).includes(status) ? (status as (typeof STATUSES)[number]) : null,
      to: to && DATE_RE.test(to) ? to : null,
      patientId: patientId && UUID_RE.test(patientId) ? patientId : null,
    }),
  )
})

/** Follow-up manual (ex.: "ligar para a Ana daqui a 15 dias"). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, createFollowupSchema)
  if (!(await getPatient(data.patient_id))) throw new HttpError(400, 'Paciente nao encontrado')
  const followup = await createFollowup(data, user.id)
  await audit(req, user, 'create', 'followup', followup.id, { kind: followup.kind, patient: followup.patient_name })
  return json(followup, 201)
})
