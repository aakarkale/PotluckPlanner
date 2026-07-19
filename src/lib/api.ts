import { getHostSecret, getOwnerId } from './identity'
import { rpc, RpcError } from './rpc'
import type { Category, Dish, Settings } from './types'

const ERROR_MESSAGES: Record<string, string> = {
  dish_not_found: 'That dish no longer exists.',
  not_allowed: 'Only the person who added this dish (or a host) can change it.',
  already_claimed: 'Someone beat you to it — this dish was just claimed.',
  name_required: 'Enter a name first.',
  owner_required: 'Could not identify this device. Reload and try again.',
  guest_count_out_of_range: 'Guest count must be between 0 and 9999.',
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  try {
    return (await rpc(fn, args)) as T
  } catch (error) {
    console.error(`rpc ${fn} failed:`, error)
    if (error instanceof RpcError) {
      throw new Error(ERROR_MESSAGES[error.code] ?? 'Something went wrong. Please try again.')
    }
    throw new Error("Can't reach the potluck right now. Check your connection.")
  }
}

export interface DishInput {
  name: string
  category: Category
  servings: number
  broughtBy: string | null
}

export function listDishes(): Promise<Dish[]> {
  return call<Dish[]>('list_dishes', { p_owner: getOwnerId() })
}

export function createDish(input: DishInput): Promise<Dish> {
  return call<Dish>('create_dish', {
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
    p_host: getHostSecret(),
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
  return call<void>('delete_dish', { p_id: id, p_owner: getOwnerId(), p_host: getHostSecret() })
}

export function getSettings(): Promise<Settings> {
  return call<Settings>('get_settings', {})
}

export function setGuestCount(count: number): Promise<Settings> {
  return call<Settings>('set_guest_count', { p_count: count })
}

export function verifyHost(secret: string): Promise<boolean> {
  return call<boolean>('verify_host', { p_host: secret })
}
