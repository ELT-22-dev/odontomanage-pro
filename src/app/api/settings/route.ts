import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { audit } from '@/server/audit'
import { queryOne } from '@/server/db'
import { json, readBody, route } from '@/server/http'
import { settingsSchema } from '@/server/schemas'
import type { ClinicSettings } from '@/lib/types'

const COLUMNS = 'clinic_name, phone, address, logo_data_url'

/** Publico de proposito: nome/logo aparecem na tela de login, antes de entrar. */
export const GET = route(async () => {
  const row = await queryOne<ClinicSettings>(`select ${COLUMNS} from clinic_settings where id = 1`)
  return json(row ?? { clinic_name: 'OdontoManage Pro', phone: null, address: null, logo_data_url: null })
})

export const PUT = route(async (req: NextRequest) => {
  const user = await requireAdmin()
  const data = await readBody(req, settingsSchema)
  const row = await queryOne<ClinicSettings>(
    `insert into clinic_settings (id, clinic_name, phone, address, logo_data_url) values (1, $1, $2, $3, $4)
     on conflict (id) do update set clinic_name = $1, phone = $2, address = $3, logo_data_url = $4, updated_at = now()
     returning ${COLUMNS}`,
    [data.clinic_name, data.phone ?? null, data.address ?? null, data.logo_data_url ?? null],
  )
  await audit(req, user, 'update', 'clinic_settings', '1')
  return json(row)
})
