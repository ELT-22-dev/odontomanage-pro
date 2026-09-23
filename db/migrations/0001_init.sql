-- ═══════════════════════════════════════════════════════════════════════════
-- OdontoManage Pro — schema inicial
--
-- Aplicado automaticamente por `npm run db:migrate` (e em todo deploy na
-- Vercel, via `vercel-build`). Cada arquivo em db/migrations roda UMA vez, em
-- ordem alfabetica, e fica registrado na tabela schema_migrations.
--
-- REGRA: nunca edite uma migration que ja rodou em producao. Para mudar o
-- schema, crie um arquivo novo (ex: 0002_adiciona_coluna_x.sql).
--
-- Modelo: uma instalacao = uma clinica. Todos os usuarios da clinica
-- (dentistas, recepcao) enxergam os mesmos pacientes/agenda; o controle de
-- acesso e por papel (admin | staff), nao por "dono" do registro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Usuarios do sistema (equipe da clinica) ────────────────────────────────
create table users (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  password_hash   text not null,
  role            text not null default 'staff' check (role in ('admin', 'staff')),
  active          boolean not null default true,
  -- Protecao contra forca bruta: apos 5 senhas erradas, bloqueia 15 min.
  failed_logins   integer not null default 0,
  locked_until    timestamptz,
  -- Incrementado ao trocar senha / desativar: invalida sessoes abertas.
  session_version integer not null default 1,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index users_email_unique on users (lower(email));

-- ── Dados da clinica (linha unica, id = 1) ──────────────────────────────────
create table clinic_settings (
  id            integer primary key default 1 check (id = 1),
  clinic_name   text not null default 'OdontoManage Pro',
  phone         text,
  address       text,
  logo_data_url text,
  updated_at    timestamptz not null default now()
);

-- ── Pacientes ───────────────────────────────────────────────────────────────
create table patients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  cpf                text,
  rg                 text,
  birth_date         date,
  sex                text,
  marital_status     text,
  profession         text,
  phone              text,
  whatsapp           text,
  email              text,
  address            text,
  city               text,
  state              text,
  zip                text,
  notes              text,
  emergency_contact  text,
  insurance          text,
  insurance_number   text,
  financial_guardian text,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  created_by         uuid references users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index patients_name_idx on patients (lower(name));
create index patients_cpf_digits_idx on patients (regexp_replace(cpf, '\D', '', 'g'));

-- ── Consultas / agenda ──────────────────────────────────────────────────────
create table appointments (
  id               uuid primary key default gen_random_uuid(),
  -- Excluir o paciente remove a agenda dele (consulta sem paciente nao faz sentido).
  patient_id       uuid not null references patients(id) on delete cascade,
  dentist_name     text,
  date             date not null,
  time             text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  type             text not null default 'Consulta',
  room             text,
  notes            text,
  status           text not null default 'scheduled'
                   check (status in ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  google_event_id  text,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index appointments_date_idx on appointments (date, time);
create index appointments_patient_idx on appointments (patient_id);

-- ── Financeiro ──────────────────────────────────────────────────────────────
create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  -- Excluir o paciente NAO apaga o historico financeiro, so desvincula.
  patient_id          uuid references patients(id) on delete set null,
  type                text not null check (type in ('income', 'expense')),
  category            text not null,
  description         text,
  amount              numeric(12, 2) not null check (amount > 0),
  payment_method      text,
  status              text not null default 'paid' check (status in ('paid', 'pending', 'cancelled')),
  installments        integer not null default 1 check (installments >= 1),
  current_installment integer not null default 1 check (current_installment >= 1),
  due_date            date,
  paid_date           date,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index transactions_patient_idx on transactions (patient_id);
create index transactions_due_idx on transactions (due_date);
create index transactions_paid_idx on transactions (paid_date);

-- ── Prontuarios ─────────────────────────────────────────────────────────────
create table medical_records (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT de proposito: prontuario odontologico tem guarda obrigatoria
  -- (CFO). Paciente com prontuario nao pode ser excluido — inative-o.
  patient_id     uuid not null references patients(id) on delete restrict,
  record_type    text not null default 'note'
                 check (record_type in ('note', 'diagnosis', 'prescription', 'treatment')),
  title          text not null,
  content        text,
  diagnosis      text,
  treatment_plan text,
  prescriptions  text,
  created_by     uuid references users(id) on delete set null,
  updated_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index medical_records_patient_idx on medical_records (patient_id, created_at desc);

-- ── Trilha de auditoria (LGPD: quem fez o que, quando) ─────────────────────
create table audit_log (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  user_name  text,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);

insert into clinic_settings (id) values (1);
