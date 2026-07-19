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

export interface Settings {
  guestCount: number
  updatedAt: string
}
