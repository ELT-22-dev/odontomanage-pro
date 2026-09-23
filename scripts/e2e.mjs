#!/usr/bin/env node
/**
 * Teste de ponta a ponta da API contra um servidor rodando + banco REAL.
 * Cobre o fluxo completo: configuracao inicial, login, CRUD de todos os
 * modulos, permissoes (admin x equipe), bloqueio por senha errada, sessao
 * derrubada ao trocar senha, auditoria e backup.
 *
 * ATENCAO: cria dados. Rode contra um banco de TESTE vazio, nunca producao.
 *
 *   # terminal 1 (banco de teste vazio + migrations)
 *   DATABASE_URL=postgres://.../odonto_test npm run db:migrate
 *   DATABASE_URL=postgres://.../odonto_test npm run build && DATABASE_URL=... npx next start -p 3100
 *   # terminal 2
 *   E2E_BASE_URL=http://localhost:3100 npm run test:e2e
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const ADMIN = { email: 'admin.e2e@clinica.test', password: 'SenhaForte#2026', name: 'Dra. Teste E2E' }
const STAFF = { email: 'recepcao.e2e@clinica.test', password: 'Recepcao#2026', name: 'Recepcao E2E' }

let passed = 0
let failed = 0

function check(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name} ${extra}`)
  }
}

/** Cliente com "pote de cookies" proprio (simula um navegador). */
function client() {
  let cookie = ''
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) {
      const [pair] = c.split(';')
      if (pair.startsWith('odonto_session=')) cookie = pair.endsWith('=') ? '' : pair
    }
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    return { status: res.status, data, headers: res.headers }
  }
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

async function main() {
  console.log(`E2E contra ${BASE}\n`)
  const admin = client()
  const anon = client()

  console.log('Infra')
  const health = await anon('GET', '/api/health')
  check('health responde e banco conectado', health.status === 200 && health.data.db === true, JSON.stringify(health.data))
  const loginPage = await anon('GET', '/pacientes')
  check('tela protegida sem login redireciona', loginPage.status === 307 || loginPage.status === 302 || loginPage.status === 303, String(loginPage.status))
  check('cabecalho de seguranca X-Frame-Options', loginPage.headers.get('x-frame-options') === 'DENY')

  console.log('\nConfiguracao inicial + login')
  const st = await anon('GET', '/api/auth/setup')
  if (!st.data.needsSetup && process.env.E2E_REUSE !== '1') {
    console.error('\nO banco ja tem usuarios. O E2E cria dados de teste: rode so em banco de TESTE vazio (ou E2E_REUSE=1, conscientemente).')
    process.exit(2)
  }
  if (st.data.needsSetup) {
    const setup = await admin('POST', '/api/auth/setup', { clinic_name: 'Clinica E2E', ...ADMIN })
    check('setup cria o primeiro admin', setup.status === 201, JSON.stringify(setup.data))
  } else {
    const login = await admin('POST', '/api/auth/login', ADMIN)
    check('login do admin existente', login.status === 200, JSON.stringify(login.data))
  }
  const setupAgain = await anon('POST', '/api/auth/setup', { clinic_name: 'Hack', name: 'x', email: 'x@x.com', password: '12345678' })
  check('setup NAO roda de novo depois de configurado', setupAgain.status === 409)
  check('API sem login = 401', (await anon('GET', '/api/patients')).status === 401)
  const me = await admin('GET', '/api/auth/me')
  check('sessao do admin valida', me.status === 200 && me.data.user.role === 'admin')
  const badLogin = await anon('POST', '/api/auth/login', { email: ADMIN.email, password: 'errada' })
  check('senha errada = 401 com mensagem generica', badLogin.status === 401 && /incorretos/.test(badLogin.data.error))
  const csrf = await admin('POST', '/api/patients', { name: 'X' }, { Origin: 'https://site-malicioso.com' })
  check('POST de outra origem bloqueado (CSRF)', csrf.status === 403)

  console.log('\nPacientes')
  const cpf = '529.982.247-25'
  const p = await admin('POST', '/api/patients', { name: 'Maria E2E Silva', cpf, phone: '(11) 98888-7777', birth_date: '1990-04-12', email: '' })
  check('cria paciente', p.status === 201 && p.data.id, JSON.stringify(p.data))
  check('email vazio vira null', p.data.email === null)
  check('data de nascimento sem deslocamento de fuso', p.data.birth_date === '1990-04-12', p.data.birth_date)
  const dup = await admin('POST', '/api/patients', { name: 'Outra', cpf: '52998224725' })
  check('CPF duplicado (mesmo sem pontuacao) = 409', dup.status === 409, JSON.stringify(dup.data))
  const edit = await admin('PATCH', `/api/patients/${p.data.id}`, { name: 'Maria E2E Souza', city: 'Sao Paulo' })
  check('EDITA paciente (faltava na versao antiga)', edit.status === 200 && edit.data.name === 'Maria E2E Souza' && edit.data.city === 'Sao Paulo')
  const got = await admin('GET', `/api/patients/${p.data.id}`)
  check('edicao persistiu no banco', got.data.name === 'Maria E2E Souza' && got.data.usage.records === 0)
  check('id invalido = 404', (await admin('GET', '/api/patients/abc')).status === 404)
  check('validacao: nome obrigatorio = 400', (await admin('POST', '/api/patients', { name: '  ' })).status === 400)
  const imp = await admin('POST', '/api/patients/import', {
    rows: [
      { name: 'Importado Um', cpf: '111.444.777-35', birth_date: '05/03/1985' },
      { name: 'Importado Dois', cpf: '529.982.247-25' },
      { name: 'Importado Tres', email: 'nao-e-email' },
    ],
  })
  check('importacao CSV: insere e pula CPF existente', imp.status === 201 && imp.data.inserted === 2 && imp.data.skipped === 1, JSON.stringify(imp.data))
  const list = await admin('GET', '/api/patients')
  const imported = list.data.find((x) => x.name === 'Importado Um')
  check('importacao converte data DD/MM/AAAA', imported?.birth_date === '1985-03-05', imported?.birth_date)

  console.log('\nAgenda / consultas')
  const a1 = await admin('POST', '/api/appointments', { patient_id: p.data.id, date: today, time: '09:00', duration_minutes: 60, dentist_name: 'Dr. Paulo', type: 'Canal' })
  check('agenda consulta', a1.status === 201 && a1.data.patient_name === 'Maria E2E Souza', JSON.stringify(a1.data))
  const conflict = await admin('POST', '/api/appointments', { patient_id: imported.id, date: today, time: '09:30', dentist_name: 'dr. paulo' })
  check('conflito de horario do mesmo dentista = 409', conflict.status === 409 && conflict.data.conflict === true, JSON.stringify(conflict.data))
  const other = await admin('POST', '/api/appointments', { patient_id: imported.id, date: today, time: '09:30', dentist_name: 'Dra. Renata' })
  check('outro dentista no mesmo horario = permitido', other.status === 201)
  const forced = await admin('POST', '/api/appointments', { patient_id: imported.id, date: today, time: '10:00', dentist_name: 'Dr. Paulo', force: true })
  check('sem conflito logo apos o fim (10:00) = permitido', forced.status === 201)
  const badTime = await admin('POST', '/api/appointments', { patient_id: p.data.id, date: today, time: '25:00' })
  check('horario invalido = 400', badTime.status === 400)
  const moved = await admin('PATCH', `/api/appointments/${a1.data.id}`, { time: '14:00', status: 'confirmed' })
  check('remarca e confirma consulta', moved.status === 200 && moved.data.time === '14:00' && moved.data.status === 'confirmed')
  const range = await admin('GET', `/api/appointments?from=${today}&to=${today}`)
  check('lista por periodo', range.status === 200 && range.data.length === 3, String(range.data.length))
  const byPatient = await admin('GET', `/api/appointments?patient_id=${p.data.id}`)
  check('lista por paciente', byPatient.data.length === 1)
  check('exclui consulta', (await admin('DELETE', `/api/appointments/${forced.data.id}`)).status === 200)

  console.log('\nFinanceiro')
  const t1 = await admin('POST', '/api/transactions', { type: 'income', category: 'Canal', amount: '450,00'.replace(',', '.'), patient_id: p.data.id, payment_method: 'pix' })
  check('lanca receita (paga hoje por padrao)', t1.status === 201 && t1.data.amount === 450 && t1.data.paid_date === today, JSON.stringify(t1.data))
  const t2 = await admin('PATCH', `/api/transactions/${t1.data.id}`, { status: 'pending', due_date: today })
  check('volta para pendente limpa data de pagamento', t2.data.status === 'pending' && t2.data.paid_date === null)
  check('valor zero/negativo = 400', (await admin('POST', '/api/transactions', { type: 'expense', category: 'X', amount: -5 })).status === 400)
  const t3 = await admin('POST', '/api/transactions', { type: 'expense', category: 'Aluguel', amount: 3200, status: 'paid' })
  check('lanca despesa', t3.status === 201)
  const txs = await admin('GET', '/api/transactions')
  check('lista financeiro com nome do paciente', txs.data.some((t) => t.patient_name === 'Maria E2E Souza'))

  console.log('\nProntuario')
  const r1 = await admin('POST', '/api/medical-records', { patient_id: p.data.id, record_type: 'diagnosis', title: 'Pulpite dente 36', diagnosis: 'Pulpite irreversivel' })
  check('cria registro de prontuario', r1.status === 201 && r1.data.created_by_name === ADMIN.name, JSON.stringify(r1.data))
  const r2 = await admin('PATCH', `/api/medical-records/${r1.data.id}`, { treatment_plan: 'Canal em 3 sessoes' })
  check('edita prontuario (registra quem editou)', r2.status === 200 && r2.data.treatment_plan === 'Canal em 3 sessoes' && r2.data.updated_by_name === ADMIN.name)
  check('prontuario sem paciente = 400', (await admin('POST', '/api/medical-records', { title: 'x' })).status === 400)
  const delWithRecord = await admin('DELETE', `/api/patients/${p.data.id}`)
  check('paciente COM prontuario nao pode ser excluido (guarda legal) = 409', delWithRecord.status === 409, JSON.stringify(delWithRecord.data))

  console.log('\nEquipe e permissoes')
  const u = await admin('POST', '/api/users', { ...STAFF, role: 'staff' })
  check('admin cria usuario da equipe', u.status === 201, JSON.stringify(u.data))
  const staff = client()
  check('usuario da equipe faz login', (await staff('POST', '/api/auth/login', STAFF)).status === 200)
  check('equipe ve pacientes', (await staff('GET', '/api/patients')).status === 200)
  check('equipe NAO lista usuarios (403)', (await staff('GET', '/api/users')).status === 403)
  check('equipe NAO exclui paciente (403)', (await staff('DELETE', `/api/patients/${imported.id}`)).status === 403)
  check('equipe NAO baixa backup (403)', (await staff('GET', '/api/backup')).status === 403)
  check('equipe NAO altera dados da clinica (403)', (await staff('PUT', '/api/settings', { clinic_name: 'X' })).status === 403)
  const lastAdmin = await admin('PATCH', `/api/users/${me.data.user.id}`, { role: 'staff' })
  check('nao deixa remover o ultimo admin', lastAdmin.status === 409)
  await admin('PATCH', `/api/users/${u.data.id}`, { active: false })
  check('usuario desativado perde a sessao na hora', (await staff('GET', '/api/patients')).status === 401)
  check('usuario desativado nao entra', (await client()('POST', '/api/auth/login', STAFF)).status === 403)
  await admin('PATCH', `/api/users/${u.data.id}`, { active: true, password: 'NovaSenha#2026' })
  check('admin redefine senha e reativa', (await staff('POST', '/api/auth/login', { email: STAFF.email, password: 'NovaSenha#2026' })).status === 200)

  console.log('\nSeguranca de senha')
  const brute = client()
  for (let i = 0; i < 5; i++) await brute('POST', '/api/auth/login', { email: STAFF.email, password: 'errada' + i })
  const locked = await brute('POST', '/api/auth/login', { email: STAFF.email, password: 'NovaSenha#2026' })
  check('bloqueia apos 5 senhas erradas (429), mesmo com a senha certa', locked.status === 429, String(locked.status))
  const second = client()
  await second('POST', '/api/auth/login', ADMIN)
  const pw = await admin('POST', '/api/auth/password', { current_password: ADMIN.password, new_password: 'OutraSenha#2026' })
  check('troca a propria senha', pw.status === 200)
  check('sessao atual continua valida', (await admin('GET', '/api/auth/me')).status === 200)
  check('OUTRAS sessoes abertas caem', (await second('GET', '/api/auth/me')).status === 401)
  await admin('POST', '/api/auth/password', { current_password: 'OutraSenha#2026', new_password: ADMIN.password })

  console.log('\nClinica, backup e auditoria')
  const s = await admin('PUT', '/api/settings', { clinic_name: 'Clinica Sorriso E2E', phone: '(11) 3333-4444', address: 'Rua A, 1' })
  check('admin salva dados da clinica', s.status === 200 && s.data.clinic_name === 'Clinica Sorriso E2E')
  check('nome da clinica e publico (tela de login)', (await anon('GET', '/api/settings')).data.clinic_name === 'Clinica Sorriso E2E')
  const bk = await admin('GET', '/api/backup')
  check('backup completo em JSON', bk.status === 200 && bk.data.format === 'odontomanage-v1' && bk.data.tables.patients.length >= 3)
  check('backup nao contem senhas', !JSON.stringify(bk.data).includes('password_hash'))
  const audit = await admin('GET', '/api/audit')
  const actions = new Set(audit.data.map((e) => e.action))
  check('auditoria registra login, criacao, edicao, exportacao e falha de login', ['login', 'create', 'update', 'export', 'login_failed'].every((a) => actions.has(a)), [...actions].join(','))

  console.log('\nAssistente de IA')
  const ai = await admin('GET', '/api/ai/status')
  check('status da IA responde', ai.status === 200 && typeof ai.data.configured === 'boolean')
  check('IA vem desligada por padrao', ai.data.enabled === false)
  check('equipe NAO liga a IA (403)', (await staff('PUT', '/api/ai/status', { enabled: true })).status === 403)
  if (!ai.data.configured) {
    check('sem chave: ligar a IA e recusado (409)', (await admin('PUT', '/api/ai/status', { enabled: true })).status === 409)
    check('sem chave: usar a IA responde 503', (await admin('POST', '/api/ai/structure-note', { text: 'paciente com dor no dente 36' })).status === 503)
  } else if (process.env.E2E_AI === '1') {
    // So com E2E_AI=1: faz chamadas a API da Anthropic (reais ou mockadas).
    await admin('PUT', '/api/ai/status', { enabled: true })
    const note = await admin('POST', '/api/ai/structure-note', { text: 'Pcte com dor no 36, carie profunda. Indicado canal. Ibuprofeno 400mg 8/8h 3 dias.' })
    check('IA organiza anotacao em campos', note.status === 200 && typeof note.data.content === 'string' && 'prescriptions' in note.data, JSON.stringify(note.data))
    const sum = await admin('POST', '/api/ai/patient-summary', { patient_id: p.data.id })
    check('IA resume historico do paciente', sum.status === 200 && typeof sum.data.summary === 'string' && Array.isArray(sum.data.alerts), JSON.stringify(sum.data))
    check('texto curto demais = 400', (await admin('POST', '/api/ai/structure-note', { text: 'oi' })).status === 400)
    await admin('PUT', '/api/ai/status', { enabled: false })
    check('IA desligada = 403 ao usar', (await admin('POST', '/api/ai/structure-note', { text: 'paciente com dor no dente 36' })).status === 403)
  }

  console.log('\nLimpeza de consistencia')
  await admin('DELETE', `/api/medical-records/${r1.data.id}`)
  const delOk = await admin('DELETE', `/api/patients/${p.data.id}`)
  check('sem prontuario, admin exclui paciente', delOk.status === 200)
  const orphanTx = (await admin('GET', '/api/transactions')).data.find((t) => t.id === t1.data.id)
  check('financeiro do paciente excluido e mantido (desvinculado)', orphanTx && orphanTx.patient_id === null)
  check('logout', (await admin('POST', '/api/auth/logout')).status === 200 && (await admin('GET', '/api/auth/me')).status === 401)

  console.log(`\n${passed} ok, ${failed} falha(s)`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
