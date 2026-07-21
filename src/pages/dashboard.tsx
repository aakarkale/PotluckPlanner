import {
  CalendarDays,
  HandPlatter,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  PartyPopper,
  Plus,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { EventFormDialog } from '@/components/event-form-dialog'
import { Header } from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useAuth, useChangePassword, useSignOut } from '@/hooks/use-auth'
import { useCreateEvent, useMyEvents } from '@/hooks/use-potluck'
import { useTitle } from '@/hooks/use-title'
import { Link, navigate } from '@/lib/router'
import { copyEventLink, formatEventDate } from '@/lib/share'
import type { PotluckEventSummary } from '@/lib/types'

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const changePassword = useChangePassword(() => onOpenChange(false))

  useEffect(() => {
    if (open) {
      setCurrent('')
      setNext('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Every other signed-in device will be signed out.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!changePassword.isPending) changePassword.mutate({ current, next })
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EventCard({ event }: { event: PotluckEventSummary }) {
  const coverage =
    event.guestCount > 0 ? Math.round((event.totalServings / event.guestCount) * 100) : null

  return (
    <Card data-testid="event-card" className="gap-3 py-4">
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="min-w-0">
          <Link
            to={`/p/${event.slug}`}
            className="hover:text-primary truncate text-base font-semibold transition-colors"
          >
            {event.name}
          </Link>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {event.date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatEventDate(event.date)}
              </span>
            )}
            {event.location && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
        </div>
        {event.unclaimedCount > 0 && (
          <Badge variant="secondary" className="border-unclaimed-border bg-unclaimed text-unclaimed-foreground shrink-0 border">
            {event.unclaimedCount} unclaimed
          </Badge>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-4 px-4 text-sm">
        <span className="flex items-center gap-1.5">
          <UtensilsCrossed className="size-3.5" />
          {event.dishCount} {event.dishCount === 1 ? 'dish' : 'dishes'}
        </span>
        <span className="flex items-center gap-1.5">
          <HandPlatter className="size-3.5" />
          {event.totalServings} servings
        </span>
        {coverage !== null && (
          <span className="tabular-nums">{coverage}% covered</span>
        )}
      </div>

      <div className="flex items-center gap-2 px-4">
        <Button asChild size="sm" className="flex-1">
          <Link to={`/p/${event.slug}`}>Open</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => copyEventLink(event.slug)}
        >
          <Link2 />
          Copy link
        </Button>
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, isPending } = useAuth()
  const events = useMyEvents(user !== null)
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const signOut = useSignOut(() => navigate('/'))
  const createEvent = useCreateEvent((slug) => {
    setCreateOpen(false)
    navigate(`/p/${slug}`)
  })

  useTitle('Your potlucks — Potluck')

  // Route guard: this page is for signed-in hosts.
  useEffect(() => {
    if (!isPending && !user) navigate('/signin', { replace: true })
  }, [isPending, user])

  if (isPending || !user) {
    return (
      <div className="min-h-dvh">
        <Header />
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <Header brandTo="/dashboard">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change password"
          onClick={() => setPasswordOpen(true)}
        >
          <KeyRound className="size-4.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut />
          Sign out
        </Button>
      </Header>

      <main className="mx-auto max-w-2xl px-4 pt-6 pb-12">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your potlucks</h1>
            <p className="text-muted-foreground text-sm">Signed in as {user.name}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            New potluck
          </Button>
        </div>

        {events.isPending ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading your potlucks…
          </div>
        ) : events.isError ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              <p className="text-foreground mb-1 font-medium">Couldn&apos;t load your potlucks</p>
              <p>Check your connection — retrying automatically.</p>
            </CardContent>
          </Card>
        ) : events.data.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
              <PartyPopper className="size-10 opacity-50" />
              <div>
                <p className="text-foreground font-medium">No potlucks yet</p>
                <p className="mt-1 text-sm">
                  Create your first one — you&apos;ll get a link your guests can open without
                  signing up.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Create a potluck
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {events.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      <EventFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pending={createEvent.isPending}
        onSubmit={(input) => createEvent.mutate(input)}
      />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  )
}
