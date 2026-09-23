import 'server-only'

interface Env {
  DATABASE_URL: string
  AUTH_SECRET: string
  SESSION_HOURS: number
}

let cached: Env | null = null

/**
 * Le e valida as variaveis de ambiente no primeiro uso (nao no import, para o
 * `next build` funcionar sem banco). Mensagem de erro clara em vez de um
 * "cannot read property of undefined" perdido no log.
 */
export function env(): Env {
  if (cached) return cached
  const DATABASE_URL = process.env.DATABASE_URL
  const AUTH_SECRET = process.env.AUTH_SECRET
  if (!DATABASE_URL) throw new Error('Variavel de ambiente DATABASE_URL nao configurada (ver .env.example)')
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    throw new Error('Variavel de ambiente AUTH_SECRET ausente ou curta demais (minimo 32 caracteres)')
  }
  const hours = Number(process.env.SESSION_HOURS || 12)
  cached = {
    DATABASE_URL,
    AUTH_SECRET,
    SESSION_HOURS: Number.isFinite(hours) && hours > 0 ? hours : 12,
  }
  return cached
}
