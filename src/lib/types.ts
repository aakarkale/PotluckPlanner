export const CATEGORIES = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  appetizer: 'Appetizer',
  main: 'Main',
  side: 'Side',
  dessert: 'Dessert',
  drink: 'Drink',
  other: 'Other',
}

export const CATEGORY_PLURAL_LABELS: Record<Category, string> = {
  appetizer: 'Appetizers',
  main: 'Mains',
  side: 'Sides',
  dessert: 'Desserts',
  drink: 'Drinks',
  other: 'Other',
}

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface PotluckEvent {
  id: string
  slug: string
  name: string
  /** ISO date (YYYY-MM-DD) or null. */
  date: string | null
  location: string | null
  description: string | null
  guestCount: number
  isHost: boolean
  createdAt: string
  updatedAt: string
}

/** Event as returned by my_events — includes dashboard stats. */
export interface PotluckEventSummary extends PotluckEvent {
  dishCount: number
  totalServings: number
  unclaimedCount: number
}

export interface Dish {
  id: string
  name: string
  category: Category
  servings: number
  broughtBy: string | null
  mine: boolean
  createdAt: string
  updatedAt: string
}

/** One poll of the event page: everything a guest or host needs. */
export interface EventData {
  event: PotluckEvent
  dishes: Dish[]
}

export interface Session {
  token: string
  user: User
}
