import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, route } from '@/server/http'
import { getFollowup, registerContact } from '@/server/repos/followups'

type P = { id: string }

/** Conta uma tentativa de contato (chamado ao abrir o WhatsApp pela fila). */
export const POST = route<P>(async (req: NextRequest, { params }) => {
  const user = await requireUser()
  const id = parseId((await params).id, 'Follow-up')
  if (!(await getFollowup(id))) throw notFound('Follow-up')
  const followup = await registerContact(id)
  await audit(req, user, 'contact', 'followup', id, { attempts: followup?.attempts })
  return json(followup)
})
