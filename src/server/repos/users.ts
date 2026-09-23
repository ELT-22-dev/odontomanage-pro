import 'server-only'
import { query, queryOne } from '../db'
import { hashPassword } from '../auth'
import { HttpError } from '../http'
import type { User } from '@/lib/types'

const PUBLIC_COLUMNS = 'id, name, email, role, active, last_login_at, created_at'

export async function countUsers() {
  return (await queryOne<{ n: number }>('select count(*) as n from users'))!.n
}

export function listUsers() {
  return query<User>(`select ${PUBLIC_COLUMNS} from users order by active desc, lower(name)`)
}

export function getUser(id: string) {
  return queryOne<User>(`select ${PUBLIC_COLUMNS} from users where id = $1`, [id])
}

export async function createUser(data: { name: string; email: string; password: string; role: 'admin' | 'staff' }) {
  const existing = await queryOne('select 1 from users where lower(email) = lower($1)', [data.email])
  if (existing) throw new HttpError(409, 'Ja existe um usuario com este email')
  return (await queryOne<User>(
    `insert into users (name, email, password_hash, role) values ($1, $2, $3, $4) returning ${PUBLIC_COLUMNS}`,
    [data.name, data.email, await hashPassword(data.password), data.role],
  ))!
}

/**
 * Atualiza nome/papel/ativo/senha. Mudar senha ou desativar incrementa
 * session_version, derrubando as sessoes abertas do usuario.
 */
export async function updateUser(
  id: string,
  data: { name?: string; role?: 'admin' | 'staff'; active?: boolean; password?: string },
) {
  const sets: string[] = []
  const values: unknown[] = [id]
  const add = (sql: string, v: unknown) => {
    values.push(v)
    sets.push(`${sql} = $${values.length}`)
  }
  if (data.name !== undefined) add('name', data.name)
  if (data.role !== undefined) add('role', data.role)
  if (data.active !== undefined) add('active', data.active)
  if (data.password !== undefined) {
    add('password_hash', await hashPassword(data.password))
    sets.push('failed_logins = 0', 'locked_until = null')
  }
  if (data.password !== undefined || data.active === false) sets.push('session_version = session_version + 1')
  if (!sets.length) return getUser(id)
  return queryOne<User>(`update users set ${sets.join(', ')}, updated_at = now() where id = $1 returning ${PUBLIC_COLUMNS}`, values)
}

/** Garante que sempre sobra pelo menos um admin ativo. */
export async function assertNotLastAdmin(userId: string) {
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from users where role = 'admin' and active and id <> $1`,
    [userId],
  )
  if (!row || row.n === 0) throw new HttpError(409, 'Este e o unico administrador ativo — crie outro admin antes')
}
