import type { NextRequest } from 'next/server'
import { requireUser } from '@/server/auth'
import { audit } from '@/server/audit'
import { queryOne } from '@/server/db'
import { HttpError, json, readBody, route } from '@/server/http'
import { profileSchema } from '@/server/schemas'

export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser()
  const data = await readBody(req, profileSchema)
  const taken = await queryOne('select 1 from users where lower(email) = lower($1) and id <> $2', [data.email, user.id])
  if (taken) throw new HttpError(409, 'Este email ja esta em uso por outro usuario')
  const updated = await queryOne(
    'update users set name = $2, email = $3, updated_at = now() where id = $1 returning id, name, email, role',
    [user.id, data.name, data.email],
  )
  await audit(req, user, 'update', 'profile', user.id)
  return json({ user: updated })
})
