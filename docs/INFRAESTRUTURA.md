# OdontoManage Pro — Documento de Infraestrutura e Manutenção

> **Para quem é:** o(a) desenvolvedor(a) fullstack que vai implantar, manter e evoluir o sistema.
> Depois de ler, você deve conseguir: subir o projeto localmente, fazer deploy, entender cada
> peça, diagnosticar os problemas mais comuns e adicionar uma funcionalidade nova sem quebrar nada.

**Sumário**

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack e versões](#3-stack-e-versões)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Banco de dados](#5-banco-de-dados)
6. [Autenticação, permissões e segurança](#6-autenticação-permissões-e-segurança)
7. [Referência da API](#7-referência-da-api)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Rodando localmente](#9-rodando-localmente)
10. [Deploy em produção (Vercel + Neon)](#10-deploy-em-produção-vercel--neon)
11. [Backup e restauração](#11-backup-e-restauração)
12. [Monitoramento e logs](#12-monitoramento-e-logs)
13. [Testes e CI](#13-testes-e-ci)
14. [Receita: adicionar uma funcionalidade](#14-receita-adicionar-uma-funcionalidade)
15. [Solução de problemas (runbook)](#15-solução-de-problemas-runbook)
16. [LGPD e dados de saúde](#16-lgpd-e-dados-de-saúde)
17. [Custos](#17-custos)
18. [Checklist de entrega para a clínica](#18-checklist-de-entrega-para-a-clínica)

---

## 1. Visão geral

Sistema web de gestão para **uma** clínica odontológica: pacientes, agenda, consultas,
financeiro, prontuário, equipe (usuários) e auditoria.

- **Uma instalação = uma clínica.** Todos os usuários da clínica veem os mesmos dados. O controle
  de acesso é por papel (`admin` / `staff`), não por "dono" do registro. Para atender outra
  clínica, faça **outro deploy com outro banco** (é o jeito mais simples e isola os dados de saúde
  de cada uma).
- **Um repositório, um deploy.** Frontend e backend (API) estão no mesmo projeto Next.js e sobem
  juntos na Vercel a cada `git push`.
- **Sem serviços pagos obrigatórios.** Só Vercel (hospedagem) + Neon (PostgreSQL). Google Calendar
  e WhatsApp são opcionais e gratuitos.

## 2. Arquitetura

```mermaid
flowchart LR
  subgraph Navegador["Navegador (recepção / dentista)"]
    UI["Telas React<br/>src/app/(app)/*"]
    RQ["React Query<br/>src/hooks/queries.ts"]
    GC["Google Calendar (opcional)<br/>src/lib/googleCalendar.ts"]
  end

  subgraph Vercel["Vercel — um único projeto Next.js"]
    PX["proxy.ts<br/>(sem cookie → /login)"]
    LY["Layout (app)<br/>valida sessão no servidor"]
    API["API Routes<br/>src/app/api/**/route.ts"]
    SRV["Camada servidor<br/>src/server/*<br/>auth · schemas (zod) · repos (SQL)"]
  end

  DB[("Neon PostgreSQL<br/>tabelas + audit_log")]
  G["Google Calendar API"]
  W["wa.me (WhatsApp)"]

  UI --> RQ -->|"fetch /api/* (cookie httpOnly)"| API
  UI -. navegação .-> PX --> LY
  API --> SRV -->|"SQL parametrizado (pg)"| DB
  LY --> SRV
  GC -->|"OAuth no navegador"| G
  UI -->|"link com texto pronto"| W
```

**Fluxo de uma ação típica (ex.: salvar paciente):**

1. A tela (`PatientForm.tsx`) chama `api.post('/api/patients', dados)` (`src/lib/api.ts`).
2. A rota `src/app/api/patients/route.ts` roda no servidor:
   `requireUser()` (sessão válida?) → `readBody(req, createPatientSchema)` (validação zod) →
   regra de negócio (CPF duplicado?) → `createPatient()` (SQL em `src/server/repos/patients.ts`) →
   `audit()` (registra na trilha) → responde JSON.
3. Qualquer erro vira `{ "error": "mensagem em português" }` com o status HTTP certo
   (wrapper `route()` em `src/server/http.ts`), e a tela mostra essa mensagem num toast.
4. A tela invalida o cache do React Query (`invalidate(keys.patients)`) e a lista recarrega.

**Por que assim:** tudo que é regra de negócio e acesso a dados fica em `src/server` (código que
nunca vai para o navegador — protegido pelo pacote `server-only`). As telas só conversam com a
API. Isso deixa claro onde mexer: bug de dado/regra → `src/server`; bug visual → `src/app` e
`src/components`.

## 3. Stack e versões

| Camada | Tecnologia | Onde |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript 5.9 | `src/app` |
| Estilo | Tailwind CSS 4 + componentes shadcn/ui (Radix) | `src/app/globals.css`, `src/components/ui` |
| Dados no front | TanStack React Query 5 | `src/hooks/queries.ts` |
| Backend | API Routes do Next.js (Node.js runtime) | `src/app/api` |
| Banco | **PostgreSQL 16** (produção: **Neon**) via driver `pg` | `src/server/db.ts` |
| Validação | zod 4 | `src/server/schemas.ts` |
| Auth | bcryptjs (senhas) + jose (JWT em cookie httpOnly) | `src/server/auth.ts` |
| Gráficos | Recharts | Dashboard, Financeiro |
| Testes | Vitest (unitários) + script E2E com banco real | `src/**/*.test.ts`, `scripts/e2e.mjs` |
| Hospedagem | **Vercel** | — |

Node.js **20.9+** (recomendado 22). Não há ORM de propósito: o SQL está escrito à mão, em
poucos arquivos, e qualquer fullstack lê e altera sem aprender uma ferramenta nova.

## 4. Estrutura de pastas

```
db/migrations/           SQL versionado do banco (0001_init.sql, 0002_..., ...)
scripts/
  migrate.mjs            aplica migrations pendentes (roda em todo deploy)
  create-admin.mjs       cria admin / redefine senha (emergência)
  seed-demo.mjs          dados fictícios para treinamento (recusa se houver pacientes)
  e2e.mjs                teste de ponta a ponta da API contra servidor + banco reais
src/
  proxy.ts               barreira inicial: sem cookie de sessão → /login?next=...
  app/
    layout.tsx           HTML raiz, fontes, tema claro/escuro
    providers.tsx        React Query, tooltips, toasts
    login/  setup/       telas públicas (entrar / configuração inicial)
    (app)/               TODAS as telas logadas — layout.tsx valida a sessão no servidor
      page.tsx           Dashboard
      pacientes/         lista, novo, [id] (ficha), [id]/editar
      agenda/ consultas/ financeiro/ prontuarios/ configuracoes/
    api/                 backend — um arquivo route.ts por recurso (ver seção 7)
  server/                SÓ SERVIDOR (import 'server-only')
    env.ts               leitura/validação das variáveis de ambiente
    db.ts                pool do Postgres, query(), transaction(), helpers de INSERT/UPDATE
    http.ts              route() (erros → JSON), readBody(), HttpError, parseId()
    auth.ts              senha, cookie de sessão, getSession/requireUser/requireAdmin, bloqueio
    audit.ts             grava na tabela audit_log
    schemas.ts           TODOS os schemas zod de entrada da API
    repos/               SQL por entidade: patients, appointments, transactions, records, users
  components/            componentes de tela (diálogos de criar/editar, linhas, shell, menu)
    ui/                  componentes base (botão, input, dialog, select...)
    settings/            seções da tela de Configurações
  hooks/                 queries.ts (leituras), useAppointmentActions, useDialog, ...
  lib/                   código compartilhado: tipos, datas, formatação BR, finanças, CSV, WhatsApp
```

## 5. Banco de dados

### 5.1 Modelo

```mermaid
erDiagram
  users ||--o{ patients : "created_by"
  users ||--o{ medical_records : "created_by / updated_by"
  users ||--o{ audit_log : "user_id"
  patients ||--o{ appointments : "CASCADE"
  patients ||--o{ transactions : "SET NULL"
  patients ||--o{ medical_records : "RESTRICT"

  users {
    uuid id PK
    text name
    text email "unico, sem diferenciar maiusculas"
    text password_hash "bcrypt"
    text role "admin | staff"
    bool active
    int failed_logins
    timestamptz locked_until
    int session_version "incrementa para derrubar sessoes"
  }
  clinic_settings {
    int id PK "sempre 1"
    text clinic_name
    text phone
    text address
    text logo_data_url
  }
  patients {
    uuid id PK
    text name
    text cpf
    date birth_date
    text phone_whatsapp_email_etc
    text status "active | inactive"
  }
  appointments {
    uuid id PK
    uuid patient_id FK
    date date
    text time "HH:MM"
    int duration_minutes
    text dentist_name
    text status "scheduled a no_show"
    text google_event_id
  }
  transactions {
    uuid id PK
    uuid patient_id FK "nullable"
    text type "income | expense"
    numeric amount "12 digitos, 2 decimais"
    text status "paid | pending | cancelled"
    date due_date
    date paid_date
  }
  medical_records {
    uuid id PK
    uuid patient_id FK
    text record_type "note|diagnosis|prescription|treatment"
    text title
    text content_diagnosis_plan_rx
  }
  audit_log {
    bigserial id PK
    uuid user_id
    text action
    text entity
    jsonb details
    text ip
  }
```

Definição completa, com comentários: [`db/migrations/0001_init.sql`](../db/migrations/0001_init.sql).

**Decisões importantes (não mude sem entender):**

| Regra | Por quê |
|---|---|
| `medical_records.patient_id ... ON DELETE RESTRICT` | Prontuário odontológico tem guarda obrigatória (CFO). Paciente com prontuário **não pode** ser excluído — a API devolve 409 e a tela sugere marcar como inativo. |
| `appointments ... ON DELETE CASCADE` | Consulta sem paciente não faz sentido. |
| `transactions ... ON DELETE SET NULL` | O histórico financeiro da clínica não pode sumir quando um paciente é excluído. |
| Datas de calendário são `date` e voltam como **texto** `'AAAA-MM-DD'` | O driver `pg` converteria para `Date` em UTC e "voltaria um dia" no Brasil. Ver `types.setTypeParser` em `src/server/db.ts`. |
| `time` é texto `'HH:MM'` com CHECK | Simples, ordenável, sem fuso. |
| Usuários nunca são excluídos, só desativados | A auditoria e os prontuários referenciam quem fez. |
| "Hoje" é calculado no fuso `America/Sao_Paulo` | O servidor da Vercel roda em UTC; ver `src/lib/dates.ts`. |

### 5.2 Migrations (como mudar o banco)

- Cada arquivo em `db/migrations/` roda **uma única vez**, em ordem alfabética, dentro de uma
  transação. Os já aplicados ficam na tabela `schema_migrations`.
- Rodam **automaticamente em todo deploy** na Vercel (script `vercel-build` no `package.json`).
  Se uma migration falhar, o deploy é abortado e a versão anterior continua no ar.
- Localmente: `npm run db:migrate`.

**Regra de ouro:** nunca edite um arquivo de migration que já rodou em produção. Crie o próximo:

```sql
-- db/migrations/0002_adiciona_convenio_em_consulta.sql
alter table appointments add column insurance text;
```

Prefira mudanças **compatíveis com a versão anterior** (adicionar coluna nullable, criar tabela).
Para renomear/remover coluna, faça em dois deploys: primeiro o código para de usar, depois a
migration remove.

## 6. Autenticação, permissões e segurança

### 6.1 Login e sessão

- Não existe cadastro público. O **primeiro acesso** a uma instalação nova abre `/setup`, que cria
  o administrador e o nome da clínica — e só funciona enquanto não há nenhum usuário (há um lock
  na tabela para evitar corrida).
- Depois disso, **o admin cria os usuários** da equipe em Configurações → Equipe.
- Senha: bcrypt (custo 10), mínimo 8 caracteres.
- Sessão: JWT HS256 assinado com `AUTH_SECRET`, num cookie `odonto_session`
  (`httpOnly`, `secure` em produção, `SameSite=Lax`), duração `SESSION_HOURS` (padrão 12h).
- **A cada requisição o usuário é relido do banco**: desativar um usuário ou trocar a senha
  (que incrementa `session_version`) derruba as sessões dele imediatamente.
- **Bloqueio contra força bruta:** 5 senhas erradas → conta bloqueada por 15 minutos (HTTP 429).
- **Esqueci a senha:** não há envio de email (evita depender de serviço externo). O admin redefine
  em Configurações → Equipe. Se o **único admin** esqueceu: `npm run admin:create` (seção 15).

### 6.2 Papéis

| Ação | staff (Equipe) | admin |
|---|:-:|:-:|
| Pacientes, agenda, consultas, financeiro, prontuário — ver, criar, editar | ✅ | ✅ |
| Importar pacientes (CSV), exportar CSV | ✅ | ✅ |
| **Excluir** paciente / **excluir** prontuário | ❌ | ✅ |
| Dados da clínica (nome, logo), equipe, backup completo, auditoria | ❌ | ✅ |

As permissões são checadas **na API** (`requireAdmin()`), não só escondidas na tela.

### 6.3 Outras proteções

- Todo SQL é parametrizado (`$1, $2`). Nomes de coluna em INSERT/UPDATE vêm de listas fixas
  (`PATIENT_COLUMNS` etc.), nunca do usuário.
- Toda entrada passa por zod (`src/server/schemas.ts`) — tamanhos máximos, formatos, enums.
- Requisições de escrita vindas de outra origem são recusadas (checagem de `Origin`, além do
  `SameSite`).
- Cabeçalhos: `X-Frame-Options: DENY`, `nosniff`, HSTS, `noindex` (em `next.config.ts`).
- `robots.txt` bloqueia indexação.
- Erros internos não vazam detalhes para o navegador (vão para o log do servidor).

## 7. Referência da API

Todas as rotas exigem login (cookie), exceto as marcadas como públicas. Respostas de erro:
`{ "error": "mensagem" }`. Códigos: `400` dados inválidos · `401` sem sessão · `403` sem
permissão/origem · `404` não encontrado · `409` conflito (duplicado, vínculo, horário) ·
`429` bloqueado · `500` erro interno.

| Método e rota | Quem | O que faz |
|---|---|---|
| `GET /api/health` | público | `{ok, db}` — monitoramento |
| `GET /api/settings` | público | nome/logo/contato da clínica |
| `PUT /api/settings` | admin | salva dados da clínica |
| `GET /api/auth/setup` | público | `{needsSetup}` |
| `POST /api/auth/setup` | público, 1x | cria o 1º admin + nome da clínica |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | — | sessão |
| `PATCH /api/auth/profile` | todos | nome/email próprios |
| `POST /api/auth/password` | todos | troca a própria senha (derruba outras sessões) |
| `GET/POST /api/patients` | todos | lista / cria (409 se CPF duplicado) |
| `GET/PATCH /api/patients/:id` | todos | ficha (+ contagem de vínculos) / edita |
| `DELETE /api/patients/:id` | admin | exclui (409 se tem prontuário) |
| `POST /api/patients/import` | todos | importação em massa (pula CPF existente) |
| `GET /api/appointments?from&to&patient_id` | todos | lista (filtros opcionais) |
| `POST /api/appointments` | todos | agenda (409 + `conflict:true` se o dentista já tem horário; reenviar com `force:true` para encaixe) |
| `PATCH/DELETE /api/appointments/:id` | todos | remarca, muda status / exclui |
| `GET /api/dentists` | todos | nomes de dentistas já usados (sugestões) |
| `GET/POST /api/transactions?patient_id` | todos | financeiro |
| `PATCH/DELETE /api/transactions/:id` | todos | edita / exclui |
| `GET/POST /api/medical-records?patient_id` | todos | prontuário |
| `GET/PATCH /api/medical-records/:id` | todos | ver / editar (registra quem editou) |
| `DELETE /api/medical-records/:id` | admin | exclui |
| `GET/POST /api/users` · `PATCH /api/users/:id` | admin | equipe (não deixa remover o último admin) |
| `GET /api/backup` | admin | JSON com todos os dados clínicos (sem senhas) |
| `GET /api/audit` | admin | últimas 300 ações |

## 8. Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|:-:|---|
| `DATABASE_URL` | ✅ | String de conexão do Postgres. No Neon, use a **pooled** (host com `-pooler`) com `?sslmode=require`. |
| `AUTH_SECRET` | ✅ | Segredo das sessões, ≥ 32 caracteres aleatórios. Gerar: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **Trocar desloga todo mundo** (use em caso de vazamento). |
| `SESSION_HOURS` | — | Duração da sessão (padrão 12). |
| `NEXT_PUBLIC_TIMEZONE` | — | Fuso da clínica (padrão `America/Sao_Paulo`). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | — | Ativa a integração com Google Calendar (seção 10.4). |

Local: arquivo `.env.local` (modelo em `.env.example`, **nunca commitar**). Produção: painel da
Vercel → Project → Settings → Environment Variables. Variáveis `NEXT_PUBLIC_*` exigem **novo
deploy** para valer.

## 9. Rodando localmente

Pré-requisitos: Node.js 22, PostgreSQL 16 (local, Docker ou um branch do Neon).

```bash
npm install
cp .env.example .env.local        # preencha DATABASE_URL e AUTH_SECRET
npm run db:migrate                # cria as tabelas
npm run dev                       # http://localhost:3000 → abre a configuração inicial
npm run db:seed-demo              # (opcional) dados fictícios, depois de criar o admin
```

Postgres rápido com Docker:
`docker run -d --name odonto-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=odonto -p 5432:5432 postgres:16`
→ `DATABASE_URL=postgres://postgres:postgres@localhost:5432/odonto`

Comandos do dia a dia:

```bash
npm run dev          # desenvolvimento
npm run check        # tipos + lint + testes unitários (rode antes de todo commit)
npm run build        # build de produção
npm run test:e2e     # E2E (ver seção 13 — use banco de TESTE)
```

## 10. Deploy em produção (Vercel + Neon)

### 10.1 Banco (Neon)

1. Crie uma conta em [neon.tech](https://neon.tech) → **New Project** → região **São Paulo
   (aws-sa-east-1)** (mais perto da clínica = mais rápido) → Postgres 16.
2. Em **Connection Details**, marque **Pooled connection** e copie a string
   (`postgresql://...-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`).
3. Em **Settings → Backup & Restore**, confira a janela de restauração (history retention).
   No plano pago, aumente para 7–30 dias (seção 11).

> Alternativa equivalente: na Vercel, **Storage → Create Database → Neon** cria o banco e já
> preenche `DATABASE_URL` no projeto.

### 10.2 Aplicação (Vercel)

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório do GitHub.
2. Framework: Next.js (detectado). Build Command: deixe o padrão — o `package.json` tem
   `vercel-build`, que a Vercel usa automaticamente (**roda as migrations e depois o build**).
3. **Environment Variables** (Production): `DATABASE_URL`, `AUTH_SECRET` (e as opcionais).
4. **Deploy.** Ao terminar, abra a URL → a tela de **configuração inicial** aparece → crie o
   administrador da clínica.
5. Settings → **Functions → Region**: escolha **São Paulo (gru1)**, mesma região do banco.

> **Previews:** cada Pull Request gera uma URL de preview. **Não use o banco de produção em
> Preview** (as migrations rodariam nele antes do merge). Defina `DATABASE_URL` só no ambiente
> *Production*, e para *Preview* use um branch do Neon (a integração Neon da Vercel faz isso
> automaticamente).

### 10.3 Domínio próprio (opcional)

Vercel → Project → Settings → Domains → adicione `sistema.suaclinica.com.br` e crie o registro
CNAME indicado no DNS do domínio. HTTPS é automático.

### 10.4 Google Calendar (opcional)

1. [console.cloud.google.com](https://console.cloud.google.com) → novo projeto → **APIs & Services
   → Library** → ative **Google Calendar API**.
2. **OAuth consent screen**: tipo External; preencha nome/emails; adicione os emails da clínica
   em *Test users* (ou publique o app).
3. **Credentials → Create credentials → OAuth client ID → Web application** →
   *Authorized JavaScript origins*: `https://SEU-DOMINIO` (e `http://localhost:3000` para dev).
4. Copie o Client ID para `NEXT_PUBLIC_GOOGLE_CLIENT_ID` na Vercel e faça **Redeploy**.

Funciona no navegador de cada usuário (Configurações → Integrações → Conectar); o token dura ~1h.
Falha na sincronização **nunca** impede salvar a consulta.

### 10.5 Fluxo de atualização (depois da entrega)

```
branch → commit → git push → Pull Request (CI roda) → merge na main → Vercel publica sozinha
```

Deu problema depois do deploy? Vercel → Deployments → versão anterior → **Promote to Production**
(rollback em segundos). Se a versão nova tinha migration, o rollback de código funciona desde que
a migration tenha sido compatível (seção 5.2).

## 11. Backup e restauração

| Camada | O quê | Como restaurar |
|---|---|---|
| **Principal** | Neon guarda o histórico do banco (Point-in-Time Restore) | Neon → Branches → **Restore** para data/hora antes do problema (ou cria um branch naquele ponto para conferir antes). |
| Cópia lógica periódica | `pg_dump` (recomendado semanal, guardado fora do Neon) | `pg_restore` / `psql` num banco novo. |
| Cópia pelo sistema | Configurações → Dados → **Baixar backup completo** (JSON, admin) | É uma exportação para conferência/portabilidade; não há importação automática. |

Dump manual:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner -f odonto-$(date +%F).dump
pg_restore --no-owner -d "$NOVO_DATABASE_URL" odonto-AAAA-MM-DD.dump
```

> O arquivo de backup contém **dados de saúde**: guarde criptografado e com acesso restrito.

## 12. Monitoramento e logs

- **Saúde:** `GET https://SEU-DOMINIO/api/health` → `{"ok":true,"db":true}`. Cadastre num
  monitor gratuito (UptimeRobot, Better Stack) com alerta por email/WhatsApp.
- **Logs de erro:** Vercel → Project → **Logs** (filtre por `[api]`). Todo erro 500 é logado
  com método e rota.
- **Auditoria (quem fez o quê):** Configurações → Auditoria (admin), ou SQL:
  `select * from audit_log order by created_at desc limit 100;`
- **Banco:** Neon → Monitoring (conexões, armazenamento, CPU).

## 13. Testes e CI

| Tipo | Comando | O que cobre |
|---|---|---|
| Tipos | `npm run typecheck` | TypeScript estrito em todo o projeto |
| Lint | `npm run lint` | regras do Next.js + React Hooks |
| Unitários | `npm test` | datas/fuso, cálculos do financeiro, CPF/telefone, importação CSV |
| **Ponta a ponta** | `npm run test:e2e` | 60 verificações: setup, login, CRUD de tudo, conflito de agenda, permissões admin×equipe, bloqueio de senha, sessões derrubadas, CSRF, backup, auditoria — contra servidor **e banco reais** |

Para rodar o E2E local (em um banco **de teste vazio**, nunca o de produção):

```bash
DATABASE_URL=postgres://.../odonto_test npm run db:migrate
DATABASE_URL=postgres://.../odonto_test npm run build
DATABASE_URL=postgres://.../odonto_test npx next start -p 3100 &
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso — inclusive o E2E com um Postgres
descartável — em cada push e Pull Request. **CI vermelho = não faça merge.**

## 14. Receita: adicionar uma funcionalidade

Exemplo: adicionar "Convênio" na consulta.

1. **Banco:** `db/migrations/0002_convenio_consulta.sql` → `alter table appointments add column insurance text;`
   → `npm run db:migrate`.
2. **Tipo:** `src/lib/types.ts` → `insurance: string | null` em `Appointment`.
3. **Validação:** `src/server/schemas.ts` → adicionar em `APPOINTMENT_COLUMNS` e em
   `appointmentFields` (`insurance: optText(100)`).
4. **SQL:** nada a fazer se a coluna entra em `select a.*` (é o caso). Para regra nova, edite
   `src/server/repos/appointments.ts`.
5. **Tela:** campo em `src/components/AppointmentDialog.tsx` (estado `FormState` + input) e
   exibição em `AppointmentRow.tsx`.
6. **Teste:** acrescente um `check(...)` em `scripts/e2e.mjs`.
7. `npm run check` → PR → CI verde → merge.

Nova entidade inteira (ex.: "Orçamentos"): copie o padrão de `transactions` —
migration → `repos/xxx.ts` → schemas → `app/api/xxx/route.ts` e `[id]/route.ts` (sempre com
`route()`, `requireUser()`, `readBody()` e `audit()`) → hook em `hooks/queries.ts` → tela em
`app/(app)/xxx/page.tsx` → item no menu (`components/AppSidebar.tsx`).

**Convenções:** textos de interface sem acento (padrão herdado do projeto); datas sempre via
`src/lib/dates.ts` (nunca `new Date().toISOString().slice(0,10)`); valores monetários via
`formatCurrency`; nenhuma consulta ao banco fora de `src/server`.

## 15. Solução de problemas (runbook)

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tela "Algo deu errado" / erro 500 | Exceção no servidor | Vercel → Logs, procure `[api]`. Reproduza local com o mesmo dado. |
| `/api/health` → `db:false` / 503 | Banco fora ou `DATABASE_URL` errada | Neon → status do projeto (plano grátis "dorme" e acorda em ~1s; se persistir, verifique limite de cota). Confira a variável na Vercel. |
| Todo mundo deslogado de repente | `AUTH_SECRET` mudou | Esperado se foi trocado. Senão, confira a variável. |
| "Muitas tentativas" no login | 5 senhas erradas | Espere 15 min, ou o admin redefine a senha da pessoa (zera o bloqueio). |
| O **único admin** esqueceu a senha | — | Numa máquina com acesso ao banco: `DATABASE_URL="<produção>" npm run admin:create -- --email email@clinica.com --password "NovaSenha123"` |
| Deploy falhou em "migrate" | Erro de SQL na migration nova | Veja o log do build; o site anterior continua no ar. Corrija o arquivo (ainda não aplicado) e faça novo push. |
| Consulta aparece no dia errado | Código novo usando UTC | Use `todayISO()` / `formatDate()` de `src/lib/dates.ts`. |
| Não consigo excluir paciente | Tem prontuário (guarda legal) | Comportamento correto. Marque como inativo em Editar. |
| "Conectar Google Calendar" não faz nada / erro de origem | Client ID ausente ou origem não autorizada | Seção 10.4; após mudar variável, redeploy. |
| Importação CSV ignora linhas | Linhas sem nome, ou CPF já cadastrado | A mensagem final informa quantas foram puladas. |
| Build local falha com `DATABASE_URL não configurada` | `.env.local` ausente | O build não precisa de banco; esse erro vem de rodar `start`/`dev`. Crie o `.env.local`. |

## 16. LGPD e dados de saúde

Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 5º, II e art. 11). O sistema ajuda com:

- acesso só com login individual (sem conta compartilhada) e papéis;
- trilha de auditoria de criação/edição/exclusão/exportação/login (tabela `audit_log`);
- conexão criptografada (HTTPS e SSL até o banco), senhas com bcrypt;
- exportação de dados (CSV de pacientes, CSV do financeiro, backup JSON completo) para atender pedidos do titular;
- prontuário não pode ser apagado junto com o paciente (guarda obrigatória).

**Responsabilidades da clínica (não técnicas):** termo de consentimento/aviso de privacidade ao
paciente, contrato com os operadores (Vercel, Neon — ambos oferecem DPA), política de senhas da
equipe, desativar o acesso de quem sai da clínica no mesmo dia, e guardar backups em local seguro.

## 17. Custos

| Serviço | Grátis cobre? | Recomendado para produção |
|---|---|---|
| Vercel | Plano Hobby é **só para uso não comercial** | **Pro** (≈ US$ 20/mês) para uma clínica em operação |
| Neon | Free: armazenamento pequeno e janela de restauração curta | Plano pago de entrada (**Launch**, cobrado por uso — para uma clínica costuma ficar em poucas dezenas de dólares/mês) com restauração de 7+ dias |
| Domínio `.com.br` | — | ≈ R$ 40/ano (registro.br) |
| Google Calendar, WhatsApp (links) | ✅ | — |

(Valores de referência — confira as páginas de preço antes de fechar com a clínica.)

## 18. Checklist de entrega para a clínica

- [ ] Banco Neon criado em São Paulo, plano com restauração ≥ 7 dias
- [ ] Projeto Vercel com `DATABASE_URL` e `AUTH_SECRET` **só em Production**; região `gru1`
- [ ] Deploy verde; `/api/health` responde `{"ok":true,"db":true}`
- [ ] Configuração inicial feita com o email do responsável da clínica (admin)
- [ ] Dados da clínica (nome, logo, telefone, endereço) preenchidos
- [ ] Usuários da equipe criados; cada um trocou a senha inicial
- [ ] Pacientes antigos importados via CSV (se houver) e conferidos por amostragem
- [ ] Teste real feito junto com a clínica: cadastrar paciente, agendar, registrar prontuário, lançar pagamento, recarregar a página e ver que continua lá
- [ ] Domínio próprio apontado (opcional) e Google Calendar configurado (opcional)
- [ ] Monitor de uptime em `/api/health`
- [ ] Primeiro `pg_dump` guardado em local seguro
- [ ] Clínica recebeu o [Manual do Usuário](MANUAL-DO-USUARIO.md) e as credenciais de admin **por canal seguro**
- [ ] Acessos (GitHub, Vercel, Neon) transferidos/compartilhados com o responsável técnico da clínica
