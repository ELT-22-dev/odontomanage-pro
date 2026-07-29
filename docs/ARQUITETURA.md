# Arquitetura — OdontoManage Pro

Revisão de arquitetura do sistema: o que já está bem resolvido, o que é dívida técnica real (com
localização exata no código), o que foi corrigido nesta sessão e o que fica como roteiro para
depois. Escrito para não precisar ser re-discutido do zero a cada mudança grande — antes de propor
uma nova dependência, uma nova camada ou um refactor grande, leia este arquivo primeiro.

Data desta revisão: 2026-07-28.

---

## 1. Contexto: o que essa arquitetura precisa suportar

Antes de julgar qualquer decisão técnica, vale fixar o que este sistema **é**:

- **Uma instalação por clínica**, não um SaaS multi-tenant. Cada clínica tem seu próprio projeto
  Supabase, suas próprias credenciais do Google, sua própria hospedagem. Não existe "conta
  compartilhada" nem "tenant" no banco.
- **Time pequeno** (provavelmente uma pessoa cuidando do deploy por clínica), sem equipe de
  infraestrutura dedicada.
- **Dados sensíveis de verdade**: prontuário médico e dados financeiros de pacientes reais. Isso
  eleva a fasquia em confiabilidade e segurança acima de "app pequeno qualquer", mesmo sendo um
  projeto de porte pequeno.
- **Hospedagem estática, sem servidor Node em produção** — pode rodar tanto em Vercel quanto em
  hospedagem compartilhada tipo Hostinger (ver `docs/IMPLANTACAO.md`). Qualquer decisão de
  arquitetura que dependa de "ter um servidor rodando" quebra esse requisito.

A conclusão importante disso: **a arquitetura certa aqui não é a mais sofisticada possível, é a
mais simples que ainda é segura e confiável para esse volume de dados sensíveis.** Um arquiteto
sênior avaliando este projeto não recomendaria microserviços, GraphQL, Redux, DDD em camadas, ou
qualquer coisa desenhada para escala que este sistema nunca vai ter — recomendaria fechar as
lacunas de confiabilidade (testes, tratamento de erro, backups, CI) mantendo a simplicidade atual.
É esse o critério usado abaixo.

---

## 2. O que já está certo (não mexer)

- **RLS como única camada de autorização** (`auth.uid() = user_id` em toda tabela, ver
  `supabase-schema.sql`) — simples, correto, testado pelo próprio Postgres a cada query. Não
  precisa de uma camada de API própria replicando essa lógica.
- **Sem backend customizado.** Para o volume de dados de uma clínica, adicionar uma API própria só
  seria mais uma coisa para hospedar, monitorar e manter no ar.
- **Disciplina de dependências** — dependências sem uso real foram removidas deliberadamente
  (`date-fns`, `framer-motion`, `zod`, `react-hook-form`, etc., ver `CLAUDE.md`). Continue assim:
  antes de instalar algo, confirme que vai ser importado de verdade.
- **Code splitting por rota já funciona automaticamente** (TanStack Start + Vite geram um chunk
  por página — confirmado no output de `npm run build`). Nada a fazer aqui.
- **`react-query` para estado de servidor, `useState` para estado de UI** — a escolha certa para
  este tamanho de app. Não precisa de Redux/Zustand/Jotai.
- **CSV em vez de XLSX** (`src/lib/patientImport.ts`) — decisão de segurança deliberada e bem
  documentada (bibliotecas de parsing de Excel no browser têm vulnerabilidades conhecidas).
- **Migração do backend Blink para Supabase** já foi feita de forma limpa — não sobrou código morto
  relevante (o `@blinkdotnew/sdk` foi de fato removido, não só desativado).

---

## 3. Dívidas técnicas identificadas (com localização)

Cada item abaixo foi confirmado lendo o código, não é uma suposição genérica.

### 3.1 — Zero cobertura de testes automatizados (parcialmente corrigido nesta sessão)

Não existia Jest/Vitest/Playwright configurado em lugar nenhum do repositório. Toda verificação
até então era manual (`npx tsc --noEmit` + testes ad-hoc).

**Corrigido — infraestrutura + primeira leva de testes**: Vitest + Testing Library configurados
(`vitest.config.ts`, separado do `vite.config.ts` de propósito — esse último carrega o plugin do
TanStack Start com SSR/prerender/codegen de rotas, que testes unitários não precisam rodar a cada
`vitest`). `npm test` roda a suite; `npm run test:watch` para o modo interativo. 29 testes cobrindo
os três fluxos que o roteiro da seção 4 (versão anterior deste documento) apontava como
prioridade:

- **`src/lib/financeStats.test.ts`** — cálculo de totais financeiros (`src/lib/financeStats.ts`,
  ver 3.1.1 abaixo) — inclui casos de borda como janeiro virando dezembro do ano anterior em
  "mês passado", valor não-numérico não devendo virar `NaN`, e receita "pendente" não devendo
  contar no saldo.
- **`src/lib/patientImport.test.ts`** — o importador de CSV (`src/lib/patientImport.ts`), que já
  era puro e exportado — reconhecimento de cabeçalhos com acento/maiúscula, e o que acontece
  quando uma coluna não bate com nenhum campo conhecido.
- **`src/hooks/useAuth.test.ts`** — as transições de estado que `AppLayout` usa para decidir entre
  tela de loading, tela de login, tela de "nova senha" e o app autenticado.
- **`src/lib/ai.test.ts`** — o cliente do assistente de IA (`src/lib/ai.ts`), cobrindo tanto o
  caminho feliz quanto os dois formatos de erro que a Edge Function pode devolver (erro de
  transporte vs. `{ error }` no corpo da resposta).

**Ainda não coberto** (lacuna real, não decidida sozinha porque envolve escolha de escopo):
lançamento/edição de transação e de paciente via formulário (`financeiro.tsx`/`pacientes/novo.tsx`
— precisam de testes de componente com `@testing-library/react`, não só de função pura), e
qualquer teste ponta-a-ponta (Playwright) do fluxo de login real. Ver roteiro (seção 4).

#### 3.1.1 — Extração de `src/lib/financeStats.ts`

Para tornar o cálculo de totais testável sem renderizar a página inteira (o que exigiria mockar
`react-query` + Supabase só para chegar na lógica), `getPeriodRange`, `computeTotals` e
`computeSummaryCounts` foram movidos de dentro de `financeiro.tsx` para
`src/lib/financeStats.ts`, mantendo o comportamento idêntico — o componente continua chamando
essas funções de dentro dos mesmos `useMemo`, só que agora a lógica em si é uma função nomeada,
exportada e testada isoladamente. Esse é o tipo de extração pequena e de baixo risco que vale
fazer *junto* com o teste (o teste força a extração), diferente de quebrar a tela inteira em
componentes menores (seção 3.3), que é um refactor maior e fica para depois de a rede de testes
existir.

### 3.2 — `eslint.config.js` não existia (corrigido nesta sessão)

`package.json` já tinha o script `lint:js` e todas as dependências do ESLint instaladas
(`eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
`typescript-eslint`), mas **não existia nenhum arquivo de configuração** — `npm run lint:js`
falhava com "ESLint couldn't find an eslint.config.js file" desde sempre. Ou seja, o lint nunca
rodou de verdade neste projeto.

**Corrigido**: `eslint.config.js` criado (config padrão do template Vite+React+TS, compatível com
as versões já instaladas). Rodar agora revelou os problemas reais das seções 3.3 e 3.4 abaixo —
problemas que sempre estiveram lá, só nunca tinham sido sinalizados.

### 3.3 — Componentes recriados a cada render em `prontuarios.tsx`

`DetailView`, `EmptyList` e `EmptyDetail` são definidos **dentro** do corpo do componente
`ProntuariosPage` (`src/routes/_app/prontuarios.tsx:247`, `:389`, `:407`), e usados em
`:535/:545/:561/:564`. Isso significa que a cada re-render da página inteira, o React trata esses
subcomponentes como "novos", desmontando e remontando a subárvore — qualquer estado local que eles
viessem a ganhar no futuro (um input, um accordion aberto) seria resetado a cada digitação em
qualquer outro campo da página. Hoje eles não têm estado próprio, então o sintoma é só performance
(remount desnecessário), mas é uma armadilha para quem for estender essa tela depois.

**Não foi corrigido nesta sessão** — a correção é mecânica (mover as três funções para fora do
componente, recebendo os poucos valores que usam via props), mas mexe em ~150 linhas de uma tela
que já funciona em produção; preferi não tocar sem confirmar com você, para não arriscar quebrar
algo que está sendo usado por clínicas reais numa sessão que não pediu isso.

### 3.4 — `setState` dentro de `useEffect` sem guarda

Padrão `useEffect(() => { ...; setAlgo(x) }, [deps])` sem que o efeito dependa de algo externo
assíncrono de verdade — o ESLint (regra `react-hooks/set-state-in-effect`) aponta:

- `src/hooks/useGoogleCalendar.ts:8`
- `src/routes/_app/configuracoes.tsx:75` e `:81`
- `src/routes/_app/prontuarios.tsx:66` (o efeito que pré-preenche o formulário ao editar um
  registro)

Na maioria dos casos aqui o efeito é inofensivo (sincroniza estado derivado de uma prop), mas é o
tipo de padrão que costuma esconder um "flash" de estado antigo antes do efeito rodar, ou um
loop de re-render em versões futuras do React. Vale revisar caso a caso — não é urgente.

**Não foi corrigido nesta sessão** — mesmo raciocínio do item 3.3: mexer nisso é uma limpeza, não
uma correção de bug ativo, e cada ocorrência merece ser avaliada com calma, não em lote.

### 3.5 — Nenhum error boundary global (corrigido nesta sessão)

Um erro não tratado em qualquer componente derrubava a árvore inteira do React e deixava a tela em
branco, sem explicação nem botão de recarregar — ruim em qualquer app, pior no meio de um
atendimento ou de um lançamento financeiro.

**Corrigido**: `src/components/ErrorBoundary.tsx` (novo) envolvendo `{children}` em
`src/routes/__root.tsx`. Mostra uma mensagem simples + botão "Recarregar página" em vez de tela
branca, e loga o erro no console para debug.

### 3.6 — Branding "Blink App" vazado no `<head>` raiz (corrigido nesta sessão)

`src/routes/__root.tsx` ainda tinha o scaffold original: `title: 'Blink App'`, `og:title`,
`og:description`, `og:site_name` em inglês, e o JSON-LD (`WebSite`/`Organization`) com
`name: 'Blink App'`. O `head()` de cada página (`Route.head` em `src/routes/_app/*.tsx`) sobrescreve
o `<title>` durante a navegação, mas esses valores raiz ainda são o que aparece antes da hidratação
e em qualquer preview de link compartilhado (WhatsApp, Slack etc.) — ou seja, alguém mandando o
link do sistema para um colega veria "Blink App" no card de preview.

**Corrigido**: valores trocados para "OdontoManage Pro" / português / `pt_BR`. Como o deploy é
single-tenant, fixar o nome do produto aqui (em vez de buscar o nome da clínica de
`clinic_settings`) é intencional — buscar o nome real da clínica exigiria um data loader no SSR do
root, que é mais estrutura do que o ganho justifica agora (ver seção 5, "o que não fazer").

### 3.7 — Sem `.env.example` (corrigido nesta sessão)

`docs/IMPLANTACAO.md` descreve as 3 variáveis de ambiente em prosa, mas não existia um arquivo
`.env.example` para copiar — fricção pequena, mas gratuita, de onboarding a cada nova clínica.

**Corrigido**: `.env.example` criado na raiz, com comentários explicando cada variável (incluindo
uma nota de que a chave da Anthropic **não** entra aqui — ver seção do assistente de IA no
`CLAUDE.md`).

### 3.8 — Nenhum CI (corrigido nesta sessão)

Não havia `.github/workflows` — nenhuma verificação automática rodava em push/PR. Bugs só eram
pegos manualmente, se alguém lembrasse de rodar `tsc`/`build` antes de subir.

**Corrigido**: `.github/workflows/ci.yml` — roda em todo push para `main` e todo PR:
1. `npx tsc --noEmit` (bloqueante)
2. `eslint` (informativo por enquanto — `continue-on-error: true`, porque os problemas pré-existentes
   das seções 3.3/3.4 ainda não foram triados; assim que forem corrigidos, tirar o
   `continue-on-error` para o lint passar a bloquear também)
3. `npm test` (Vitest — ver seção 3.1)
4. `npm run build` completo, incluindo o prerender de todas as rotas, usando credenciais Supabase
   **placeholder** (`https://placeholder.supabase.co`) só para provar que o build não quebra — a
   build nunca fala com um projeto real porque tudo que lê `blink.auth`/`localStorage` está atrás
   de `<BlinkClientBoundary>` ou `ssr:false` (ver comentário em `src/routes/__root.tsx`).

### 3.9 — Migrações SQL manuais, sem controle de versão real

`supabase-schema.sql`, `supabase-indices.sql`, `supabase-migration-google-calendar.sql`,
`supabase-migration-clinic-branding.sql` são colados manualmente no SQL Editor do Supabase, na
ordem descrita em `docs/IMPLANTACAO.md`. Funciona, mas não tem como saber, olhando só o banco de
uma clínica específica, quais desses arquivos já rodaram ali — depende de checklist manual.

**Não foi mexido nesta sessão.** Agora que o Supabase CLI já é uma dependência do projeto (usado
para publicar a Edge Function de IA — ver `CLAUDE.md`), migrar para `supabase/migrations/` +
`supabase db push` é o caminho natural e já discutido no roteiro (seção 4) — mas é uma mudança que
afeta o processo de deploy de clínicas que **já estão em produção com o esquema atual**, então
meleca de reconciliar precisa ser combinada com você antes, não decidida sozinha.

### 3.10 — Sem observability / rastreamento de erro

Todo erro (no app e agora também na nova Edge Function `ai`) só vai para `console.error` — não tem
para onde esse log ir depois que a aba do navegador fecha. Se um dentista relatar "deu erro ao
salvar", hoje não tem como investigar sem reproduzir na hora.

**Não foi mexido nesta sessão** — depende de escolher e configurar um serviço externo (Sentry,
Highlight, etc.), que precisa de conta/chave sua. Ver roteiro.

### 3.11 — Backup automático não existe

O único mecanismo de backup é o export/import manual em Configurações (`exportAllData`/
`importAllData` em `src/blink/client.ts`) — depende de alguém lembrar de clicar. Point-in-time
recovery do Supabase é recurso pago (plano Pro+); a alternativa gratuita seria uma Edge Function
agendada (`pg_cron` ou um cron externo) que despeja os dados em Supabase Storage periodicamente.

**Não foi mexido nesta sessão** — decisão de custo/frequência é sua.

---

## 4. Roteiro priorizado

Ordenado por relação valor/risco, não por facilidade.

### Feito nesta sessão (baixo risco, sem dependência externa)
- [x] `eslint.config.js` (destravou o lint, que nunca tinha rodado)
- [x] Error boundary global
- [x] Corrigir branding "Blink App" → "OdontoManage Pro" no `<head>` raiz
- [x] `.env.example`
- [x] CI básico no GitHub Actions (tsc + testes + build sempre; lint informativo)
- [x] Vitest + Testing Library configurados, com 29 testes cobrindo cálculo financeiro, import de
      CSV e o fluxo de estados de `useAuth` (seção 3.1) — extraindo `src/lib/financeStats.ts` no
      processo

### Próximo passo natural (ainda baixo risco, mas exige revisão sua)
1. **Triar e corrigir os achados do lint** (seções 3.3 e 3.4) — depois, tirar o
   `continue-on-error` do CI para o lint passar a bloquear PRs de verdade.
2. **Testes de componente** para os formulários que ainda não têm cobertura — criação/edição de
   transação (`financeiro.tsx`) e de paciente (`pacientes/novo.tsx`) — e Playwright para 2-3 fluxos
   ponta-a-ponta críticos (login, criar paciente, lançar uma transação).
3. **Migrar para `supabase/migrations/`** — traz histórico de schema versionado, mas exige combinar
   com você como reconciliar clínicas já em produção com o esquema manual atual.

### Médio prazo (mais escopo, decisão de investimento)
4. **Observability** (Sentry ou equivalente) — app e Edge Functions.
5. **Backup automático** agendado.
6. **Quebrar as páginas grandes** (`prontuarios.tsx` ~680 linhas, `financeiro.tsx` 648,
   `configuracoes.tsx` 567, `consultas.tsx` 533, `agenda.tsx` 366) em hooks de domínio
   (`usePatients`, `useAppointments`, `useTransactions`, `useMedicalRecords`) + componentes de
   apresentação menores. Fazer módulo por módulo, só quando for mexer naquela tela por outro
   motivo — não como um refactor único e grande (alto risco de regressão sem rede de testes ainda
   no lugar; por isso o item 2 vem antes deste).

---

## 5. O que **não** fazer (para não virar over-engineering)

Registrando explicitamente para não precisar re-explicar depois:

- **Não** introduzir uma API própria (Express/Fastify/NestJS) — RLS já resolve autorização; uma API
  própria seria mais superfície para manter sem ganho real neste porte.
- **Não** adotar Redux/Zustand/MobX — `react-query` + `useState` já cobre as necessidades atuais.
- **Não** virar multi-tenant — o modelo "uma instalação por clínica" é intencional (ver `CLAUDE.md`
  → "History"), mudar isso é uma decisão de produto, não de arquitetura.
- **Não** buscar o nome/logo real da clínica no `<head>` raiz via SSR loader — o ganho (link preview
  com o nome certo da clínica em vez de "OdontoManage Pro") não justifica a estrutura nova
  necessária (data loader server-side lendo `clinic_settings` antes do primeiro paint).
- **Não** trocar Supabase por outro backend — RLS, Auth e Storage resolvem tudo que este sistema
  precisa hoje.
