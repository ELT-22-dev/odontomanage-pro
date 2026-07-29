# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**OdontoManage Pro** — a dental clinic management system (patients, agenda, consultations,
financial records, medical records) for a **single clinic** (not a multi-tenant SaaS — each
clinic gets its own separate Supabase project + Google Cloud credentials + hosting).

Originally scaffolded by Blink (blink.new) with `@blinkdotnew/sdk` as the backend. That backend
was fully removed — see "History" below. Everything now runs on Supabase.

Two companion docs live in `docs/`: `IMPLANTACAO.md` (deploying a fresh instance for a new clinic)
and `ARQUITETURA.md` (architecture review — what's solid, what's technical debt, prioritized
roadmap). Read `ARQUITETURA.md` before proposing a structural change (new dependency, new layer,
big refactor) — it records the reasoning behind past calls so it doesn't get re-litigated.

## Commands

```bash
npm run dev              # dev server on :3000 (fixed port, strictPort)
npm run build             # vite build (client+SSR) then flattens to dist/ (see Deployment)
npm run preview           # preview the production build
npm test                  # vitest run — unit tests (src/**/*.test.ts), see ARQUITETURA.md 3.1
npm run test:watch        # vitest in watch mode
npx tsc --noEmit          # type-check (fast, no dev server needed) — run this after any change
npm run lint:types        # same as above
npm run lint:js           # eslint (eslint.config.js — see ARQUITETURA.md 3.2 for its history)
npm run lint:css          # stylelint --fix
npm run lint              # runs all three via `bun run` — bun is NOT installed in this env;
                           # run the three lint:* scripts individually with npm/npx instead
```

Unit tests use Vitest + Testing Library (`vitest.config.ts` — deliberately separate from
`vite.config.ts`, which loads the TanStack Start SSR/prerender/codegen plugin that unit tests don't
need). Test files sit next to what they test (`src/lib/financeStats.test.ts`, etc.). There is no
Playwright/e2e suite yet — see `docs/ARQUITETURA.md` for what's covered and what isn't.

## Architecture

### No custom backend — everything talks to Supabase directly from the browser

There is no Node/Express/serverless API layer. React components call `blink.db.table(...)` and
`blink.auth.*` (see `src/blink/client.ts`), which call `@supabase/supabase-js` directly using the
public anon key (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env`, gitignored). Security
is enforced entirely by **Postgres Row Level Security** (`auth.uid() = user_id` on every table),
not by an API layer — see `supabase-schema.sql`.

`src/blink/client.ts` exports a `blink` object shaped like the original Blink SDK
(`blink.auth.signIn/signUp/logout/...`, `blink.db.table(name).list/get/create/update/delete`) —
this is a deliberate compatibility shim so route components didn't need to change when the
backend was swapped. When adding a new table, extend `BACKUP_TABLES` in that file if it should be
included in the Configuracoes export/import backup feature.

### SQL migrations — must be run manually in the Supabase SQL Editor

There's no migration tool wired up. Every `supabase-*.sql` file in the repo root must be pasted
into the target Supabase project's SQL Editor by hand, in roughly this order, before the
corresponding feature works:
- `supabase-schema.sql` — core tables (patients, appointments, transactions, medical_records) + RLS
- `supabase-indices.sql` — perf indices (RLS filters every query by `user_id`, so this matters)
- `supabase-migration-google-calendar.sql` — adds `appointments.google_event_id`
- `supabase-migration-clinic-branding.sql` — adds the `clinic_settings` table

If you add a feature needing a schema change, add a new `supabase-migration-*.sql` file (don't
edit `supabase-schema.sql` after the fact) and tell the user to run it — there is no way to run
DDL from the app itself (anon key can't do schema changes).

### Routing gotcha: file-based layout routes need `<Outlet/>`

TanStack Router (file-based) treats a file (`pacientes.tsx`) alongside a same-named folder
(`pacientes/`) as a **parent layout** for everything inside that folder. If the parent component
doesn't render `<Outlet/>`, child routes silently never render (URL changes, content doesn't) —
this exact bug broke patient registration once. `src/routes/_app/pacientes.tsx` is now a thin
`() => <Outlet />` layout; the actual list page moved to `src/routes/_app/pacientes/index.tsx`.
Keep this pattern in mind before adding new nested routes under an existing page.

### Auth screen states (`src/components/AppLayout.tsx`)

`AppLayout` branches on `useAuth()` state in this order: `isPasswordRecovery` (show
`NewPasswordScreen`) → `isLoading` (skeleton) → `!isAuthenticated` (show `AuthScreen`, which
itself has signin/signup/forgot-password modes) → authenticated app shell. `useAuth`
(`src/hooks/useAuth.ts`) wraps `blink.auth.onAuthStateChanged`.

The whole authenticated app (`src/routes/_app.tsx` and everything under `_app/`) is wrapped in
`<BlinkClientBoundary>` (a `ClientOnly` from TanStack Router) — these routes never actually
render on the server, only a static skeleton fallback. This is why `localStorage`/`window`/
`blink.auth` reads are safe in page components: they only ever run in the browser.

### Google Calendar sync (`src/lib/googleCalendar.ts`, `src/hooks/useGoogleCalendar.ts`)

Client-only OAuth via Google Identity Services (GIS) — no backend, no client secret, no refresh
token. `connect()` gets a short-lived (~1h) access token and stores it in `localStorage` (must be
`localStorage` not `sessionStorage` — the connect button and the appointment-creation flow are on
different pages/route mounts, and `sessionStorage` doesn't share across tabs, which caused a real
bug once). Appointment create/cancel/delete in `agenda.tsx` and `consultas.tsx` best-effort push
to Google when connected; failures there must never block the underlying Supabase write. Requires
`VITE_GOOGLE_CLIENT_ID` in `.env` and the Google Cloud OAuth client's "Authorized JavaScript
origins" to match wherever the app is served from (`localhost:3000` in dev).

### WhatsApp reminders (`src/lib/whatsapp.ts`)

Not an API integration — just builds a `wa.me`/`api.whatsapp.com` deep link with
`encodeURIComponent`-escaped prefilled text and does `window.open`. No account, no cost, no
backend. Message text intentionally avoids most accented characters (repo convention, see below).

### Clinic branding (`src/hooks/useClinicBranding.ts`, `clinic_settings` table)

Clinic name/logo are **not** stored in Supabase Auth user metadata — metadata is embedded in the
JWT on every request, and an image there would bloat every authenticated call. They live in their
own `clinic_settings` table instead, fetched with a plain query. That table's SELECT policy is
intentionally public (`using (true)`) so the logo/name can render on the pre-login screen too —
this is safe only because each deployment is single-tenant (one clinic's Supabase project), so a
public-read row is that clinic's own public branding, not cross-tenant leakage.

### AI assistant & clinical note summarization (`supabase/functions/ai`, `src/lib/ai.ts`)

The app has no backend, so the Anthropic API key (a secret) can't ship in the browser bundle —
it lives only as a Supabase Edge Function secret. `supabase/functions/ai/index.ts` is a thin
proxy: it verifies the caller's Supabase session (`supabase.auth.getUser()` against the
`Authorization` header), then calls the Claude API (`claude-opus-5`) and returns the result. It
never touches Postgres directly — the browser already fetched whatever clinic data it needs
(through the normal RLS-protected `blink.db.table(...)` calls) and sends it in the request body;
the function's only job is to hold the API key and relay the call. This split was chosen over a
Vercel serverless function specifically because the app can be hosted on Vercel **or** Hostinger
(plain static files — see `docs/IMPLANTACAO.md`), and Supabase is the one dependency present in
both deployment paths.

`src/lib/ai.ts` calls it via `supabase.functions.invoke('ai', ...)` (which attaches the session
token automatically) and exposes two actions: `chat` (the "Assistente IA" page,
`src/routes/_app/assistente.tsx` — answers questions using a JSON snapshot of patients/agenda/
financeiro built client-side) and `summarize` (the "Resumir com IA" button in the prontuarios
create/edit dialog — turns raw dentist notes into a structured draft). **Both are drafts by
design**: the summarize action never writes to the database itself, it only fills the same
editable form fields the user already reviews before clicking Salvar — deliberately, given this
touches patient medical records. Deploying/updating the function requires the Supabase CLI
(`supabase functions deploy ai`) and a secret (`supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`)
— there is no way to do either from the app itself.

### CSV patient import (`src/lib/patientImport.ts`)

Auto-detects common Portuguese/English column headers (accent- and case-insensitive) via
`PATIENT_FIELDS`/`FIELD_ALIASES`, shows a mapping + preview before writing anything, then bulk
inserts via `blink.db.table(...).createMany()` (added specifically to avoid one Supabase request
per CSV row). Deliberately does **not** support `.xlsx` — both browser-side Excel-parsing
libraries available on npm (`xlsx`/SheetJS, `exceljs`) carry known unpatched vulnerabilities or a
large added dependency surface; users are asked to export their spreadsheet to CSV first instead.

## Conventions

- Source strings mostly avoid accented Portuguese characters (`Configuracoes` not
  `Configurações`, `nao` not `não`) — a repo-wide style from the original scaffold, kept for
  consistency. New user-facing strings should generally follow suit unless already inconsistent
  nearby.
- `src/layouts/shared-app-layout.tsx`, `src/Shell.tsx`, `src/components/AppSidebarShell.tsx` are
  unused template leftovers, not wired into any route — don't extend them; the real layout is
  `src/components/AppLayout.tsx` + `src/components/AppSidebar.tsx`.
- `src/assets/hero.png` shows as permanently "modified" in `git status`/`git diff` — a pre-existing
  Git LFS quirk (the blob was committed as raw binary, not an LFS pointer, so the LFS clean filter
  keeps re-flagging it). It's cosmetic; don't try to "fix" it as part of unrelated work, and don't
  `git add` it by accident (`git add -A`/`git add .` will pick it up — stage files explicitly
  instead).
- Generic dependencies with no imports anywhere in `src/` have been deliberately removed
  (`date-fns`, `framer-motion`, `@react-three/*`, `@dnd-kit/core`, `react-hook-form`, `zod`,
  `react-hot-toast`, `react-responsive`, `@hookform/resolvers`). Before adding a "might need it
  later" dependency, check it's actually imported before it lands in `package.json`.
- `npm install` needs `--legacy-peer-deps` in this repo (`@tailwindcss/vite` wants Vite 5-7, the
  project pins Vite 8) — this is expected, not a sign something is broken.

## History

This was originally a Blink-generated template using `@blinkdotnew/sdk` for both auth and data
storage. That backend was fully replaced with Supabase because the Blink-hosted login flow was
unreliable (slow/hanging) and provided no real multi-device persistence. If you see any reference
to `@blinkdotnew/sdk` or `blink.new` outside of historical context, that's leftover/dead — the
package is uninstalled.
