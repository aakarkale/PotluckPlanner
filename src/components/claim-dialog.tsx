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
import { getDisplayName } from '@/lib/identity'
import type { Dish } from '@/lib/types'

interface ClaimDialogProps {
  dish: Dish | null
  onOpenChange: (open: boolean) => void
  pending: boolean
  onClaim: (dish: Dish, name: string) => void
}

export function ClaimDialog({ dish, onOpenChange, pending, onClaim }: ClaimDialogProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (dish) setName(getDisplayName())
  }, [dish])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dish || name.trim() === '' || pending) return
    onClaim(dish, name.trim())
  }

  return (
    <Dialog open={dish !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim {dish?.name}</DialogTitle>
          <DialogDescription>
            Put your name on it so everyone knows it&apos;s covered.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="claim-name">Your name</Label>
            <Input
              id="claim-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sam"
              maxLength={80}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={name.trim() === '' || pending}>
              Claim dish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
