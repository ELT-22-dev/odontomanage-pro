# Guia de Implantação — OdontoManage Pro

Este e um projeto de portfolio/demonstracao: nao tem backend, nao tem banco de dados, nao precisa
de nenhuma conta ou credencial pra rodar. Todos os dados (pacientes, consultas, financeiro,
prontuarios) sao ficticios, seedados em `src/blink/demoData.ts` e guardados no `localStorage` do
navegador de quem estiver vendo — nada sai do navegador, nada e compartilhado entre visitantes.

## 1. Rodando localmente

```bash
npm install --legacy-peer-deps
npm run dev             # http://localhost:3000
```

Nenhuma variavel de ambiente e necessaria. O login entra direto (sessao ficticia
auto-criada) e o dashboard ja aparece com dados de exemplo.

## 2. Google Calendar (opcional)

Unica integracao externa real do projeto — OAuth direto do navegador com o Google (sem backend,
sem client secret). So necessario se quiser demonstrar consultas aparecendo automaticamente no
Google Agenda.

1. Em [console.cloud.google.com](https://console.cloud.google.com), criar um projeto novo.
2. **APIs & Services → Library** → ativar **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - Preencher nome do app, email de suporte e de contato
   - Em **Test users**, adicionar o email do Google que vai conectar
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Tipo: **Web application**
   - **Authorized JavaScript origins**: adicionar a URL onde o sistema vai rodar
     (`http://localhost:3000` em desenvolvimento; a URL de producao depois do deploy — passo 3)
   - Copiar o **Client ID** gerado → colar em `VITE_GOOGLE_CLIENT_ID` num arquivo `.env` na raiz
     (ver `.env.example`)

Sem esse passo, o resto do sistema funciona normalmente — o botao "Conectar Google Calendar"
simplesmente nao faz nada.

## 3. Hospedagem

O `npm run build` gera uma pasta `dist/` **100% estatica** (HTML/JS/CSS) — nao roda nenhum
servidor Node em producao, entao qualquer hospedagem de arquivos estaticos serve.

### Opção A — Vercel (mais simples)

- Plano gratuito ("Hobby") serve bem — e um projeto de demonstracao/pessoal.
- Nenhuma variavel de ambiente e obrigatoria. Se for usar Google Calendar na demo publicada,
  adicionar `VITE_GOOGLE_CLIENT_ID` no painel do projeto.
- Roteamento SPA (`public/_redirects`) ja funciona automatico na Vercel, sem config extra.

### Opção B — Hostinger (hospedagem compartilhada, nao precisa de VPS)

- Rodar `npm run build` localmente, depois subir o **conteudo** da pasta `dist/` (nao a pasta em
  si) para `public_html` via Gerenciador de Arquivos ou FTP.
- **Precisa de um dominio** — hospedagem compartilhada normalmente nao expoe o site por IP puro.
- O arquivo `dist/_redirects` (formato Vercel/Netlify) **nao funciona no Apache da Hostinger** —
  precisa ser substituido por um `.htaccess` com regra de rewrite equivalente para o roteamento
  interno do app funcionar em links diretos (ex: abrir direto em `/pacientes/123`).

### Depois de hospedar

Se estiver usando Google Calendar na demo publicada, volte no Google Cloud Console →
**Authorized JavaScript origins** e adicione a URL final — sem isso a conexao falha com erro de
origem nao autorizada.
