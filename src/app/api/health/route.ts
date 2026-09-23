import { query } from '@/server/db'
import { json } from '@/server/http'

export const dynamic = 'force-dynamic'

/**
 * Verificacao de saude: GET /api/health → { ok: true, db: true }.
 * Use em monitoramento externo (ex: UptimeRobot) para saber se o sistema
 * e o banco estao no ar. Nao expoe nenhum dado.
 */
export async function GET() {
  try {
    await query('select 1')
    return json({ ok: true, db: true })
  } catch (err) {
    console.error('[health] banco indisponivel', err)
    return json({ ok: false, db: false }, 503)
  }
}
