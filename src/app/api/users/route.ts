import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, readBody, route } from '@/server/http'
import { createUser, listUsers } from '@/server/repos/users'
import { createUserSchema } from '@/server/schemas'

/** Gestao da equipe — somente administradores. Nao existe cadastro publico. */
export const GET = route(async () => {
  await requireAdmin()
  return json(await listUsers())
})

export const POST = route(async (req: NextRequest) => {
  const admin = await requireAdmin()
  const data = await readBody(req, createUserSchema)
  const user = await createUser(data)
  await audit(req, admin, 'create', 'user', user.id, { email: user.email, role: user.role })
  return json(user, 201)
})
