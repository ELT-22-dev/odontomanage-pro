import 'server-only'
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'
import { env } from './env'

/*
 * Conversao de tipos do Postgres → JS:
 * - DATE (1082) volta como texto 'YYYY-MM-DD'. O padrao do `pg` converte para
 *   Date em UTC, o que "volta um dia" no fuso do Brasil — bug classico.
 * - NUMERIC (1700) volta como number (valores monetarios, 2 casas).
 * - INT8 (20) volta como number (count(*)).
 */
types.setTypeParser(1082, (v) => v)
types.setTypeParser(1700, (v) => parseFloat(v))
types.setTypeParser(20, (v) => parseInt(v, 10))

// Em desenvolvimento o Next recarrega modulos a cada alteracao; guardar o pool
// no globalThis evita abrir um pool novo (e esgotar conexoes) a cada reload.
const globalForPg = globalThis as unknown as { pgPool?: Pool }

function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: normalizeSslMode(env().DATABASE_URL),
      // Funcoes serverless: poucas conexoes por instancia. O pooler do Neon
      // (host "-pooler") multiplexa isso para o banco.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return globalForPg.pgPool
}

/**
 * O `pg` ja trata sslmode=require como verify-full (valida o certificado) e
 * avisa no log que isso vai mudar na v9. Deixamos explicito o modo seguro,
 * que e o que a string do Neon precisa.
 */
function normalizeSslMode(url: string): string {
  return url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
}

type Executor = Pick<PoolClient, 'query'>

/** Executa SQL parametrizado ($1, $2...). NUNCA concatene valores do usuario na string. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor?: Executor,
): Promise<T[]> {
  const result = await (executor ?? getPool()).query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor?: Executor,
): Promise<T | null> {
  const rows = await query<T>(text, params, executor)
  return rows[0] ?? null
}

/** Roda `fn` numa transacao: tudo ou nada. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Monta "col1 = $n, col2 = $n+1" para UPDATE a partir de um objeto ja
 * validado pelo zod. So entram colunas presentes em `allowed` — o nome da
 * coluna nunca vem direto do usuario.
 */
export function buildSet(
  data: Record<string, unknown>,
  allowed: readonly string[],
  startIndex = 1,
): { clause: string; values: unknown[] } {
  const cols = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined)
  return {
    clause: cols.map((c, i) => `${c} = $${startIndex + i}`).join(', '),
    values: cols.map((c) => data[c]),
  }
}

/** Monta INSERT a partir de um objeto validado. */
export function buildInsert(
  table: string,
  data: Record<string, unknown>,
  allowed: readonly string[],
): { text: string; values: unknown[] } {
  const cols = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined)
  const placeholders = cols.map((_, i) => `$${i + 1}`)
  return {
    text: `insert into ${table} (${cols.join(', ')}) values (${placeholders.join(', ')}) returning *`,
    values: cols.map((c) => data[c]),
  }
}
