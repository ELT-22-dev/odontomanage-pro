import { requireUser } from '@/server/auth'
import { json, route } from '@/server/http'

export const GET = route(async () => json({ user: await requireUser() }))
