#!/usr/bin/env node
/**
 * Cria um usuario administrador ou redefine a senha de um existente.
 * Uso de emergencia (ex: o unico admin esqueceu a senha):
 *
 *   npm run admin:create -- --email dra@clinica.com.br --name "Dra. Ana" --password "SenhaForte123"
 *
 * Se o email ja existir, a senha e redefinida, o usuario e reativado,
 * promovido a admin e as sessoes abertas dele sao encerradas.
 */
import bcrypt from 'bcryptjs'
import { connect } from './lib/db.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]])
    return acc
  }, []),
)

const { email, password } = args
const name = args.name || (email ? email.split('@')[0] : '')
if (!email || !password) {
  console.error('Uso: npm run admin:create -- --email EMAIL --password SENHA [--name NOME]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

const client = await connect()
try {
  const hash = await bcrypt.hash(password, 10)
  const { rows } = await client.query(
    `insert into users (name, email, password_hash, role)
     values ($1, $2, $3, 'admin')
     on conflict ((lower(email))) do update set
       password_hash = excluded.password_hash, role = 'admin', active = true,
       failed_logins = 0, locked_until = null,
       session_version = users.session_version + 1, updated_at = now()
     returning (xmax = 0) as inserted`,
    [name, email.trim().toLowerCase(), hash],
  )
  console.log(rows[0].inserted ? `Administrador ${email} criado.` : `Senha de ${email} redefinida (agora admin).`)
} finally {
  await client.end()
}
