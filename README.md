# OdontoManage Pro

Sistema de gestao para clinicas odontologicas: pacientes, agenda, consultas, financeiro e
prontuario, com sincronizacao opcional com Google Calendar e lembretes via WhatsApp.

**Este e um projeto de portfolio/demonstracao — nao tem backend, nao tem banco de dados real.**
Todos os dados (pacientes, consultas, financeiro, prontuarios) sao ficticios e vivem no
`localStorage` do navegador de quem estiver vendo a demo; nada e enviado pra nenhum servidor.

## Stack

- **React 19 + TypeScript**, roteamento via **TanStack Router** (file-based)
- **Tailwind CSS 4** + shadcn/ui (Radix primitives)
- **Vitest + Testing Library** para testes unitarios
- Sem backend: toda a "persistencia" e uma camada em `src/blink/demoClient.ts` que le/escreve no
  `localStorage`, seedada com dados ficticios em `src/blink/demoData.ts`

## Funcionalidades

- Cadastro de pacientes (com importacao em massa via CSV)
- Agenda de consultas com sincronizacao opcional com Google Calendar
- Controle financeiro (receitas, despesas, parcelamentos)
- Prontuario/anotacoes clinicas
- Lembretes de consulta via WhatsApp (link direto, sem integracao paga)
- Marca da clinica (nome/logo) configuravel

## Rodando localmente

```bash
npm install --legacy-peer-deps
npm run dev             # http://localhost:3000
```

Nenhuma variavel de ambiente e necessaria — o login entra direto com dados ficticios. Veja
[CLAUDE.md](CLAUDE.md) para detalhes de arquitetura.

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
