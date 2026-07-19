import { HandHeart, Pencil, Trash2, User, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CATEGORY_LABELS, type Dish } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DishCardProps {
  dish: Dish
  isHost: boolean
  onClaim: (dish: Dish) => void
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
}

export function DishCard({ dish, isHost, onClaim, onEdit, onDelete }: DishCardProps) {
  const unclaimed = dish.broughtBy === null
  const canManage = dish.mine || isHost

  return (
    <Card
      data-testid="dish-card"
      className={cn(
        'gap-3 py-3.5 transition-colors',
        unclaimed ? 'border-unclaimed-border bg-unclaimed' : 'bg-muted/40',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{dish.name}</p>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Badge variant="secondary">{CATEGORY_LABELS[dish.category]}</Badge>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              Serves {dish.servings}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Edit ${dish.name}`}
              onClick={() => onEdit(dish)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive size-8"
              aria-label={`Delete ${dish.name}`}
              onClick={() => onDelete(dish)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-4">
        {unclaimed ? (
          <>
            <span className="text-unclaimed-foreground flex items-center gap-1.5 text-sm font-medium">
              <HandHeart className="size-4" />
              Up for grabs
            </span>
            <Button size="sm" onClick={() => onClaim(dish)}>
              Claim
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <User className="size-4" />
            Brought by <span className="text-foreground font-medium">{dish.broughtBy}</span>
          </span>
        )}
      </div>
    </Card>
  )
}
