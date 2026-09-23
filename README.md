# OdontoManage Pro

Sistema de gestão para clínicas odontológicas: **pacientes, agenda, consultas, financeiro,
prontuário, equipe e auditoria** — com lembretes por WhatsApp e sincronização opcional com
Google Calendar.

Next.js 16 (frontend + API no mesmo projeto) · PostgreSQL (Neon) · deploy na Vercel.

## Documentação

| Documento | Para quem |
|---|---|
| [docs/INFRAESTRUTURA.md](docs/INFRAESTRUTURA.md) | Desenvolvedor(a): arquitetura, banco, API, segurança, deploy, backup, runbook de problemas, como evoluir |
| [docs/MANUAL-DO-USUARIO.md](docs/MANUAL-DO-USUARIO.md) | Equipe da clínica: como usar cada tela |
| [CLAUDE.md](CLAUDE.md) | Instruções para assistentes de código (Claude Code) trabalharem no repositório |

## Início rápido (desenvolvimento)

```bash
npm install
cp .env.example .env.local     # preencha DATABASE_URL e AUTH_SECRET
npm run db:migrate             # cria as tabelas
npm run dev                    # http://localhost:3000 → configuração inicial (cria o admin)
```

## Comandos

```bash
npm run dev            # servidor de desenvolvimento
npm run check          # tipos + lint + testes unitários
npm run build          # build de produção
npm run db:migrate     # aplica migrations pendentes (também roda em todo deploy)
npm run db:seed-demo   # dados fictícios para treinamento (recusa se houver pacientes)
npm run admin:create -- --email EMAIL --password SENHA   # emergência: cria/redefine admin
npm run test:e2e       # testes de ponta a ponta (servidor + banco de TESTE)
```

## Deploy

Vercel + Neon, passo a passo em [docs/INFRAESTRUTURA.md §10](docs/INFRAESTRUTURA.md#10-deploy-em-produção-vercel--neon).
Variáveis obrigatórias: `DATABASE_URL`, `AUTH_SECRET`.
