import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { ZodError, type ZodType } from 'zod'

/** Erro "esperado" — vira uma resposta JSON com o status e a mensagem dados. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Registro') => new HttpError(404, `${what} nao encontrado`)

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export async function readBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new HttpError(400, 'Corpo da requisicao invalido (JSON esperado)')
  }
  return schema.parse(raw)
}

/** Postgres error codes que viram mensagens amigaveis em vez de 500. */
function pgErrorToHttp(err: { code?: string; constraint?: string }): HttpError | null {
  switch (err.code) {
    case '23505':
      return new HttpError(409, 'Ja existe um registro com esses dados')
    case '23503': // foreign_key_violation
    case '23001': // restrict_violation (ON DELETE RESTRICT no Postgres 17+, ex.: Neon)
      if (err.constraint?.startsWith('medical_records_patient_id')) {
        return new HttpError(409, 'Este paciente tem prontuarios e nao pode ser excluido. Marque-o como inativo.')
      }
      return new HttpError(409, 'Registro vinculado a outro que nao existe (ou que esta em uso)')
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return new HttpError(400, 'Dados invalidos')
    default:
      return null
  }
}

type Ctx<P> = { params: Promise<P> }
type Handler<P> = (req: NextRequest, ctx: Ctx<P>) => Promise<Response>

/**
 * Envolve toda API route: converte erros em respostas JSON padronizadas
 * `{ error: "mensagem" }` e bloqueia requisicoes de escrita vindas de outro
 * site (defesa extra contra CSRF, alem do cookie SameSite=Lax).
 */
export function route<P = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const origin = req.headers.get('origin')
        if (origin && new URL(origin).host !== req.headers.get('host')) {
          throw new HttpError(403, 'Origem nao permitida')
        }
      }
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      if (err instanceof ZodError) {
        const issue = err.issues[0]
        const field = issue?.path.join('.')
        return json({ error: field ? `${field}: ${issue.message}` : (issue?.message ?? 'Dados invalidos') }, 400)
      }
      const pgErr = pgErrorToHttp(err as { code?: string; constraint?: string })
      if (pgErr) return json({ error: pgErr.message }, pgErr.status)
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, err)
      return json({ error: 'Erro interno no servidor. Tente novamente.' }, 500)
    }
  }
}

export function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Valida o :id da URL. Id malformado = 404 (em vez de erro de SQL). */
export function parseId(id: string, what = 'Registro'): string {
  if (!UUID_RE.test(id)) throw notFound(what)
  return id
}
