import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CookingPot } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import AuthPage from '@/pages/auth'
import DashboardPage from '@/pages/dashboard'
import EventPage from '@/pages/event'
import LandingPage from '@/pages/landing'
import { Link, useRoute } from '@/lib/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
})

function Router() {
  const route = useRoute()

  // New page, top of page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.page])

  switch (route.page) {
    case 'landing':
      return <LandingPage />
    case 'signin':
      return <AuthPage key="signin" mode="signin" />
    case 'signup':
      return <AuthPage key="signup" mode="signup" />
    case 'dashboard':
      return <DashboardPage />
    case 'event':
      return <EventPage key={route.slug} slug={route.slug} />
    case 'not-found':
      return <NotFoundPage />
  }
}

function NotFoundPage() {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-10 pb-12">
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
            <CookingPot className="size-10 opacity-50" />
            <div>
              <p className="text-foreground font-medium">Nothing at this address</p>
              <p className="mt-1 text-sm">
                Check the link you were sent — potluck links look like /p/abc123.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/">Go to the home page</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      storageKey="potluck-theme"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
