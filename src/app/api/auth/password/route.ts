import type { NextRequest } from 'next/server'
import { requireUser, setSessionCookie, verifyPassword, hashPassword } from '@/server/auth'
import { audit } from '@/server/audit'
import { queryOne } from '@/server/db'
import { HttpError, json, readBody, route } from '@/server/http'
import { changePasswordSchema } from '@/server/schemas'

/** Troca a propria senha. Derruba as outras sessoes e renova o cookie desta. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, changePasswordSchema)
  const row = await queryOne<{ password_hash: string }>('select password_hash from users where id = $1', [user.id])
  if (!row || !(await verifyPassword(data.current_password, row.password_hash))) {
    throw new HttpError(400, 'Senha atual incorreta')
  }
  const updated = await queryOne<{ id: string; session_version: number }>(
    `update users set password_hash = $2, session_version = session_version + 1, updated_at = now()
     where id = $1 returning id, session_version`,
    [user.id, await hashPassword(data.new_password)],
  )
  await setSessionCookie(updated!)
  await audit(req, user, 'change_password', 'user', user.id)
  return json({ ok: true })
})
