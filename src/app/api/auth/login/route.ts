import type { NextRequest } from 'next/server'
import { authenticate, setSessionCookie } from '@/server/auth'
import { audit } from '@/server/audit'
import { HttpError, json, readBody, route } from '@/server/http'
import { loginSchema } from '@/server/schemas'

export const POST = route(async (req: NextRequest) => {
  const { email, password } = await readBody(req, loginSchema)
  try {
    const user = await authenticate(email, password)
    await setSessionCookie(user)
    await audit(req, user, 'login')
    return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    if (err instanceof HttpError) await audit(req, null, 'login_failed', 'user', null, { email })
    throw err
  }
})
