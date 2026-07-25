# Potluck

Mobile-first SPA platform for potlucks: hosts sign up and create events;
guests join via `/p/<slug>` share links with no login; live coverage stats.
Vite + React 19 + Tailwind v4 + shadcn/ui subset, TanStack Query. Backend is
Supabase Postgres only — SECURITY DEFINER RPC functions are the whole API
(no server code, and auth is custom Postgres too — NOT GoTrue). See
README.md for architecture.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm typecheck`
- `pnpm e2e` — Playwright suite against a local Postgres + PostgREST-protocol
  shim (`e2e/rest-shim.mjs`). Requires local Postgres running
  (`sudo service postgresql start`); `e2e/setup-local.sh` provisions the
  `potluck_e2e` database from the real migrations on every run.

## Rules

- The API contract lives in `supabase/migrations/` (current:
  `0002_platform.sql`), namespaced so the same SQL works dedicated or
  colocated in a shared Supabase project. When changing it, keep: tables in
  the private `potluck`/`potluck_private` schemas, RLS-enabled, no policies;
  functions `potluck_`-prefixed in `public` with `security definer`,
  `set search_path = ''`, fully-qualified names; grants scoped per function —
  NEVER `revoke ... on all ... in schema public` (it would break the host
  project when colocated); raw ids/hashes (`owner_id`, `host_user_id`,
  `password_hash`, `token_hash`, other users' emails) never serialized to
  clients.
- Schema changes = a new numbered migration file, applied to the Supabase
  project; also re-run `pnpm e2e` (the local rig always applies all
  migrations in order).
- Auth: bcrypt via pgcrypto (`extensions.crypt`), session tokens hashed with
  sha256 in `potluck_private.sessions`. Do not introduce GoTrue/supabase-js —
  custom Postgres auth is deliberate (e2e-testable, shared-project-safe).
- Frontend errors: Postgres `raise exception 'snake_case_code'` maps to
  friendly copy in `ERROR_MESSAGES` (`src/lib/api.ts`). Add new codes there.
- Routing is the hand-rolled `src/lib/router.tsx` (history API, 5 routes).
  Don't add react-router. New routes need `parseRoute` + the switch in
  `App.tsx`; the `vercel.json` SPA rewrite already covers them.
- No emojis in the UI; lucide-react icons only. Light/dark theme toggle in the
  header (storage key `potluck-theme`, pre-paint script in `index.html`).
- Mobile-first: most users are on phones. App views stay inside `max-w-2xl`;
  the landing page may use wider marketing sections (`max-w-5xl`). Test at
  ~390 px width.
- Live updates are polling by design (1.5 s on the event page, 5 s on the
  dashboard) — don't introduce websockets or Supabase Realtime without being
  asked.
- Keep dependencies lean: no supabase-js (the ~50-line `src/lib/rpc.ts` is
  the client; note the `potluck_` RPC prefix default), only the shadcn
  components actually used.
- Two keyless third-party APIs are called from the browser: Photon
  (`src/lib/geocode.ts`, address suggestions) and Openverse
  (`src/lib/event-image.ts`, header artwork). Rules: no API keys ever, both
  must fail silently to the pre-feature UI, results cached in localStorage,
  and artwork stays `license=cc0,pdm` + `mature=false` behind a blur. E2E
  stubs both via `page.route` — keep new tests hermetic.
