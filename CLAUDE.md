# Potluck Tracker

Mobile-first SPA for organizing one potluck: shared link, no login, live
coverage stats. Vite + React 19 + Tailwind v4 + shadcn/ui subset, TanStack
Query. Backend is Supabase Postgres only — SECURITY DEFINER RPC functions are
the whole API (no server code). See README.md for architecture.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm typecheck`
- `pnpm e2e` — Playwright suite against a local Postgres + PostgREST-protocol
  shim (`e2e/rest-shim.mjs`). Requires local Postgres running
  (`sudo service postgresql start`); `e2e/setup-local.sh` provisions the
  `potluck_e2e` database from the real migration on every run.

## Rules

- The API contract lives in `supabase/migrations/0001_potluck.sql`. When
  changing it, keep: tables RLS deny-all with no policies; `owner_id` never
  returned to clients (`mine` computed per request instead); explicit
  revoke-then-grant of the RPC surface to `anon, authenticated`;
  `set search_path = ''` + fully-qualified names in every function.
- Schema changes = a new numbered migration file, applied to the Supabase
  project; also re-run `pnpm e2e` (the local rig always applies all
  migrations).
- Frontend errors: Postgres `raise exception 'snake_case_code'` maps to
  friendly copy in `ERROR_MESSAGES` (`src/lib/api.ts`). Add new codes there.
- No emojis in the UI; lucide-react icons only. Light/dark theme toggle in the
  header (storage key `potluck-theme`, pre-paint script in `index.html`).
- Mobile-first: most users are on phones. Keep the layout inside
  `max-w-2xl` and test at ~390 px width.
- Live updates are 1.5 s polling by design — don't introduce websockets or
  Supabase Realtime without being asked.
- Keep dependencies lean: no supabase-js (the 40-line `src/lib/rpc.ts` is the
  client), only the shadcn components actually used.
