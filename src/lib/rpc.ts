// Minimal PostgREST RPC client. The app's entire backend surface is a set of
// SECURITY DEFINER Postgres functions, so a tiny fetch wrapper replaces the
// full supabase-js SDK (which would add ~100 kB gzip of auth/realtime/storage
// we never use).

const BASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Prepended to every RPC function name. Empty for a dedicated project (the
// canonical migration exposes list_dishes, create_dish, …). Set to `potluck_`
// when the backend is colocated inside a shared project, where the functions
// are namespaced potluck_list_dishes, potluck_create_dish, … to avoid
// colliding with the host project. See supabase/colocation/README.md.
const RPC_PREFIX = import.meta.env.VITE_RPC_PREFIX ?? ''

export class RpcError extends Error {
  constructor(
    /** Raw Postgres error message, e.g. "not_allowed". */
    public readonly code: string,
  ) {
    super(code)
    this.name = 'RpcError'
  }
}

export async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/rest/v1/rpc/${RPC_PREFIX}${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON_KEY,
      authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(args),
  })

  if (!res.ok) {
    let code = `http_${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) code = body.message
    } catch {
      // keep the http status code
    }
    throw new RpcError(code)
  }

  // Functions returning void produce an empty 204 response.
  if (res.status === 204) return undefined
  const text = await res.text()
  return text === '' ? undefined : JSON.parse(text)
}
