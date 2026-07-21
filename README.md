# Potluck Tracker

A mobile-first single-page web app for organizing one potluck — anyone with the
shared link can add/claim/edit/delete dishes and see live coverage stats. No login.

Rebuilt from the original Replit version on a leaner stack:
**Vite + React SPA on Vercel, Supabase Postgres as the entire backend.**

## Architecture

```
Browser (static SPA on Vercel)
   │  POST /rest/v1/rpc/<fn>   (publishable anon key)
   ▼
Supabase PostgREST
   ▼
Postgres — SECURITY DEFINER functions are the API
           (tables are RLS deny-all; only the RPC surface is callable)
```

There is no application server. Every operation — list/create/update/claim/
delete dish, get/set guest count, verify host — is a Postgres function in
`supabase/migrations/0001_potluck.sql`. Key properties:

- **Per-device ownership, enforced in the database.** The browser generates a
  random `potluck-owner-id` UUID (localStorage) and passes it to each call.
  The raw `owner_id` of a dish never leaves the database; functions return a
  computed `mine` boolean instead, so clients can't spoof identity by reading
  another dish's owner. Convenience-grade, not adversary-safe — same tradeoff
  as the original.
- **Host mode.** Store a secret in `private.config` (`key = 'host_secret'`),
  then open `/?host=<secret>` once per device: verified in-database, persisted
  in localStorage, full edit/delete on every dish, exit via the header pill.
  No secret stored → host mode is disabled entirely.
- **Live updates** via TanStack Query polling (1.5 s) — deliberately simpler
  than websockets at ~20-friend scale (same decision as the original).
- **Singleton settings row** keyed by `id = true` so guest count is one
  upsert away.

## Run & operate

- `pnpm dev` — run locally (needs `.env.local`, see `.env.example`)
- `pnpm build` / `pnpm typecheck` — production build / typecheck
- `pnpm e2e` — full Playwright walkthrough against a local replica of the
  production architecture (local Postgres + a PostgREST-protocol shim running
  the real migration; see `e2e/`). Two browser contexts simulate two devices.

### Deploy

1. **Supabase**: create a project, run `supabase/migrations/0001_potluck.sql`,
   then seed the host secret:
   `insert into private.config values ('host_secret', '<random string>');`
2. **Vercel**: import the repo; framework preset Vite. Set env vars
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key — safe to
   expose; tables are sealed and only the RPC functions are executable).
3. Share the plain URL with guests; keep the `/?host=<secret>` link for
   yourself.

> **Colocated backend:** if you can't spare a dedicated Supabase project (the
> free tier caps you at 2), the backend can live inside an existing project
> under private `potluck` schemas with `potluck_`-prefixed RPCs. Run
> `supabase/colocation/potluck_in_shared_project.sql` instead of step 1's
> migration and set `VITE_RPC_PREFIX=potluck_` in Vercel. See
> [`supabase/colocation/README.md`](supabase/colocation/README.md).

## Where things live

- Database schema + entire API: `supabase/migrations/0001_potluck.sql`
- RPC client: `src/lib/rpc.ts` (tiny fetch wrapper — no SDK), `src/lib/api.ts`
- Identity/host persistence: `src/lib/identity.ts`, `src/hooks/use-host.ts`
- Queries/mutations: `src/hooks/use-potluck.ts`
- Views: `src/components/tracker-view.tsx`, `dashboard-view.tsx`
- Theme tokens (light + dark): `src/index.css`
