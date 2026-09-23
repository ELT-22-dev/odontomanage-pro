import type { NextRequest } from 'next/server'
import { setSessionCookie } from '@/server/auth'
import { audit } from '@/server/audit'
import { transaction } from '@/server/db'
import { HttpError, json, readBody, route } from '@/server/http'
import { hashPassword } from '@/server/auth'
import { countUsers } from '@/server/repos/users'
import { setupSchema } from '@/server/schemas'

/**
 * Configuracao inicial: so funciona enquanto NAO existe nenhum usuario.
 * Cria o primeiro administrador e grava o nome da clinica.
 */
export const GET = route(async () => json({ needsSetup: (await countUsers()) === 0 }))

export const POST = route(async (req: NextRequest) => {
  const data = await readBody(req, setupSchema)
  const hash = await hashPassword(data.password)
  const user = await transaction(async (client) => {
    // Trava a tabela para dois "setups" simultaneos nao criarem dois admins.
    await client.query('lock table users in exclusive mode')
    const { rows } = await client.query('select count(*)::int as n from users')
    if (rows[0].n > 0) throw new HttpError(409, 'O sistema ja foi configurado. Faca login.')
    const created = await client.query(
      `insert into users (name, email, password_hash, role) values ($1, $2, $3, 'admin')
       returning id, name, email, role, session_version`,
      [data.name, data.email, hash],
    )
    await client.query('update clinic_settings set clinic_name = $1, updated_at = now() where id = 1', [data.clinic_name])
    return created.rows[0]
  })
  await setSessionCookie(user)
  await audit(req, user, 'setup')
  return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 201)
})
