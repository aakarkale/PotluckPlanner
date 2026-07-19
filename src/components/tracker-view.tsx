import { CookingPot, Plus } from 'lucide-react'
import { useState } from 'react'
import { ClaimDialog } from '@/components/claim-dialog'
import { DishCard } from '@/components/dish-card'
import { DishFormDialog } from '@/components/dish-form-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  useClaimDish,
  useCreateDish,
  useDeleteDish,
  useUpdateDish,
} from '@/hooks/use-potluck'
import type { DishInput } from '@/lib/api'
import { setDisplayName } from '@/lib/identity'
import { CATEGORIES, CATEGORY_PLURAL_LABELS, type Category, type Dish } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unclaimed' | Category

interface TrackerViewProps {
  dishes: Dish[]
  isHost: boolean
}

export function TrackerView({ dishes, isHost }: TrackerViewProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dish | undefined>(undefined)
  const [claiming, setClaiming] = useState<Dish | null>(null)
  const [deleting, setDeleting] = useState<Dish | null>(null)

  const createDish = useCreateDish()
  const updateDish = useUpdateDish()
  const claimDish = useClaimDish()
  const deleteDish = useDeleteDish()

  const unclaimedCount = dishes.filter((d) => d.broughtBy === null).length
  const filtered = dishes.filter((d) => {
    if (filter === 'all') return true
    if (filter === 'unclaimed') return d.broughtBy === null
    return d.category === filter
  })

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unclaimed', label: unclaimedCount > 0 ? `Unclaimed (${unclaimedCount})` : 'Unclaimed' },
    ...CATEGORIES.map((c) => ({ value: c as Filter, label: CATEGORY_PLURAL_LABELS[c] })),
  ]

  const submitForm = (input: DishInput) => {
    if (editing) {
      updateDish.mutate(
        { id: editing.id, input },
        { onSuccess: () => setFormOpen(false) },
      )
    } else {
      createDish.mutate(input, { onSuccess: () => setFormOpen(false) })
    }
  }

  const claim = (dish: Dish, name: string) => {
    setDisplayName(name)
    claimDish.mutate({ id: dish.id, name }, { onSuccess: () => setClaiming(null) })
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          setEditing(undefined)
          setFormOpen(true)
        }}
      >
        <Plus />
        Add a dish
      </Button>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                filter === f.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <CookingPot className="size-8 opacity-50" />
            {dishes.length === 0 ? (
              <>
                <p className="text-foreground font-medium">No dishes yet</p>
                <p className="text-sm">
                  Add the first dish, or share the link so friends can pitch in.
                </p>
              </>
            ) : (
              <p className="text-sm">No dishes match this filter.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              isHost={isHost}
              onClaim={setClaiming}
              onEdit={(d) => {
                setEditing(d)
                setFormOpen(true)
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <DishFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dish={editing}
        pending={createDish.isPending || updateDish.isPending}
        onSubmit={submitForm}
      />

      <ClaimDialog
        dish={claiming}
        onOpenChange={(open) => {
          if (!open) setClaiming(null)
        }}
        pending={claimDish.isPending}
        onClaim={claim}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the dish for everyone. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleting) deleteDish.mutate(deleting.id)
                setDeleting(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
