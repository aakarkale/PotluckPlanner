import { Link2, Moon, ShieldCheck, Sun, UtensilsCrossed, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  isHost: boolean
  onExitHost: () => void
}

export function Header({ isHost, onExitHost }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied — send it to your friends')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <UtensilsCrossed className="size-4.5" />
        </div>
        <h1 className="truncate text-base font-semibold tracking-tight">Potluck Tracker</h1>

        <div className="ml-auto flex items-center gap-1.5">
          {isHost && (
            <span className="border-unclaimed-border bg-unclaimed text-unclaimed-foreground flex h-8 items-center gap-1 rounded-full border py-0 pr-1 pl-2.5 text-xs font-medium">
              <ShieldCheck className="size-3.5" />
              Host
              <button
                type="button"
                onClick={onExitHost}
                aria-label="Exit host mode"
                className="hover:bg-unclaimed-border/60 flex size-6 items-center justify-center rounded-full transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
          <Button variant="outline" size="sm" onClick={copyShareLink}>
            <Link2 />
            Share
          </Button>
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
