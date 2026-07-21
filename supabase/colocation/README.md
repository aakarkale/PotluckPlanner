# Running the backend inside a shared Supabase project

The Supabase free tier caps an account at **2 active projects**. This app is
built so its backend can live **colocated** inside an existing project (it
currently lives in "been" / MapNotes, ref `mjkimkaggayvovwscrqi`) — or in a
dedicated project — from the *same* migration files, with no variants to
maintain.

Since `0002_platform.sql`, the canonical contract in
[`supabase/migrations/`](../migrations) is namespaced end-to-end:

| Concern | Where it lives |
| --- | --- |
| Tables | `potluck.events`, `potluck.dishes` — private schema, no API access |
| Accounts + sessions | `potluck_private.users`, `potluck_private.sessions` |
| RPC functions | `public.potluck_*` (PostgREST only exposes `public`) |
| Grants | scoped revoke/grant naming each `potluck_*` function |

Two rules make shared-project colocation safe:

1. **Never a blanket revoke.** The migrations never run
   `revoke ... on all ... in schema public` — that would strip privileges
   from the host project's own tables and functions and break it. Every
   grant names a specific potluck function.
2. **Never touch `auth.users`.** Host accounts are implemented in
   `potluck_private` with pgcrypto, so potluck signups can't fire the host
   project's auth triggers or pollute its user table.

The API roles (`anon`, `authenticated`) have no `USAGE` on the potluck
schemas; the `SECURITY DEFINER` functions are the only reachable surface.

## Moving to a dedicated project later

1. Create a fresh Supabase project and apply `supabase/migrations/` in order.
2. Re-point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`.env.production`
   or Vercel env vars).
3. Export/import the potluck data if you want to keep it (`potluck` and
   `potluck_private` schemas), then drop those schemas and the `potluck_*`
   functions from the shared project.

No frontend changes needed — the RPC prefix is the same everywhere.
