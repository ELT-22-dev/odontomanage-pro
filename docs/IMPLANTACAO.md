# Guia de Implantação — OdontoManage Pro

Este documento explica como colocar o sistema no ar **para uma clínica específica**. Cada
clínica tem sua própria instalação, com seu próprio banco de dados e credenciais — nada é
compartilhado entre clínicas diferentes (não é um SaaS multi-cliente).

Guarde este arquivo junto do código. Se precisar montar o sistema para uma nova clínica do zero,
siga os passos na ordem.

---

## 1. Banco de dados (Supabase)

1. Criar conta gratuita em [supabase.com](https://supabase.com) e um novo projeto.
   - Guarde a senha do banco em lugar seguro (não precisa dela no dia a dia).
   - Escolha uma região próxima do Brasil (ex: São Paulo / `sa-east-1`).
2. No painel do projeto, ir em **SQL Editor** e rodar, **nesta ordem**, o conteúdo de cada
   arquivo da raiz do projeto:
   1. `supabase-schema.sql` — cria as tabelas principais (pacientes, consultas, transações,
      prontuários) e ativa Row Level Security (cada conta só vê os próprios dados).
   2. `supabase-indices.sql` — índices de performance.
   3. `supabase-migration-google-calendar.sql` — coluna para integração com Google Calendar.
   4. `supabase-migration-clinic-branding.sql` — tabela de nome/logo da clínica.
3. Em **Authentication → Sign In / Providers → Email**:
   - Confirme que o provedor **Email** está **ativado** (não "Deficiente").
   - Desative **"Confirmar e-mail"**, a menos que a clínica realmente queira esse passo extra
     (para uso de uma clínica só, geralmente é desnecessário).
4. Em **Settings → API**, copiar dois valores (vão para o `.env`, passo 2):
   - **Project URL**
   - **anon public key** — **nunca** use a chave `service_role` no código do app; essa é secreta
     e dá acesso total ao banco.

## 2. Variáveis de ambiente

Criar um arquivo `.env` na raiz do projeto (nunca commitado — já está no `.gitignore`):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_AQUI
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

A última linha (`VITE_GOOGLE_CLIENT_ID`) só é necessária se for usar a integração com Google
Calendar (passo 3). Sem ela, o resto do sistema funciona normalmente — o botão de conectar ao
Google Calendar simplesmente não vai funcionar.

## 3. Assistente de IA (opcional)

O sistema tem dois recursos de IA (assistente de chat e resumo automatico de prontuario, ambos em
"Assistente IA" no menu e no formulario de Prontuarios). Eles dependem de uma **Supabase Edge
Function** — a chave da API da Anthropic e secreta e nunca pode ficar no navegador, entao ela mora
apenas nessa function, nao no `.env` do app.

1. Ter uma chave de API da Anthropic (console.anthropic.com).
2. Instalar a [Supabase CLI](https://supabase.com/docs/guides/cli) e fazer login (`supabase login`).
3. Na raiz do projeto, vincular ao projeto Supabase da clinica:
   ```
   supabase link --project-ref SEU-PROJETO-REF
   ```
   (o `PROJETO-REF` fica em Settings → General no painel do Supabase)
4. Publicar a function e configurar o segredo:
   ```
   supabase functions deploy ai
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Nao precisa de nenhuma variavel nova no `.env` do app — o navegador so chama
   `supabase.functions.invoke('ai', ...)`, que ja usa a URL/chave do Supabase que voce configurou
   no passo 2.

Sem esse passo, os botoes de IA aparecem no sistema mas retornam erro ao serem usados — o resto do
sistema funciona normalmente.

## 4. Google Calendar (opcional)

Só necessário se a clínica quiser que consultas apareçam automaticamente no Google Agenda do
dentista.

1. Em [console.cloud.google.com](https://console.cloud.google.com), criar um projeto novo.
2. **APIs & Services → Library** → ativar **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - Preencher nome do app, email de suporte e de contato
   - Em **Test users**, adicionar o email do Google que o dentista vai conectar
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Tipo: **Web application**
   - **Authorized JavaScript origins**: adicionar a URL onde o sistema vai rodar
     (`http://localhost:3000` em desenvolvimento; a URL de produção depois do deploy — passo 5)
   - Copiar o **Client ID** gerado → colar em `VITE_GOOGLE_CLIENT_ID` no `.env`
   - **Nunca** usar o "Client secret" no código do app (não é necessário nesta integração).

Depois de hospedar o sistema (passo 5) com uma URL final, **volte aqui e adicione essa URL** em
"Authorized JavaScript origins" — sem isso a conexão com o Google falha com erro de origem não
autorizada.

## 5. Hospedagem

O `npm run build` gera uma pasta `dist/` **100% estática** (HTML/JS/CSS) — não roda nenhum
servidor Node em produção, então qualquer hospedagem de arquivos estáticos serve.

### Opção A — Vercel (mais simples)

- Plano gratuito ("Hobby") funciona tecnicamente para sempre, sem expiração — mas os termos de
  uso da Vercel dizem que esse plano é para uso pessoal/não-comercial. Para uma clínica (uso
  comercial), o correto seria o plano **Pro** (~$20/mês), mesmo que o tráfego seja baixíssimo.
- Configurar as variáveis de ambiente do passo 2 no painel do projeto na Vercel.
- Roteamento SPA já funciona automaticamente na Vercel (não precisa configurar nada extra).

### Opção B — Hostinger (hospedagem compartilhada, não precisa de VPS)

- Como o resultado é só arquivos estáticos, o plano de hospedagem compartilhada mais barato já
  resolve — **não é necessário VPS**.
- Rodar `npm run build` localmente, depois subir o **conteúdo** da pasta `dist/` (não a pasta em
  si) para `public_html` via Gerenciador de Arquivos ou FTP.
- **Precisa de um domínio** — hospedagem compartilhada normalmente não expõe o site por IP puro,
  só por domínio vinculado ao plano.
- O arquivo `dist/_redirects` (formato Vercel/Netlify) **não funciona no Apache da Hostinger** —
  precisa ser substituído por um `.htaccess` com regra de rewrite equivalente para o roteamento
  interno do app funcionar em links diretos (ex: abrir direto em `/pacientes/123`).

### Depois de hospedar, sempre atualizar

- **Google Cloud Console** → Authorized JavaScript origins → adicionar a URL final (passo 4).
- **Supabase** → Authentication → URL Configuration → atualizar a "Site URL" para a URL final
  (usada nos links de "esqueci minha senha" — se não atualizar, o link de redefinição de senha
  aponta para o lugar errado).

## 6. Checklist rápido para uma clínica nova

- [ ] Projeto Supabase criado, os 4 arquivos SQL rodados na ordem
- [ ] Confirmação de email desativada (ou aceitar o fluxo com confirmação, se preferir)
- [ ] `.env` preenchido com URL + chave anon do Supabase
- [ ] (Opcional) Edge Function `ai` publicada e `ANTHROPIC_API_KEY` configurada (passo 3)
- [ ] (Opcional) Projeto Google Cloud criado, Calendar API ativada, Client ID gerado
- [ ] Build gerado e hospedado (Vercel ou Hostinger)
- [ ] Domínio apontando para a hospedagem
- [ ] Google Cloud e Supabase atualizados com a URL final de produção
- [ ] Login de teste criado e conferido (cadastro de paciente, agenda, financeiro)
