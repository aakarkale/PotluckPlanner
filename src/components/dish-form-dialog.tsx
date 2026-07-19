import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DishInput } from '@/lib/api'
import { CATEGORIES, CATEGORY_LABELS, type Category, type Dish } from '@/lib/types'

interface DishFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this dish; otherwise it adds a new one. */
  dish?: Dish
  pending: boolean
  onSubmit: (input: DishInput) => void
}

export function DishFormDialog({ open, onOpenChange, dish, pending, onSubmit }: DishFormDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('main')
  const [servings, setServings] = useState('')
  const [broughtBy, setBroughtBy] = useState('')

  useEffect(() => {
    if (open) {
      setName(dish?.name ?? '')
      setCategory(dish?.category ?? 'main')
      setServings(dish ? String(dish.servings) : '')
      setBroughtBy(dish?.broughtBy ?? '')
    }
  }, [open, dish])

  const servingsNum = Number.parseInt(servings, 10)
  const valid =
    name.trim().length > 0 && Number.isInteger(servingsNum) && servingsNum >= 1 && servingsNum <= 999

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || pending) return
    onSubmit({
      name: name.trim(),
      category,
      servings: servingsNum,
      broughtBy: broughtBy.trim() === '' ? null : broughtBy.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dish ? 'Edit dish' : 'Add a dish'}</DialogTitle>
          <DialogDescription>
            {dish
              ? 'Update the details below.'
              : 'Leave "Who\'s bringing it?" blank to mark it up for grabs.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dish-name">Dish</Label>
            <Input
              id="dish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mac and cheese"
              maxLength={120}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="dish-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="dish-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dish-servings">Servings</Label>
              <Input
                id="dish-servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="8"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dish-brought-by">Who&apos;s bringing it? (optional)</Label>
            <Input
              id="dish-brought-by"
              value={broughtBy}
              onChange={(e) => setBroughtBy(e.target.value)}
              placeholder="Leave blank if up for grabs"
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {dish ? 'Save changes' : 'Add dish'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
