import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, notFound, parseId, readBody, route } from '@/server/http'
import { assertNotLastAdmin, getUser, updateUser } from '@/server/repos/users'
import { updateUserSchema } from '@/server/schemas'

type P = { id: string }

/**
 * Admin altera nome, papel, ativo/inativo ou redefine a senha de alguem.
 * Usuarios nao sao excluidos (a trilha de auditoria referencia eles) — desative.
 */
export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const admin = await requireAdmin()
  const id = parseId((await params).id, 'Usuario')
  const data = await readBody(req, updateUserSchema)
  const target = await getUser(id)
  if (!target) throw notFound('Usuario')

  const losesAdmin = target.role === 'admin' && target.active && (data.role === 'staff' || data.active === false)
  if (losesAdmin) await assertNotLastAdmin(id)

  const user = await updateUser(id, data)
  await audit(req, admin, data.password ? 'reset_password' : 'update', 'user', id, {
    fields: Object.keys(data).filter((k) => k !== 'password'),
  })
  return json(user)
})
