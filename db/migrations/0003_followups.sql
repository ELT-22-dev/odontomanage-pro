-- ═══════════════════════════════════════════════════════════════════════════
-- Follow-up de pacientes
--
-- followups       — a fila de contatos a fazer (um por paciente/motivo/data).
-- followup_rules  — regras que criam follow-ups sozinhas quando uma consulta
--                   e FINALIZADA (ex.: Extracao → contato em +1 e +7 dias).
-- clinic_settings — textos-modelo das mensagens e "paciente sumido" (meses).
-- ═══════════════════════════════════════════════════════════════════════════

create table followup_rules (
  id                  uuid primary key default gen_random_uuid(),
  -- Casa com o "procedimento" da consulta, sem diferenciar maiusculas e por
  -- trecho: 'extra' pega "Extracao", "Extracao siso"...
  appointment_type    text not null,
  kind                text not null check (kind in ('recall', 'post_procedure', 'quote')),
  days_after          integer not null check (days_after between 0 and 1095),
  reason              text not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table followups (
  id              uuid primary key default gen_random_uuid(),
  -- Excluir o paciente apaga os follow-ups dele (nao ha o que acompanhar).
  patient_id      uuid not null references patients(id) on delete cascade,
  kind            text not null check (kind in ('recall', 'post_procedure', 'quote', 'reactivation', 'other')),
  due_date        date not null,
  reason          text not null,
  status          text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  -- Resultado do ultimo contato.
  outcome         text check (outcome in ('contacted', 'scheduled', 'no_answer', 'declined')),
  notes           text,
  attempts        integer not null default 0,
  last_contact_at timestamptz,
  -- De onde veio (consulta que gerou / regra aplicada) — para nao duplicar.
  appointment_id  uuid references appointments(id) on delete set null,
  rule_id         uuid references followup_rules(id) on delete set null,
  created_by      uuid references users(id) on delete set null,
  completed_by    uuid references users(id) on delete set null,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index followups_queue_idx on followups (status, due_date);
create index followups_patient_idx on followups (patient_id);
-- Uma regra gera no maximo um follow-up por consulta (finalizar duas vezes nao duplica).
create unique index followups_rule_once on followups (appointment_id, rule_id) where rule_id is not null;
-- Uma falta gera no maximo um follow-up de reagendamento por consulta.
create unique index followups_noshow_once on followups (appointment_id) where kind = 'reactivation' and appointment_id is not null;

alter table clinic_settings add column followup_templates jsonb not null default '{}'::jsonb;
alter table clinic_settings add column inactive_months integer not null default 12 check (inactive_months between 1 and 60);

-- Regras iniciais (a clinica ajusta em Configuracoes → Follow-up).
insert into followup_rules (appointment_type, kind, days_after, reason) values
  ('extra',    'post_procedure', 1,   'Pos-extracao: como esta a recuperacao?'),
  ('extra',    'post_procedure', 7,   'Pos-extracao: revisao de 7 dias'),
  ('canal',    'post_procedure', 2,   'Pos-tratamento de canal: dor ou sensibilidade?'),
  ('implante', 'post_procedure', 1,   'Pos-implante: como esta a recuperacao?'),
  ('implante', 'post_procedure', 7,   'Pos-implante: revisao de 7 dias'),
  ('cirurg',   'post_procedure', 1,   'Pos-cirurgia: como esta a recuperacao?'),
  ('clarea',   'post_procedure', 3,   'Pos-clareamento: sensibilidade?'),
  ('limpeza',  'recall',         180, 'Retorno semestral de limpeza'),
  ('profilax', 'recall',         180, 'Retorno semestral de limpeza'),
  ('ortodon',  'recall',         30,  'Manutencao mensal do aparelho'),
  ('avalia',   'quote',          5,   'Retorno sobre o orcamento / plano de tratamento');
