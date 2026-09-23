#!/usr/bin/env node
/**
 * Popula o banco com dados FICTICIOS para demonstracao/treinamento da equipe
 * (pacientes, agenda da semana, financeiro e prontuarios).
 *
 *   npm run db:seed-demo
 *
 * Por seguranca, recusa rodar se ja existir qualquer paciente no banco —
 * NUNCA use em producao com dados reais. Precisa de pelo menos 1 usuario
 * (faca a configuracao inicial em /setup antes).
 */
import { connect } from './lib/db.mjs'

const client = await connect()
try {
  const { rows: existing } = await client.query('select count(*)::int as n from patients')
  if (existing[0].n > 0) {
    console.error('Ja existem pacientes neste banco. Seed de demonstracao cancelado (protecao contra misturar com dados reais).')
    process.exit(1)
  }
  const { rows: users } = await client.query('select id from users order by created_at limit 1')
  const userId = users[0]?.id ?? null

  const tz = 'America/Sao_Paulo'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  const day = (offset) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + offset)
    return d.toISOString().slice(0, 10)
  }

  const patients = [
    ['Ana Beatriz Costa', '(11) 98888-1010', 'F', '1990-04-12', 'Amil Dental'],
    ['Bruno Almeida Santos', '(11) 97777-2020', 'M', '1985-09-02', null],
    ['Camila Ferreira Lima', '(11) 96666-3030', 'F', '2001-01-25', 'SulAmerica Odonto'],
    ['Diego Rodrigues Pereira', '(11) 95555-4040', 'M', '1978-11-30', null],
    ['Eduarda Martins Oliveira', '(11) 94444-5050', 'F', '1995-06-18', 'Amil Dental'],
    ['Felipe Souza Barbosa', '(11) 93333-6060', 'M', '2015-03-08', null],
  ]
  const ids = []
  for (const [name, phone, sex, birth, insurance] of patients) {
    const { rows } = await client.query(
      `insert into patients (name, phone, whatsapp, sex, birth_date, insurance, city, state, created_by)
       values ($1, $2, $2, $3, $4, $5, 'Sao Paulo', 'SP', $6) returning id`,
      [name, phone, sex, birth, insurance, userId],
    )
    ids.push(rows[0].id)
  }

  const appts = [
    [0, -3, '09:00', 'Limpeza', 'completed'],
    [3, -1, '14:30', 'Canal', 'completed'],
    [2, 0, '09:30', 'Avaliacao', 'confirmed'],
    [5, 0, '11:00', 'Consulta', 'scheduled'],
    [1, 0, '15:00', 'Restauracao', 'scheduled'],
    [4, 1, '10:00', 'Ortodontia', 'scheduled'],
    [3, 3, '10:30', 'Canal', 'scheduled'],
  ]
  for (const [p, offset, time, type, status] of appts) {
    await client.query(
      `insert into appointments (patient_id, date, time, type, status, dentist_name, room, created_by)
       values ($1, $2, $3, $4, $5, $6, '1', $7)`,
      [ids[p], day(offset), time, type, status, p % 2 ? 'Dr. Paulo Mendes' : 'Dra. Renata Vieira', userId],
    )
  }

  const txs = [
    [0, 'income', 'Limpeza', 180, 'paid', -3],
    [3, 'income', 'Tratamento de canal', 450, 'paid', -1],
    [null, 'expense', 'Material odontologico', 620, 'paid', -2],
    [null, 'expense', 'Aluguel', 3200, 'paid', -5],
    [2, 'income', 'Avaliacao', 150, 'pending', 0],
    [4, 'income', 'Ortodontia', 320, 'pending', 5],
  ]
  for (const [p, type, category, amount, status, offset] of txs) {
    await client.query(
      `insert into transactions (patient_id, type, category, amount, status, payment_method, due_date, paid_date, created_by)
       values ($1, $2, $3, $4, $5, 'pix', $6, $7, $8)`,
      [p === null ? null : ids[p], type, category, amount, status, day(offset), status === 'paid' ? day(offset) : null, userId],
    )
  }

  await client.query(
    `insert into medical_records (patient_id, record_type, title, content, diagnosis, treatment_plan, created_by, updated_by)
     values ($1, 'diagnosis', 'Diagnostico - dente 36', null, 'Pulpite irreversivel no dente 36.', 'Canal em 3 sessoes + restauracao.', $2, $2),
            ($3, 'note', 'Anamnese inicial', 'Sem alergias. Relata ansiedade odontologica.', null, null, $2, $2)`,
    [ids[3], userId, ids[2]],
  )

  console.log(`Dados de demonstracao criados: ${patients.length} pacientes, ${appts.length} consultas, ${txs.length} lancamentos, 2 prontuarios.`)
} finally {
  await client.end()
}
