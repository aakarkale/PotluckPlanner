// Local stand-in for the Supabase REST gateway (Kong + PostgREST), used only
// by the E2E suite. It speaks the same wire protocol the app uses in
// production — POST /rest/v1/rpc/<fn> with JSON named arguments — and runs
// each call in a transaction as the `anon` role, so Postgres enforces exactly
// the grants/RLS/SECURITY DEFINER model that Supabase's PostgREST enforces.
// GET /rest/v1/<table> is supported purely so tests can prove direct table
// access is denied.
import http from 'node:http'
import pg from 'pg'

const PORT = 3002
const IDENT = /^[a-z_][a-z0-9_]*$/

const pool = new pg.Pool({
  connectionString: 'postgres://authenticator:postgres@127.0.0.1:5432/potluck_e2e',
})

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, apikey, authorization',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

function send(res, status, body) {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

async function asAnon(run) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('set local role anon')
    const result = await run(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  if (req.url === '/health') return send(res, 200, { ok: true })
  if (!req.headers.apikey || !req.headers.authorization) {
    return send(res, 401, { message: 'No API key found in request' })
  }

  const url = new URL(req.url, 'http://localhost')
  const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)
  const tableMatch = url.pathname.match(/^\/rest\/v1\/([^/]+)$/)

  try {
    if (rpcMatch && req.method === 'POST') {
      const fn = rpcMatch[1]
      if (!IDENT.test(fn)) return send(res, 404, { message: 'unknown function' })

      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const args = JSON.parse(Buffer.concat(chunks).toString() || '{}')

      const names = Object.keys(args)
      if (!names.every((n) => IDENT.test(n))) {
        return send(res, 400, { message: 'bad argument name' })
      }
      const argSql = names.map((n, i) => `${n} := $${i + 1}`).join(', ')
      const values = names.map((n) => {
        const v = args[n]
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
      })

      const { rows } = await asAnon((c) =>
        c.query(`select public.${fn}(${argSql}) as result`, values),
      )
      const result = rows[0]?.result
      if (result === undefined || result === null || result === '') {
        return send(res, 204, undefined)
      }
      return send(res, 200, result)
    }

    if (tableMatch && req.method === 'GET') {
      const table = tableMatch[1]
      if (!IDENT.test(table)) return send(res, 404, { message: 'unknown relation' })
      const { rows } = await asAnon((c) => c.query(`select * from public.${table}`))
      return send(res, 200, rows)
    }

    return send(res, 404, { message: 'not found' })
  } catch (error) {
    const denied = error.code === '42501' // insufficient_privilege
    return send(res, denied ? 403 : 400, { message: error.message ?? 'error' })
  }
})

server.listen(PORT, () => {
  console.log(`rest shim ready on http://127.0.0.1:${PORT}/rest/v1`)
})
