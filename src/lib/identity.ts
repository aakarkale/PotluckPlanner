// Per-device identity, persisted in localStorage. Convenience-grade, not
// adversary-safe: the owner id is an unguessable UUID that acts as a bearer
// token for the dishes this device created.

const OWNER_KEY = 'potluck-owner-id'
const HOST_KEY = 'potluck-host-secret'
const NAME_KEY = 'potluck-display-name'

export function getOwnerId(): string {
  let id = localStorage.getItem(OWNER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(OWNER_KEY, id)
  }
  return id
}

export function getHostSecret(): string | null {
  return localStorage.getItem(HOST_KEY)
}

export function setHostSecret(secret: string) {
  localStorage.setItem(HOST_KEY, secret)
}

export function clearHostSecret() {
  localStorage.removeItem(HOST_KEY)
}

export function getDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function setDisplayName(name: string) {
  localStorage.setItem(NAME_KEY, name)
}
