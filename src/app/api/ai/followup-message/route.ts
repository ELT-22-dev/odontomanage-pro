import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertAiAllowed, draftFollowupMessage } from '@/server/ai'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { queryOne } from '@/server/db'
import { HttpError, json, readBody, route } from '@/server/http'
import { getFollowup } from '@/server/repos/followups'
import { FOLLOWUP_KIND, FOLLOWUP_OUTCOME } from '@/lib/followup'
import { todayISO } from '@/lib/dates'

export const maxDuration = 60

/**
 * Sugere a mensagem de WhatsApp de um follow-up. Envia a IA so tipo, motivo,
 * prazo e tentativas — sem nome, telefone ou dados clinicos do paciente.
 * Devolve o texto com {nome}; quem troca pelo nome e o navegador.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const { followup_id } = await readBody(req, z.object({ followup_id: z.uuid() }))
  const f = await getFollowup(followup_id)
  if (!f) throw new HttpError(404, 'Follow-up nao encontrado')
  await assertAiAllowed(user)

  const clinic = await queryOne<{ clinic_name: string }>('select clinic_name from clinic_settings where id = 1')
  const days =
    f.appointment_date !== null
      ? Math.round((Date.parse(`${todayISO()}T00:00:00Z`) - Date.parse(`${f.appointment_date}T00:00:00Z`)) / 86_400_000)
      : null

  const message = await draftFollowupMessage({
    clinicName: clinic?.clinic_name ?? 'clinica',
    kindLabel: FOLLOWUP_KIND[f.kind].label,
    reason: f.reason,
    daysSinceOrigin: days,
    originType: f.appointment_type,
    attempts: f.attempts,
    lastOutcome: f.outcome ? FOLLOWUP_OUTCOME[f.outcome] : null,
  })
  await audit(req, user, 'ai_followup_message', 'followup', f.id, { kind: f.kind })
  return json({ message })
})
