import { Moon, Sun, UtensilsCrossed } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Link } from '@/lib/router'

/** Sticky app header: brand on the left, page-specific actions on the right.
 *  The theme toggle is always present (storage key `potluck-theme`). */
export function Header({ brandTo = '/', children }: { brandTo?: string; children?: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link to={brandTo} className="flex min-w-0 items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
            <UtensilsCrossed className="size-4.5" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight">Potluck</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          {children}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="size-4.5 dark:hidden" />
            <Moon className="hidden size-4.5 dark:block" />
          </Button>
        </div>
      </div>
    </header>
  )
}
