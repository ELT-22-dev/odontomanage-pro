import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { aiStatus } from '@/server/ai'
import { requireAdmin, requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { query } from '@/server/db'
import { HttpError, json, readBody, route } from '@/server/http'

/** { configured: chave presente no servidor, enabled: admin ligou } */
export const GET = route(async () => {
  await requireUser()
  return json(await aiStatus())
})

/** Admin liga/desliga o assistente de IA para a clinica inteira. */
export const PUT = route(async (req: NextRequest) => {
  const user = await requireAdmin()
  const { enabled } = await readBody(req, z.object({ enabled: z.boolean() }))
  if (enabled && !(await aiStatus()).configured) {
    throw new HttpError(409, 'Configure a variavel ANTHROPIC_API_KEY no servidor antes de ligar a IA.')
  }
  await query('update clinic_settings set ai_enabled = $1, updated_at = now() where id = 1', [enabled])
  await audit(req, user, 'update', 'ai_settings', '1', { enabled })
  return json(await aiStatus())
})
