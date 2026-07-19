import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import PotluckPage from '@/pages/potluck'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
})

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      storageKey="potluck-theme"
      defaultTheme="system"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <PotluckPage />
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
