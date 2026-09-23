import type { NextRequest } from 'next/server'
import { clearSessionCookie, getSession } from '@/server/auth'
import { audit } from '@/server/audit'
import { json, route } from '@/server/http'

export const POST = route(async (req: NextRequest) => {
  const user = await getSession()
  await clearSessionCookie()
  if (user) await audit(req, user, 'logout')
  return json({ ok: true })
})
