import 'server-only'
import type { NextRequest } from 'next/server'
import { query } from './db'
import { clientIp } from './http'
import type { SessionUser } from '@/lib/types'

/**
 * Registra uma acao na trilha de auditoria (tabela audit_log). Visivel para
 * administradores em Configuracoes → Auditoria. Falha aqui nunca derruba a
 * operacao principal — so vai para o log do servidor.
 */
export async function audit(
  req: NextRequest,
  user: Pick<SessionUser, 'id' | 'name'> | null,
  action: string,
  entity?: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await query(
      `insert into audit_log (user_id, user_name, action, entity, entity_id, details, ip)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [user?.id ?? null, user?.name ?? null, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null, clientIp(req)],
    )
  } catch (err) {
    console.error('[audit] falha ao registrar', action, entity, err)
  }
}
