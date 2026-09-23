import 'server-only'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { env } from './env'
import { queryOne } from './db'
import { HttpError } from './http'
import type { SessionUser } from '@/lib/types'

/*
 * Autenticacao propria, sem servico externo:
 * - senha com bcrypt (custo 10);
 * - sessao = JWT assinado (HS256, AUTH_SECRET) num cookie httpOnly;
 * - a cada requisicao o usuario e relido do banco, entao desativar um usuario
 *   ou trocar a senha (que incrementa session_version) derruba a sessao na hora.
 */

export const SESSION_COOKIE = 'odonto_session'
const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15

const secretKey = () => new TextEncoder().encode(env().AUTH_SECRET)

// Hash real de uma senha qualquer, usado so para gastar tempo de bcrypt quando
// o email nao existe (evita descobrir emails cadastrados pelo tempo de resposta).
let dummyHash: string | null = null
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('senha-inexistente', 10))

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

interface UserRow {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff'
  active: boolean
  password_hash: string
  failed_logins: number
  locked_until: string | null
  session_version: number
}

async function createToken(user: Pick<UserRow, 'id' | 'session_version'>) {
  return new SignJWT({ ver: user.session_version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${env().SESSION_HOURS}h`)
    .sign(secretKey())
}

export async function setSessionCookie(user: Pick<UserRow, 'id' | 'session_version'>) {
  const token = await createToken(user)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env().SESSION_HOURS * 3600,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** Usuario logado (relido do banco) ou null. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (!payload.sub) return null
    const user = await queryOne<UserRow>('select * from users where id = $1', [payload.sub])
    if (!user || !user.active || user.session_version !== payload.ver) return null
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  } catch {
    return null
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new HttpError(401, 'Sessao expirada. Entre novamente.')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new HttpError(403, 'Apenas administradores podem fazer isso')
  return user
}

/**
 * Valida email+senha com bloqueio temporario apos tentativas erradas.
 * Mensagem de erro sempre generica (nao revela se o email existe).
 */
export async function authenticate(email: string, password: string): Promise<UserRow> {
  const user = await queryOne<UserRow>('select * from users where lower(email) = lower($1)', [email.trim()])
  const invalid = new HttpError(401, 'Email ou senha incorretos')
  if (!user) {
    // Gasta o mesmo tempo de um bcrypt real para nao vazar quais emails existem.
    await bcrypt.compare(password, getDummyHash())
    throw invalid
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new HttpError(429, `Muitas tentativas. Tente novamente em alguns minutos.`)
  }
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) {
    await queryOne(
      `update users set
         failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end,
         locked_until  = case when failed_logins + 1 >= $2 then now() + ($3 || ' minutes')::interval else locked_until end
       where id = $1`,
      [user.id, MAX_FAILED_LOGINS, String(LOCK_MINUTES)],
    )
    throw invalid
  }
  if (!user.active) throw new HttpError(403, 'Usuario desativado. Fale com o administrador da clinica.')
  await queryOne('update users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1', [user.id])
  return user
}
