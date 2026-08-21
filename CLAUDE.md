# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**OdontoManage Pro** — a dental clinic management system (patients, agenda, consultations,
financial records, medical records) built as a **portfolio/demo piece**. It has no backend and no
real database: every "save" writes to the visiting browser's `localStorage`, seeded with fake data
on first load. Nothing is shared between visitors, nothing is sent to any server.

It did not start this way — see "History" below for how it got here. If you're about to add a
feature that needs a real server, a database, or a secret API key, stop: that doesn't fit this
project's current shape (see "What NOT to do" below) unless the user explicitly asks to bring
backend infrastructure back.

`docs/IMPLANTACAO.md` covers deploying this build (Vercel/Hostinger) and the one optional real
integration (Google Calendar).

## Commands

```bash
npm run dev              # dev server on :3000 (fixed port, strictPort)
npm run build             # vite build (client+SSR) then flattens to dist/ (see docs/IMPLANTACAO.md)
npm run preview           # preview the production build
npm test                  # vitest run — unit tests (src/**/*.test.ts)
npm run test:watch        # vitest in watch mode
npx tsc --noEmit          # type-check (fast, no dev server needed) — run this after any change
npm run lint:types        # same as above
npm run lint:js           # eslint (eslint.config.js)
npm run lint:css          # stylelint --fix
npm run lint              # runs all three via `bun run` — bun is NOT installed in this env;
                           # run the three lint:* scripts individually with npm/npx instead
```

Unit tests use Vitest + Testing Library (`vitest.config.ts` — deliberately separate from
`vite.config.ts`, which loads the TanStack Start SSR/prerender/codegen plugin that unit tests don't
need). Test files sit next to what they test (`src/lib/financeStats.test.ts`, etc.). There is no
Playwright/e2e suite.

No environment variables are required to run this project. `VITE_GOOGLE_CLIENT_ID` is the one
optional exception (see "Google Calendar sync" below).

## Architecture

### No backend — everything lives in the browser's localStorage

There is no server, no database, no API layer of any kind. React components call
`blink.db.table(...)` and `blink.auth.*` (see `src/blink/client.ts`), which is a thin re-export of
`src/blink/demoClient.ts` — the actual implementation. `demoClient.ts` reads/writes a single JSON
blob in `localStorage` (`odonto_demo_db_v1`), seeded on first load from `src/blink/demoData.ts`
(fake patients/agenda/financeiro/prontuarios, with dates computed relative to "today" so the demo
never looks stale). `src/blink/sanitize.ts` holds a small shared helper (empty-string form fields
become `null`).

`blink.auth` (`DemoAuth` in `demoClient.ts`) auto-creates/restores a session on load — **there is
no real login**, a portfolio visitor lands straight on the dashboard. `AppLayout`'s auth screen
(`src/components/AppLayout.tsx`) still exists and is fully wired (accepts any email/password,
persists to `localStorage`) but is normally unreachable; it only shows if something explicitly
calls `blink.auth.logout()` (the sidebar's "Sair" button).

The `blink.auth.*` / `blink.db.table(name).list/get/create/update/delete` shape is a
**compatibility shim** left over from when this ran on a real Supabase backend (see "History") —
route components were written against that shape and still are, even though nothing behind it
talks to a network anymore. When adding a new table, extend `BACKUP_TABLES` in `demoClient.ts` if
it should be included in the Configuracoes export/import backup feature.

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
itself has signin/signup/forgot-password modes, all fake/local in this build) → authenticated app
shell. `useAuth` (`src/hooks/useAuth.ts`) wraps `blink.auth.onAuthStateChanged`.

The whole authenticated app (`src/routes/_app.tsx` and everything under `_app/`) is wrapped in
`<BlinkClientBoundary>` (a `ClientOnly` from TanStack Router) — these routes never actually
render on the server, only a static skeleton fallback. This is why `localStorage`/`window`/
`blink.auth` reads are safe in page components: they only ever run in the browser.

### Google Calendar sync (`src/lib/googleCalendar.ts`, `src/hooks/useGoogleCalendar.ts`)

The one real external integration left in this build. Client-only OAuth via Google Identity
Services (GIS) — no backend, no client secret, no refresh token. `connect()` gets a short-lived
(~1h) access token and stores it in `localStorage` (must be `localStorage` not `sessionStorage` —
the connect button and the appointment-creation flow are on different pages/route mounts, and
`sessionStorage` doesn't share across tabs, which caused a real bug once). Appointment
create/cancel/delete in `agenda.tsx` and `consultas.tsx` best-effort push to Google when
connected; failures there must never block the underlying `blink.db.table(...)` write. Requires
`VITE_GOOGLE_CLIENT_ID` in `.env` and the Google Cloud OAuth client's "Authorized JavaScript
origins" to match wherever the app is served from (`localhost:3000` in dev). Without it configured,
the "Conectar Google Calendar" button just does nothing — the rest of the app is unaffected.

### WhatsApp reminders (`src/lib/whatsapp.ts`)

Not an API integration — just builds a `wa.me`/`api.whatsapp.com` deep link with
`encodeURIComponent`-escaped prefilled text and does `window.open`. No account, no cost, no
backend. Message text intentionally avoids most accented characters (repo convention, see below).

### Clinic branding (`src/hooks/useClinicBranding.ts`, `clinic_settings` table)

Clinic name/logo are fetched via `blink.db.table('clinic_settings').list()` — a plain read from
the same localStorage store as everything else, seeded with a default name/no logo in
`demoData.ts`. Editable from Configuracoes.

### CSV patient import (`src/lib/patientImport.ts`)

Auto-detects common Portuguese/English column headers (accent- and case-insensitive) via
`PATIENT_FIELDS`/`FIELD_ALIASES`, shows a mapping + preview before writing anything, then bulk
inserts via `blink.db.table(...).createMany()`. Deliberately does **not** support `.xlsx` — both
browser-side Excel-parsing libraries available on npm (`xlsx`/SheetJS, `exceljs`) carry known
unpatched vulnerabilities or a large added dependency surface; users are asked to export their
spreadsheet to CSV first instead.

## Conventions

- Source strings mostly avoid accented Portuguese characters (`Configuracoes` not
  `Configurações`, `nao` not `não`) — a repo-wide style from the original scaffold, kept for
  consistency. New user-facing strings should generally follow suit unless already inconsistent
  nearby.
- The real layout is `src/components/AppLayout.tsx` + `src/components/AppSidebar.tsx` — there is
  no other layout scaffold in the repo.
- Generic dependencies with no imports anywhere in `src/` have been deliberately removed
  (`date-fns`, `framer-motion`, `@react-three/*`, `@dnd-kit/core`, `react-hook-form`, `zod`,
  `react-hot-toast`, `react-responsive`, `@hookform/resolvers`, `@supabase/supabase-js`). Before
  adding a "might need it later" dependency, check it's actually imported before it lands in
  `package.json`.
- `@tailwindcss/vite` wants Vite 5-7, the project pins Vite 8 — a real peer dependency conflict
  (`npm install` would fail with ERESOLVE otherwise). The root `.npmrc` (`legacy-peer-deps=true`)
  handles this automatically now, so plain `npm install` works, including on Vercel.

## What NOT to do

This is a static, backend-free portfolio build on purpose — don't undo that as a side effect of
an unrelated feature request:

- **Don't add a real backend, database, or server-side API** (Supabase, Express, serverless
  functions, etc.) unless the user explicitly asks to turn this back into a real product. If a
  feature seems to need one (e.g. real auth, a paid API key that can't ship to the browser), say
  so and ask, rather than quietly wiring one up.
- **Don't reintroduce an AI assistant / any feature needing a server-held secret.** One used to
  exist here (Claude API via a Supabase Edge Function) and was removed specifically because there
  is no backend left to hold the key.
- **Don't assume multi-user/multi-device persistence.** Data lives in one browser's localStorage;
  it doesn't sync across devices or between two people looking at the demo at once. That's
  expected, not a bug to fix.

## History

Originally scaffolded by Blink (blink.new) with `@blinkdotnew/sdk` as the backend, then migrated
to a real Supabase backend (Postgres + Auth, Row Level Security) for actual per-clinic production
use — `docs/IMPLANTACAO.md` and this file used to describe that setup (Supabase SQL migrations,
env vars, a Supabase Edge Function proxying the Claude API for an "Assistente IA" feature). That
entire backend was later removed to turn this into a pure portfolio/demo piece: no accounts, no
setup, no cost, works instantly for anyone who opens the deployed link. If you see a reference to
`@blinkdotnew/sdk`, `blink.new`, Supabase, or an AI assistant feature outside of this historical
context, that's leftover/dead — none of it is installed or wired up anymore.
