# OdontoManage Pro

Sistema de gestao para clinicas odontologicas: pacientes, agenda, consultas, financeiro e
prontuario, com sincronizacao com Google Calendar, lembretes via WhatsApp e um assistente de IA
para consultas rapidas e resumo de anotacoes clinicas.

Projetado para **uma clinica por instancia** (nao e um SaaS multi-tenant) — cada clinica roda com
seu proprio projeto Supabase, credenciais do Google Cloud e hospedagem.

## Stack

- **React 19 + TypeScript**, roteamento via **TanStack Router** (file-based)
- **Supabase** (Postgres + Auth) como unico backend — sem servidor proprio; todo acesso a dados
  passa direto do browser para o Postgres, protegido por **Row Level Security**
- **Tailwind CSS 4** + shadcn/ui (Radix primitives)
- **Vitest + Testing Library** para testes unitarios
- Uma **Supabase Edge Function** isolada para o assistente de IA (Claude API), a unica peca que
  precisa de um segredo de servidor

## Funcionalidades

- Cadastro de pacientes (com importacao em massa via CSV)
- Agenda de consultas com sincronizacao opcional com Google Calendar
- Controle financeiro (receitas, despesas, parcelamentos)
- Prontuario/anotacoes clinicas, com resumo assistido por IA
- Lembretes de consulta via WhatsApp (link direto, sem integracao paga)
- Assistente de IA que responde perguntas sobre a agenda, pacientes e financeiro da clinica
- Marca da clinica (nome/logo) configuravel

## Rodando localmente

```bash
npm install --legacy-peer-deps
cp .env.example .env   # preencha com as credenciais do seu projeto Supabase
npm run dev             # http://localhost:3000
```

Veja [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md) para o guia completo de deploy de uma instancia
nova (schema SQL, Google Calendar, Edge Function de IA) e
[docs/ARQUITETURA.md](docs/ARQUITETURA.md) para as decisoes de arquitetura e o que ainda e divida
tecnica.

## Comandos

```bash
npm run dev              # servidor de dev na porta 3000
npm run build             # build de producao
npm test                  # testes unitarios (Vitest)
npx tsc --noEmit           # checagem de tipos
npm run lint:js            # ESLint
npm run lint:css           # Stylelint
```

## Licenca

Projeto pessoal, sem licenca de uso definida.
