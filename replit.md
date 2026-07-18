# Potluck Tracker

A mobile-first single-page web app for organizing one potluck — anyone with the shared link can add/claim/edit/delete dishes and see live coverage stats. No login.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/potluck run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Optional env: `POTLUCK_HOST_SECRET` — when set, anyone visiting `?host=<secret>` becomes a host (full edit/delete on every dish, persisted in localStorage). Without it, host mode is disabled entirely.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, shadcn/ui, Tailwind, next-themes, sonner, lucide-react
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/` (`dishes.ts`, `settings.ts`)
- API routes: `artifacts/api-server/src/routes/` (`dishes.ts`, `settings.ts`)
- Frontend entry: `artifacts/potluck/src/App.tsx` → `src/pages/potluck.tsx`
- Tracker / Dashboard views: `artifacts/potluck/src/components/tracker-view.tsx`, `dashboard-view.tsx`
- Theme tokens (light + dark): `artifacts/potluck/src/index.css`

## Architecture decisions

- One singleton `settings` row keyed by a boolean `id = true` so guest count is always one upsert away.
- Live updates via react-query `refetchInterval: 1500` on `useListDishes` + `useGetSettings` — simpler than websockets and fits the ~20-friend scale.
- No accounts and no per-potluck routing: one app instance == one potluck. The shared URL is just `window.location.href`.
- Frontend assumes `broughtBy: null` means "unclaimed" (soft-yellow card); any value means "claimed" (muted card).
- Dish ownership is per-device: the browser generates a random `potluck-owner-id` in localStorage and sends it as the `x-potluck-owner` header on every same-origin `/api/*` call (a fetch wrapper in `main.tsx` injects this header — and `x-potluck-host` when in host mode — only for own-origin requests, never cross-origin). POST stamps the new dish with that owner; PATCH/DELETE require either a matching owner or the host header (`x-potluck-host` = `POTLUCK_HOST_SECRET`). The server never returns the raw `ownerId`; instead it computes a per-request `mine` boolean per dish so clients can't spoof identity by reading another dish's owner. Edit/Delete buttons in the UI are hidden unless `dish.mine` is true. Dishes created before this feature have `ownerId = null` and can only be edited by a host. Note: this is convenience-grade ownership, not adversary-safe — there is no real authentication.

## Product

- Tracker view: add a dish, list of dish cards (claimed vs unclaimed styling), filter chips by category + Unclaimed, edit/delete with confirmation.
- Dashboard view: 4 stat cards (Total Items, Total Servings, editable Guest Count, color-coded Coverage %) and a Category Breakdown table.
- Sticky header with Copy Share Link and a persisted light/dark mode toggle in the top-right.

## User preferences

- Mobile-first — most users open this on a phone.
- Light/dark mode toggle in the top-right header.
- No emojis in the UI; lucide-react icons only.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before using the new types in the frontend or backend.
- After editing `lib/db/src/schema/`, run `pnpm --filter @workspace/db run push` to apply changes to the dev DB.

## Deployment

- Live at `https://potluck.aakarkale.com` (custom domain via Cloudflare DNS → Replit Deployments).
- `POTLUCK_HOST_SECRET` is set as a Replit Secret. **After changing or first-adding this secret, redeploy** so the production instance picks it up.
- Admin/host access: open `https://potluck.aakarkale.com/?host=<POTLUCK_HOST_SECRET>` once per device — host mode persists in localStorage; a host pill in the header lets you exit.
- Share the plain `https://potluck.aakarkale.com` link with guests (no admin powers).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
