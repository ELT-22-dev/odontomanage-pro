/**
 * Conexao usada pelos scripts de linha de comando (migrate, create-admin,
 * seed-demo, e2e). Le DATABASE_URL do ambiente ou de .env.local / .env.
 */
import { existsSync, readFileSync } from 'node:fs'
import pg from 'pg'

export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || process.env[m[1]] !== undefined) continue
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

export async function connect() {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL nao definida. Crie o arquivo .env.local (veja .env.example).')
    process.exit(1)
  }
  // Mesmo ajuste de src/server/db.ts: sslmode explicito e seguro (verify-full).
  const client = new pg.Client({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full') })
  await client.connect()
  return client
}
