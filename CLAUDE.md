# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**OdontoManage Pro** — a production dental clinic management system (patients, agenda,
consultations, financial records, medical records, staff users, audit trail) delivered to a real
clinic. Real backend and real database: **Next.js 16 App Router** (UI + API routes in one
project) + **PostgreSQL** (Neon in production), deployed on **Vercel**. Single-tenant: one deploy
+ one database per clinic; every user of that clinic sees the same data, access is by role
(`admin` | `staff`).

Full human documentation: `docs/INFRAESTRUTURA.md` (architecture, DB, API reference, security,
deploy, backup, runbook) and `docs/MANUAL-DO-USUARIO.md` (end users). Keep them in sync when you
change behavior they describe.

## Commands

```bash
npm run dev           # dev server on :3000 (needs .env.local with DATABASE_URL + AUTH_SECRET)
npm run check         # typecheck + eslint + vitest — run after any change
npm run build         # production build (does not need a database)
npm run db:migrate    # apply pending db/migrations/*.sql (also runs on every Vercel deploy via vercel-build)
npm run db:seed-demo  # fake data; refuses if any patient exists
npm run admin:create -- --email X --password Y   # create admin / reset password (emergency)
npm run test:e2e      # scripts/e2e.mjs: ~60 API checks against a RUNNING server + REAL database
```

E2E needs an empty **test** database and a running server, e.g.
`DATABASE_URL=.../odonto_test npm run db:migrate && npm run build && DATABASE_URL=... npx next start -p 3100`
then `E2E_BASE_URL=http://localhost:3100 npm run test:e2e`. CI (`.github/workflows/ci.yml`) runs
all of this with a Postgres service container. "Done" means typecheck + lint + unit + E2E green,
not just a successful build.

## Architecture

- `src/app/(app)/*` — logged-in pages (client components using React Query). `(app)/layout.tsx`
  validates the session **server-side** and redirects to `/login`. `src/proxy.ts` (Next 16's
  renamed middleware) only redirects cookie-less requests to `/login?next=...`.
- `src/app/api/**/route.ts` — the backend. Every handler: `export const X = route(async (req, ctx) => { const user = await requireUser() /* or requireAdmin() */; const data = await readBody(req, schema); ...; await audit(...); return json(...) })`.
  `route()` (`src/server/http.ts`) turns `HttpError`, `ZodError` and Postgres error codes into
  `{ error: "mensagem" }` JSON with the right status and blocks cross-origin writes.
- `src/server/*` — server-only (`import 'server-only'`): `db.ts` (pg Pool, `query`/`queryOne`/
  `transaction`, `buildInsert`/`buildSet` which only accept whitelisted columns), `auth.ts`
  (bcrypt, JWT cookie `odonto_session`, session re-read from DB every request, lockout after 5
  failures), `schemas.ts` (all zod input schemas + `*_COLUMNS` whitelists), `repos/*.ts` (all SQL),
  `audit.ts`.
- `src/lib/*` — shared by client/server: `types.ts` (API JSON shapes), `dates.ts`, `financeStats.ts`,
  `br.ts` (CPF/phone masks), `api.ts` (client fetch wrapper), `googleCalendar.ts`, `whatsapp.ts`.
- `src/hooks/queries.ts` — every read goes through a hook here; after a write call
  `invalidate(keys.x)`.
- No ORM on purpose. Plain parameterized SQL.

## Rules that are easy to break

- **Dates:** calendar dates are `'YYYY-MM-DD'` strings end to end. `pg` is configured to return
  DATE as text (`types.setTypeParser(1082)` in `db.ts`). "Today" must come from `todayISO()`
  (clinic timezone, default America/Sao_Paulo) — never `new Date().toISOString().slice(0,10)`
  (UTC; Vercel runs in UTC). Month ranges sent to the API must use `monthEnd()`, not `-31`.
- **Migrations:** never edit a migration that already ran in production; add `000N_*.sql`.
  Prefer backward-compatible changes (the new migration runs before the new code goes live).
- **Medical records** use `ON DELETE RESTRICT` (legal retention) — deleting a patient with records
  must fail with 409; don't "fix" that with a cascade.
- **Permissions are enforced in the API** (`requireAdmin()`), UI hiding is only cosmetic.
- **Users are deactivated, never deleted**; there must always be ≥1 active admin
  (`assertNotLastAdmin`). Password change / deactivation bumps `session_version`.
- **No public signup.** `/setup` only works while the `users` table is empty.
- New columns: add to the table's `*_COLUMNS` whitelist and zod schema in `schemas.ts`, the type in
  `lib/types.ts`, then the UI.
- Google Calendar and WhatsApp are best-effort: their failures must never block the DB write.
- Row action buttons use the `.row-actions` CSS class (hidden until hover only on devices that
  support hover; always visible on touch). Don't reintroduce `opacity-0 group-hover:opacity-100`.
- Dialogs for create/edit are remounted with `key={dialog.key}` from `useDialog()` instead of
  syncing props into state with `useEffect`.

## Conventions

- UI strings avoid accented characters (`Configuracoes`, `nao`) — repo-wide convention. Docs in
  `docs/` use normal Portuguese.
- `.env.local` holds local secrets and is gitignored. Production env vars live in Vercel.
- Don't add dependencies that aren't imported anywhere.

## History

Started as a Blink (blink.new) scaffold, then Supabase, then a localStorage-only portfolio demo
(Vite + TanStack Router). In Sept 2026 it was rebuilt as this Next.js + Postgres product for a real
clinic. Any reference to `blink`, Supabase, TanStack Router, `localStorage` data, or an AI
assistant feature is historical and dead.
