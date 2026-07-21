import {
  ArrowRight,
  CalendarDays,
  Gauge,
  HandHeart,
  Link2,
  MapPin,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useTitle } from '@/hooks/use-title'
import { Link } from '@/lib/router'
import { cn } from '@/lib/utils'

/** Static, non-interactive rendering of a real tracker + coverage view, so
 *  the hero shows the actual product instead of a screenshot. */
function ProductDemo() {
  return (
    <div
      aria-hidden
      className="pointer-events-none mx-auto mt-12 w-full max-w-md select-none sm:mt-16"
    >
      <div className="bg-card rounded-2xl border p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Friendsgiving 2026</p>
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                Sat, Nov 21
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                Dana&apos;s place
              </span>
            </p>
          </div>
          <span className="border-unclaimed-border bg-unclaimed text-unclaimed-foreground flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
            2 unclaimed
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="bg-muted/40 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Brown butter mac &amp; cheese</p>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Main</Badge>
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    Serves 10
                  </span>
                </p>
              </div>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <User className="size-3" />
                <span className="text-foreground font-medium">Priya</span>
              </span>
            </div>
          </div>

          <div className="border-unclaimed-border bg-unclaimed rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Something green, please</p>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Side</Badge>
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    Serves 8
                  </span>
                </p>
              </div>
              <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-medium">
                Claim
              </span>
            </div>
            <p className="text-unclaimed-foreground mt-1.5 flex items-center gap-1 text-xs font-medium">
              <HandHeart className="size-3" />
              Up for grabs
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-background rounded-lg border p-3">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                Coverage
              </p>
              <p className="text-success text-xl font-semibold tabular-nums">104%</p>
              <p className="text-muted-foreground text-[10px]">Everyone&apos;s covered</p>
            </div>
            <div className="bg-background rounded-lg border p-3">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                Servings
              </p>
              <p className="text-xl font-semibold tabular-nums">26</p>
              <p className="text-muted-foreground text-[10px]">for 25 guests</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Link2,
    title: 'One link does it all',
    text: 'Every guest gets the same link. Open it, add a dish, done — that is the entire onboarding.',
  },
  {
    icon: UserCheck,
    title: 'Guests skip the signup',
    text: 'Only hosts have accounts. Guests never see a login wall, an app store, or a verification email.',
  },
  {
    icon: Gauge,
    title: 'Live coverage math',
    text: 'Servings vs. headcount, recomputed as dishes land. Know you are three sides short before the party, not during it.',
  },
  {
    icon: HandHeart,
    title: 'Claim, don’t duplicate',
    text: 'Unclaimed dishes glow until someone puts their name on them. Six potato salads, prevented.',
  },
  {
    icon: ShieldCheck,
    title: 'Hosts stay in control',
    text: 'Edit or remove any dish, change the details, or rotate the link to cut off access — all from your phone.',
  },
  {
    icon: Smartphone,
    title: 'At home on any phone',
    text: 'Mobile-first, light and dark, and the list refreshes itself every couple of seconds on every screen.',
  },
]

const STEPS = [
  {
    title: 'Create',
    text: 'Name your potluck, set the date and expected headcount. Under a minute, start to finish.',
  },
  {
    title: 'Share',
    text: 'Drop the link in the group chat. That is the whole invite — no RSVPs to chase.',
  },
  {
    title: 'Watch it fill',
    text: 'Dishes appear, claims land, and coverage climbs to 100% while you do literally anything else.',
  },
]

export default function LandingPage() {
  const { user } = useAuth()
  useTitle('Potluck — plan the table together')

  return (
    <div className="min-h-dvh">
      <Header>
        {user ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Get started</Link>
            </Button>
          </>
        )}
      </Header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="from-accent/60 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-gradient-to-b to-transparent"
          />
          <div className="mx-auto max-w-3xl px-4 pt-14 pb-16 text-center sm:pt-20">
            <span className="bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
              <UtensilsCrossed className="text-primary size-3.5" />
              Free · No app to install · Guests never sign up
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Plan the whole table with one link
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg text-balance">
              Create a potluck, share the link, and watch the menu organize itself — who&apos;s
              bringing what, how many it feeds, and what&apos;s still missing.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={user ? '/dashboard' : '/signup'}>
                  Host a potluck
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/signin">Sign in</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Got a link from a host? Just open it — nothing to set up.
            </p>

            <ProductDemo />
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything a potluck needs, nothing it doesn&apos;t
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-center">
            No spreadsheets, no sign-up chains, no “wait, who&apos;s bringing dessert?”
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="gap-3 p-5">
                <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg">
                  <feature.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{feature.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps, one good meal
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative text-center sm:text-left">
                  <div className="mb-3 flex items-center justify-center gap-3 sm:justify-start">
                    <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <Card
            className={cn(
              'items-center gap-4 border-none p-8 text-center sm:p-10',
              'bg-primary text-primary-foreground shadow-lg',
            )}
          >
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              “The group chat will figure it out” never works
            </h2>
            <p className="text-primary-foreground/85 max-w-md text-sm sm:text-base">
              Give it a link instead. Free for any size table, and your guests will never make
              an account.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-foreground mt-1"
            >
              <Link to={user ? '/dashboard' : '/signup'}>
                Start your potluck
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-6 text-xs">
          <span className="flex items-center gap-1.5">
            <UtensilsCrossed className="size-3.5" />
            Potluck
          </span>
          <span>No app, no spreadsheets. Built for one good meal.</span>
        </div>
      </footer>
    </div>
  )
}
