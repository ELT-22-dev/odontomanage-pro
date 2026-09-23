import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { audit } from '@/server/audit'
import { query } from '@/server/db'
import { route } from '@/server/http'

/**
 * Exporta todos os dados clinicos em JSON (copia extra / portabilidade LGPD).
 * Nao inclui usuarios nem senhas. O backup "de verdade" e o do proprio banco
 * (Neon: restauracao para qualquer ponto no tempo) — ver docs/INFRAESTRUTURA.md.
 */
export const GET = route(async (req: NextRequest) => {
  const user = await requireAdmin()
  const [clinic, patients, appointments, transactions, medical_records] = await Promise.all([
    query('select clinic_name, phone, address from clinic_settings'),
    query('select * from patients order by created_at'),
    query('select * from appointments order by date, time'),
    query('select * from transactions order by created_at'),
    query('select * from medical_records order by created_at'),
  ])
  await audit(req, user, 'export', 'backup', null, {
    patients: patients.length,
    appointments: appointments.length,
    transactions: transactions.length,
    medical_records: medical_records.length,
  })
  const body = JSON.stringify(
    { exported_at: new Date().toISOString(), format: 'odontomanage-v1', clinic: clinic[0] ?? null, tables: { patients, appointments, transactions, medical_records } },
    null,
    2,
  )
  const date = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="odontomanage-backup-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})
