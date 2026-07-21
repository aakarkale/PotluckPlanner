// Client-side identity, persisted in localStorage.
//
// Guests: a per-device owner UUID — convenience-grade, not adversary-safe:
// it acts as a bearer token for the dishes this device created.
// Hosts: an opaque 256-bit session token minted by the database on
// sign in / sign up (see supabase/migrations/0002_platform.sql).

const OWNER_KEY = 'potluck-owner-id'
const NAME_KEY = 'potluck-display-name'
const SESSION_KEY = 'potluck-session'

export function getOwnerId(): string {
  let id = localStorage.getItem(OWNER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(OWNER_KEY, id)
  }
  return id
}

export function getDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function setDisplayName(name: string) {
  localStorage.setItem(NAME_KEY, name)
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token: string) {
  localStorage.setItem(SESSION_KEY, token)
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY)
}
