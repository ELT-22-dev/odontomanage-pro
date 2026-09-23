import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertAiAllowed, structureNote } from '@/server/ai'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'

export const maxDuration = 60

/**
 * Recebe a anotacao livre do dentista e devolve os campos do prontuario
 * preenchidos. NAO salva nada — a tela mostra para revisao.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const { text } = await readBody(
    req,
    z.object({ text: z.string().trim().min(10, 'escreva pelo menos uma frase').max(15_000, 'texto muito longo (maximo 15 mil caracteres)') }),
  )
  await assertAiAllowed(user)
  const result = await structureNote(text)
  // So metadados na auditoria — o conteudo clinico nao e copiado para o log.
  await audit(req, user, 'ai_structure_note', 'medical_record', null, { chars: text.length })
  return json(result)
})
