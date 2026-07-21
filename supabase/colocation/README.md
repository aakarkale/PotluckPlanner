# Colocated backend (shared Supabase project)

The canonical backend is `supabase/migrations/0001_potluck.sql`: a dedicated
Supabase project where the potluck tables live in `public` and the RPC
functions are unprefixed (`list_dishes`, `create_dish`, …).

The Supabase free tier caps an account at **2 active projects**. Until a slot
frees up, this app's backend is **colocated** inside an existing project
("been" / MapNotes, ref `mjkimkaggayvovwscrqi`) using
[`potluck_in_shared_project.sql`](./potluck_in_shared_project.sql) — a
namespaced variant of the canonical migration.

## How isolation is guaranteed

The two apps share a Postgres database but never touch each other:

| Concern | Dedicated migration | Colocated variant |
| --- | --- | --- |
| Tables | `public.dishes`, `public.settings` | `potluck.dishes`, `potluck.settings` (private schemas) |
| Host secret | `private.config` | `potluck_private.config` |
| RPC functions | `public.list_dishes`, … | `public.potluck_list_dishes`, … (prefixed) |
| Privilege reset | blanket `revoke … on all … in schema public` | **scoped** revoke/grant naming each `potluck_*` function only |

The scoped grants are the critical difference: a blanket
`revoke … in schema public` would strip privileges from the **host project's**
own tables and functions and break it. The colocated file only ever names
`potluck_*` objects.

PostgREST only exposes `public`, so the `potluck` / `potluck_private` schemas
are unreachable over the API; the `SECURITY DEFINER` functions run as owner and
reach them internally. `anon` has no `USAGE` on those schemas — verified after
apply.

## Frontend wiring

The SPA points at the colocated backend with one extra env var:

```
VITE_SUPABASE_URL=https://mjkimkaggayvovwscrqi.supabase.co
VITE_SUPABASE_ANON_KEY=<been publishable key>
VITE_RPC_PREFIX=potluck_
```

`VITE_RPC_PREFIX` is prepended to every function name in `src/lib/rpc.ts`. It
defaults to empty, so a dedicated project needs no prefix.

## Moving to a dedicated project later

Extraction is deliberately trivial:

1. Create a fresh Supabase project.
2. Run the clean `supabase/migrations/0001_potluck.sql` (public schema,
   unprefixed RPCs).
3. Seed the host secret into `private.config`.
4. Clear `VITE_RPC_PREFIX` and re-point `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` at the new project.
5. Drop the `potluck` / `potluck_private` schemas and the `potluck_*` functions
   from the shared project.
