import {
  CalendarDays,
  CookingPot,
  LayoutDashboard,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { EventFormDialog } from '@/components/event-form-dialog'
import { Header } from '@/components/header'
import { HeaderBackdrop } from '@/components/header-backdrop'
import { OverviewView } from '@/components/overview-view'
import { TrackerView } from '@/components/tracker-view'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import {
  useDeleteEvent,
  useEvent,
  useRotateSlug,
  useUpdateEvent,
} from '@/hooks/use-potluck'
import { useTitle } from '@/hooks/use-title'
import { ApiError } from '@/lib/api'
import { Link, navigate } from '@/lib/router'
import { copyEventLink, formatEventDate } from '@/lib/share'
import type { PotluckEvent } from '@/lib/types'

function EventNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-10 pb-12">
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
          <CookingPot className="size-10 opacity-50" />
          <div>
            <p className="text-foreground font-medium">This potluck doesn&apos;t exist</p>
            <p className="mt-1 text-sm">
              The link may have been rotated by the host, or the potluck was deleted. Ask the
              host for a fresh link.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Go to the home page</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function HostControls({ event }: { event: PotluckEvent }) {
  const [editOpen, setEditOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const updateEvent = useUpdateEvent(event.slug)
  const rotateSlug = useRotateSlug((slug) => navigate(`/p/${slug}`, { replace: true }))
  const deleteEvent = useDeleteEvent(() => navigate('/dashboard'))

  return (
    <div className="flex shrink-0 gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Edit potluck details"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Rotate share link"
        onClick={() => setRotateOpen(true)}
      >
        <RefreshCw className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive size-8"
        aria-label="Delete potluck"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        pending={updateEvent.isPending}
        onSubmit={(input) =>
          updateEvent.mutate(
            { id: event.id, input },
            { onSuccess: () => setEditOpen(false) },
          )
        }
      />

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate the share link?</AlertDialogTitle>
            <AlertDialogDescription>
              A new link is minted and the current one stops working immediately. Anyone with
              the old link loses access until you share the new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotateSlug.mutate(event.id)}>
              Rotate link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {event.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The potluck and every dish in it are removed for everyone. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEvent.mutate(event.id)}
            >
              Delete potluck
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function EventPage({ slug }: { slug: string }) {
  const { user } = useAuth()
  const query = useEvent(slug)
  useTitle(query.data ? `${query.data.event.name} — Potluck` : undefined)

  const notFound =
    query.isError && query.error instanceof ApiError && query.error.code === 'event_not_found'

  return (
    <div className="min-h-dvh">
      <Header brandTo={user ? '/dashboard' : '/'}>
        {query.data?.event.isHost && (
          <span className="border-unclaimed-border bg-unclaimed text-unclaimed-foreground flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium">
            <ShieldCheck className="size-3.5" />
            Host
          </span>
        )}
        {user && !query.data?.event.isHost && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <LayoutDashboard />
              Dashboard
            </Link>
          </Button>
        )}
        {query.data && (
          <Button variant="outline" size="sm" onClick={() => copyEventLink(slug)}>
            <Link2 />
            Share
          </Button>
        )}
      </Header>

      {query.isPending ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-20 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Setting the table…
        </div>
      ) : notFound ? (
        <EventNotFound />
      ) : query.isError ? (
        <main className="mx-auto max-w-2xl px-4 pt-4 pb-12">
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              <p className="text-foreground mb-1 font-medium">Couldn&apos;t reach the potluck</p>
              <p>Check your connection — retrying automatically.</p>
            </CardContent>
          </Card>
        </main>
      ) : (
        <main className="mx-auto max-w-2xl px-4 pt-4 pb-12">
          <Card className="relative mb-4 gap-2 overflow-hidden py-4">
            <HeaderBackdrop name={query.data.event.name} />
            <div className="relative flex items-start justify-between gap-2 px-4">
              <div className="min-w-0">
                <h1 className="text-lg leading-tight font-semibold tracking-tight">
                  {query.data.event.name}
                </h1>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {query.data.event.date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatEventDate(query.data.event.date)}
                    </span>
                  )}
                  {query.data.event.location && (
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{query.data.event.location}</span>
                    </span>
                  )}
                </div>
              </div>
              {query.data.event.isHost && <HostControls event={query.data.event} />}
            </div>
            {query.data.event.description && (
              <p className="text-muted-foreground relative px-4 text-sm">
                {query.data.event.description}
              </p>
            )}
          </Card>

          <Tabs defaultValue="tracker">
            <TabsList className="mb-2 w-full">
              <TabsTrigger value="tracker">Tracker</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>
            <TabsContent value="tracker">
              <TrackerView
                slug={slug}
                dishes={query.data.dishes}
                isHost={query.data.event.isHost}
              />
            </TabsContent>
            <TabsContent value="overview">
              <OverviewView event={query.data.event} dishes={query.data.dishes} />
            </TabsContent>
          </Tabs>
        </main>
      )}
    </div>
  )
}
