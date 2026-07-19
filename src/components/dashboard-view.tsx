import { Check, Gauge, HandPlatter, Pencil, Users, UtensilsCrossed, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSetGuestCount } from '@/hooks/use-potluck'
import { CATEGORIES, CATEGORY_PLURAL_LABELS, type Dish, type Settings } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DashboardViewProps {
  dishes: Dish[]
  settings: Settings
}

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-2 py-3.5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex-row items-center gap-1.5">
        <Icon className="text-muted-foreground size-4" />
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function DashboardView({ dishes, settings }: DashboardViewProps) {
  const setGuestCount = useSetGuestCount()
  const [editingGuests, setEditingGuests] = useState(false)
  const [draft, setDraft] = useState('')

  const totalItems = dishes.length
  const totalServings = dishes.reduce((sum, d) => sum + d.servings, 0)
  const { guestCount } = settings
  const coverage = guestCount > 0 ? Math.round((totalServings / guestCount) * 100) : null
  const shortBy = Math.max(0, guestCount - totalServings)

  const coverageColor =
    coverage === null
      ? 'text-muted-foreground'
      : coverage >= 100
        ? 'text-success'
        : coverage >= 60
          ? 'text-warning'
          : 'text-destructive'

  const startEditing = () => {
    setDraft(String(guestCount))
    setEditingGuests(true)
  }

  const saveGuests = () => {
    const n = Number.parseInt(draft, 10)
    if (Number.isInteger(n) && n >= 0 && n <= 9999 && n !== guestCount) {
      setGuestCount.mutate(n)
    }
    setEditingGuests(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={UtensilsCrossed} label="Total Items">
          <p className="text-2xl font-semibold tabular-nums">{totalItems}</p>
        </StatCard>

        <StatCard icon={HandPlatter} label="Total Servings">
          <p className="text-2xl font-semibold tabular-nums">{totalServings}</p>
        </StatCard>

        <StatCard icon={Users} label="Guest Count">
          {editingGuests ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                saveGuests()
              }}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 w-16 px-2 text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingGuests(false)
                }}
              />
              <Button type="submit" variant="ghost" size="icon" className="size-7" aria-label="Save guest count">
                <Check className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Cancel"
                onClick={() => setEditingGuests(false)}
              >
                <X className="size-4" />
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-2xl font-semibold tabular-nums">{guestCount}</p>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-7"
                aria-label="Edit guest count"
                onClick={startEditing}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          )}
        </StatCard>

        <StatCard icon={Gauge} label="Coverage">
          <p className={cn('text-2xl font-semibold tabular-nums', coverageColor)}>
            {coverage === null ? '—' : `${coverage}%`}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {coverage === null
              ? 'Set a guest count'
              : shortBy > 0
                ? `${shortBy} serving${shortBy === 1 ? '' : 's'} short`
                : "Everyone's covered"}
          </p>
        </StatCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            {CATEGORIES.map((category) => {
              const items = dishes.filter((d) => d.category === category)
              const servings = items.reduce((sum, d) => sum + d.servings, 0)
              const share = totalServings > 0 ? (servings / totalServings) * 100 : 0
              return (
                <div
                  key={category}
                  className={cn(
                    'border-b py-2.5 last:border-b-0 last:pb-0 first:pt-0',
                    items.length === 0 && 'opacity-45',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{CATEGORY_PLURAL_LABELS[category]}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {items.length} {items.length === 1 ? 'item' : 'items'} · {servings}{' '}
                      {servings === 1 ? 'serving' : 'servings'}
                    </span>
                  </div>
                  <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
