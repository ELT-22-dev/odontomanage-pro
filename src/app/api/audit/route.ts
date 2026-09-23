import { requireAdmin } from '@/server/auth'
import { query } from '@/server/db'
import { json, route } from '@/server/http'
import type { AuditEntry } from '@/lib/types'

/** Ultimas 300 acoes registradas (quem fez o que). Somente admin. */
export const GET = route(async () => {
  await requireAdmin()
  return json(
    await query<AuditEntry>(
      'select id, user_name, action, entity, entity_id, details, ip, created_at from audit_log order by created_at desc limit 300',
    ),
  )
})
