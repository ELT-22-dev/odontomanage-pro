#!/usr/bin/env node
/**
 * Aplica as migrations pendentes de db/migrations (em ordem alfabetica).
 *
 *   npm run db:migrate
 *
 * Cada arquivo roda dentro de uma transacao; se falhar, nada daquele arquivo
 * fica aplicado e o comando sai com erro (o deploy na Vercel para ai, antes de
 * publicar a versao nova). Os ja aplicados ficam em `schema_migrations`.
 * Seguro rodar quantas vezes quiser.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './lib/db.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')

const client = await connect()
try {
  await client.query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`)
  // Evita duas execucoes simultaneas (ex: dois deploys ao mesmo tempo).
  await client.query('select pg_advisory_lock(727274)')

  const { rows } = await client.query('select filename from schema_migrations')
  const applied = new Set(rows.map((r) => r.filename))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const pending = files.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('[migrate] banco ja esta atualizado')
  }
  for (const file of pending) {
    const sql = await readFile(path.join(dir, file), 'utf8')
    process.stdout.write(`[migrate] aplicando ${file}... `)
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into schema_migrations (filename) values ($1)', [file])
      await client.query('commit')
      console.log('ok')
    } catch (err) {
      await client.query('rollback')
      console.log('FALHOU')
      throw err
    }
  }
} finally {
  await client.query('select pg_advisory_unlock(727274)').catch(() => {})
  await client.end()
}
