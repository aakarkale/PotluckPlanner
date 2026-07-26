import { useEffect, useState } from 'react'
import { AddressInput } from '@/components/address-input'
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
import { Textarea } from '@/components/ui/textarea'
import type { EventInput } from '@/lib/api'
import { LOCATION_MAX } from '@/lib/geocode'
import type { PotluckEvent } from '@/lib/types'

interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this potluck; otherwise it creates a new one. */
  event?: PotluckEvent
  pending: boolean
  onSubmit: (input: EventInput) => void
}

export function EventFormDialog({ open, onOpenChange, event, pending, onSubmit }: EventFormDialogProps) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [guests, setGuests] = useState('20')
  // While address suggestions are showing, Escape should dismiss them rather
  // than the whole dialog (see AddressInput.onOpenChange).
  const [addressListOpen, setAddressListOpen] = useState(false)

  useEffect(() => {
    if (open) {
      // Reset with the rest of the form: a stale `true` here would keep
      // swallowing Escape after the dialog was closed with the list open.
      setAddressListOpen(false)
      setName(event?.name ?? '')
      setDate(event?.date ?? '')
      setLocation(event?.location ?? '')
      setDescription(event?.description ?? '')
      setGuests(String(event?.guestCount ?? 20))
    }
  }, [open, event])

  const guestsNum = Number.parseInt(guests, 10)
  const valid =
    name.trim().length > 0 && Number.isInteger(guestsNum) && guestsNum >= 0 && guestsNum <= 9999

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || pending) return
    onSubmit({
      name: name.trim(),
      date: date === '' ? null : date,
      location: location.trim() === '' ? null : location.trim(),
      description: description.trim() === '' ? null : description.trim(),
      guestCount: guestsNum,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (addressListOpen) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{event ? 'Edit potluck' : 'New potluck'}</DialogTitle>
          <DialogDescription>
            {event
              ? 'Update the details below — guests see changes live.'
              : 'Name it, guess the headcount, and you will get a link to share.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="event-name">Name</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friendsgiving 2026"
              maxLength={80}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="event-date">Date (optional)</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-guests">Guests expected</Label>
              <Input
                id="event-guests"
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-location">Location (optional)</Label>
            <AddressInput
              id="event-location"
              value={location}
              onChange={setLocation}
              onOpenChange={setAddressListOpen}
              placeholder="Start typing an address…"
              maxLength={LOCATION_MAX}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-description">Notes for guests (optional)</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Oven access is limited — cold dishes travel best."
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {event ? 'Save changes' : 'Create potluck'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
