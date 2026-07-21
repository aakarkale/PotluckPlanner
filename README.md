# Potluck

A mobile-first web platform for potlucks. **Hosts** sign up, create potlucks,
and share one link per event; **guests** open that link and add or claim
dishes with no account, no app, no login wall. Coverage stats (servings vs.
headcount) update live on every phone.

Stack: **Vite + React SPA on Vercel, Supabase Postgres as the entire
backend** — including authentication.

## Architecture

```
Browser (static SPA on Vercel, client-side router)
   │  POST /rest/v1/rpc/potluck_<fn>   (publishable anon key)
   ▼
Supabase PostgREST
   ▼
Postgres — SECURITY DEFINER functions are the API
           (tables are RLS deny-all in private schemas;
            only the potluck_* RPC surface is callable)
```

There is no application server. Every operation — sign up/in/out, create and
manage events, add/claim/edit/delete dishes — is a Postgres function defined
in `supabase/migrations/` (the current contract is `0002_platform.sql`).

### Auth model (deliberate, documented)

Host accounts are implemented **entirely in Postgres**, not GoTrue/Supabase
Auth: bcrypt password hashes (pgcrypto) in `potluck_private.users`, and
256-bit session tokens stored only as sha256 digests in
`potluck_private.sessions` (30-day expiry; sign-in burns equal bcrypt time
for unknown emails so timing doesn't leak account existence). Why:

- The whole API stays e2e-testable against the local Postgres rig (`e2e/`).
- When colocated in a shared Supabase project, potluck signups stay out of
  the host project's `auth.users` (whose triggers must not fire for us).
- No server code and no supabase-js, same as everything else here.

Accepted limitations for this app's stakes, on purpose: no email
verification, no password-reset email (there is no mail service), and no
per-IP rate limiting (bcrypt cost + generic `invalid_credentials` are the
brake). The session token lives in localStorage — standard SPA tradeoff.

### Guest model

The share link IS the capability: `/p/<slug>` where the slug is a random
12-char code (~59 bits, no-lookalike alphabet). Hosts can rotate it at any
time, which revokes the old link instantly. Per-device dish ownership works
like v1: the browser generates a `potluck-owner-id` UUID (localStorage); the
database computes a `mine` boolean per request and never returns raw owner
ids. Convenience-grade, not adversary-safe — by design.

### Authorization

- Event admin (edit details, guest count, delete, rotate link) requires the
  host's session token; checked in-database against `host_user_id`.
- A dish can be edited/deleted by the device that created it **or** the
  event's host (admin override). Anyone with the link can claim an
  unclaimed dish (race-safe: first write wins).
- Abuse fuses: 25 events per account, 200 dishes per event.

## Routes

| Route        | Who    | What                                             |
| ------------ | ------ | ------------------------------------------------ |
| `/`          | anyone | landing page                                     |
| `/signin`, `/signup` | hosts | email + password auth                    |
| `/dashboard` | hosts  | all your potlucks with stats, create/manage      |
| `/p/<slug>`  | anyone | the potluck: tracker + overview tabs; host admin |

Routing is a ~70-line history-API router (`src/lib/router.tsx`) — same
philosophy as the 40-line RPC client. `vercel.json` rewrites all paths to
`index.html` so deep links work.

## Run & operate

- `pnpm dev` — run locally (needs `.env.local`, see `.env.example`)
- `pnpm build` / `pnpm typecheck` — production build / typecheck
- `pnpm e2e` — full Playwright walkthrough against a local replica of the
  production architecture (local Postgres + a PostgREST-protocol shim running
  the real migrations; see `e2e/`). A persistent host context and a guest
  context walk one potluck through its entire life, plus wire-level
  hardening probes.

### Deploy

1. **Supabase**: create (or reuse) a project and apply the migrations in
   `supabase/migrations/` in order. The whole contract is namespaced
   (`potluck` / `potluck_private` schemas, `potluck_*` functions, per-function
   grants), so it works in a dedicated project **or** colocated inside a
   shared one — see [`supabase/colocation/README.md`](supabase/colocation/README.md).
2. **Vercel**: import the repo; framework preset Vite. Set env vars
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key — safe
   to expose; tables are sealed and only the RPC surface is executable), or
   commit them in `.env.production` as this repo does.
3. That's it — hosts sign up in the app and mint their own share links.

## Where things live

- Database schema + entire API: `supabase/migrations/0002_platform.sql`
- RPC client: `src/lib/rpc.ts` (tiny fetch wrapper — no SDK), `src/lib/api.ts`
- Router: `src/lib/router.tsx`; identity/session: `src/lib/identity.ts`
- Auth hooks: `src/hooks/use-auth.ts`; data hooks: `src/hooks/use-potluck.ts`
- Pages: `src/pages/landing.tsx`, `auth.tsx`, `dashboard.tsx`, `event.tsx`
- Event views: `src/components/tracker-view.tsx`, `overview-view.tsx`
- Theme tokens (light + dark): `src/index.css`
