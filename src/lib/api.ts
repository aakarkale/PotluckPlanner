import { getOwnerId, getSessionToken } from './identity'
import { rpc, RpcError } from './rpc'
import type {
  Category,
  Dish,
  EventData,
  PotluckEvent,
  PotluckEventSummary,
  Session,
  User,
} from './types'

const ERROR_MESSAGES: Record<string, string> = {
  // auth
  invalid_email: 'That email address does not look right.',
  weak_password: 'Passwords need at least 8 characters.',
  name_required: 'Enter a name first.',
  email_taken: 'An account with that email already exists — try signing in.',
  invalid_credentials: 'Wrong email or password.',
  not_signed_in: 'Your session expired. Sign in again to continue.',
  // events
  event_not_found: 'That potluck does not exist — the link may have changed.',
  not_event_host: 'Only the host of this potluck can do that.',
  event_limit_reached: 'You have reached the limit of 25 potlucks per account.',
  guest_count_out_of_range: 'Guest count must be between 0 and 9999.',
  slug_generation_failed: 'Could not mint a share link. Please try again.',
  // dishes
  dish_not_found: 'That dish no longer exists.',
  not_allowed: 'Only the person who added this dish (or the host) can change it.',
  already_claimed: 'Someone beat you to it — this dish was just claimed.',
  owner_required: 'Could not identify this device. Reload and try again.',
  dish_limit_reached: 'This potluck has reached its limit of 200 dishes.',
}

/** RpcError with the raw code preserved and a human message attached. */
export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.')
    this.name = 'ApiError'
  }
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  try {
    return (await rpc(fn, args)) as T
  } catch (error) {
    console.error(`rpc ${fn} failed:`, error)
    if (error instanceof RpcError) throw new ApiError(error.code)
    throw new Error("Can't reach the potluck right now. Check your connection.")
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function signUp(email: string, password: string, name: string): Promise<Session> {
  return call<Session>('sign_up', { p_email: email, p_password: password, p_name: name })
}

export function signIn(email: string, password: string): Promise<Session> {
  return call<Session>('sign_in', { p_email: email, p_password: password })
}

export function signOut(token: string): Promise<void> {
  return call<void>('sign_out', { p_token: token })
}

export async function me(token: string): Promise<User | null> {
  return (await call<User | null>('me', { p_token: token })) ?? null
}

export function changePassword(current: string, next: string): Promise<void> {
  return call<void>('change_password', {
    p_token: getSessionToken(),
    p_current: current,
    p_new: next,
  })
}

// ---------------------------------------------------------------------------
// Events (host admin)
// ---------------------------------------------------------------------------

export interface EventInput {
  name: string
  date: string | null
  location: string | null
  description: string | null
  guestCount: number
}

export function createEvent(input: EventInput): Promise<PotluckEvent> {
  return call<PotluckEvent>('create_event', {
    p_token: getSessionToken(),
    p_name: input.name,
    p_date: input.date,
    p_location: input.location,
    p_description: input.description,
    p_guest_count: input.guestCount,
  })
}

export function updateEvent(id: string, input: EventInput): Promise<PotluckEvent> {
  return call<PotluckEvent>('update_event', {
    p_event_id: id,
    p_token: getSessionToken(),
    p_name: input.name,
    p_date: input.date,
    p_clear_date: input.date === null,
    p_location: input.location,
    p_clear_location: input.location === null,
    p_description: input.description,
    p_clear_description: input.description === null,
    p_guest_count: input.guestCount,
  })
}

export function setGuestCount(id: string, guestCount: number): Promise<PotluckEvent> {
  return call<PotluckEvent>('update_event', {
    p_event_id: id,
    p_token: getSessionToken(),
    p_guest_count: guestCount,
  })
}

export function deleteEvent(id: string): Promise<void> {
  return call<void>('delete_event', { p_event_id: id, p_token: getSessionToken() })
}

export function rotateSlug(id: string): Promise<PotluckEvent> {
  return call<PotluckEvent>('rotate_slug', { p_event_id: id, p_token: getSessionToken() })
}

export function myEvents(): Promise<PotluckEventSummary[]> {
  return call<PotluckEventSummary[]>('my_events', { p_token: getSessionToken() })
}

// ---------------------------------------------------------------------------
// The event page (guests + host, one request per poll)
// ---------------------------------------------------------------------------

export function getEvent(slug: string): Promise<EventData> {
  return call<EventData>('get_event', {
    p_slug: slug,
    p_owner: getOwnerId(),
    p_token: getSessionToken(),
  })
}

// ---------------------------------------------------------------------------
// Dishes (guests via share link; hosts get an admin override via token)
// ---------------------------------------------------------------------------

export interface DishInput {
  name: string
  category: Category
  servings: number
  broughtBy: string | null
}

export function createDish(slug: string, input: DishInput): Promise<Dish> {
  return call<Dish>('create_dish', {
    p_slug: slug,
    p_owner: getOwnerId(),
    p_name: input.name,
    p_category: input.category,
    p_servings: input.servings,
    p_brought_by: input.broughtBy,
  })
}

export function updateDish(id: string, input: DishInput): Promise<Dish> {
  return call<Dish>('update_dish', {
    p_id: id,
    p_owner: getOwnerId(),
    p_token: getSessionToken(),
    p_name: input.name,
    p_category: input.category,
    p_servings: input.servings,
    p_brought_by: input.broughtBy,
    p_clear_brought_by: input.broughtBy === null,
  })
}

export function claimDish(id: string, name: string): Promise<Dish> {
  return call<Dish>('claim_dish', { p_id: id, p_owner: getOwnerId(), p_name: name })
}

export function deleteDish(id: string): Promise<void> {
  return call<void>('delete_dish', {
    p_id: id,
    p_owner: getOwnerId(),
    p_token: getSessionToken(),
  })
}
