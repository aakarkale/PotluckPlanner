import { Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { searchAddresses, type AddressSuggestion } from '@/lib/geocode'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 300
/** Roughly the list's max height; below this we flip it above the input. */
const LIST_SPACE_PX = 240

interface AddressInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  /**
   * Fired when the suggestion list opens or closes. A surrounding dialog uses
   * this to let Escape dismiss the list first instead of the whole dialog —
   * React's stopPropagation cannot beat Radix's document-level key handler, so
   * the dialog has to opt out via onEscapeKeyDown.
   */
  onOpenChange?: (open: boolean) => void
}

/**
 * Text input that suggests complete addresses as you type (ARIA combobox).
 *
 * Suggestions are a convenience layer only: the field stays a plain text
 * input, so a host can type "Dana's backyard" and never touch the list. If
 * the geocoder is slow, blocked, or offline, the list simply stays empty.
 *
 * Two rules keep it from acting on its own:
 *   * nothing is requested until the host actually types, so opening the edit
 *     dialog never geocodes the saved address or pops the list open; and
 *   * a late response cannot re-open a list the host already dismissed.
 */
export function AddressInput({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  onOpenChange,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [dropUp, setDropUp] = useState(false)

  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  /** The host has typed here; a prefilled value alone must not trigger a search. */
  const typed = useRef(false)
  /** The host closed the list (Escape/blur); a pending response must not reopen it. */
  const dismissed = useRef(false)
  /** Set when the value change came from picking a suggestion. */
  const skipSearch = useRef(false)

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false
      setLoading(false)
      return
    }
    if (!typed.current || value.trim().length < 3) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchAddresses(value, controller.signal).then((results) => {
        if (controller.signal.aborted) return
        setSuggestions(results)
        setHighlight(-1)
        setLoading(false)
        // Don't resurrect a list the host has already dismissed or walked away
        // from while this request was in flight.
        const focused = document.activeElement === inputRef.current
        if (results.length > 0 && !dismissed.current && focused) setOpen(true)
      })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
      // The aborted run never reaches its own setLoading(false); the next run
      // (or this cleanup on unmount) must clear it or the spinner never stops.
      setLoading(false)
    }
  }, [value])

  const isOpen = open && suggestions.length > 0

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  // The dialog keeps its own copy of this flag; make sure unmounting clears it,
  // or Escape stays swallowed the next time the dialog opens.
  useEffect(() => {
    return () => onOpenChange?.(false)
  }, [onOpenChange])

  // Keep the highlighted option inside the scroll container.
  useEffect(() => {
    if (highlight < 0) return
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const close = () => {
    dismissed.current = true
    setOpen(false)
  }

  const select = (suggestion: AddressSuggestion) => {
    // Only guard the next effect run if the value actually changes — otherwise
    // the flag survives and would swallow the host's next real search.
    if (suggestion.label !== value) skipSearch.current = true
    onChange(suggestion.label)
    setOpen(false)
    setSuggestions([])
    setHighlight(-1)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && highlight >= 0) {
      // Take the highlighted suggestion instead of submitting the form.
      event.preventDefault()
      select(suggestions[highlight])
    } else if (event.key === 'Escape') {
      // Close the list; the dialog opts out of its own Escape via onOpenChange.
      event.preventDefault()
      close()
    }
  }

  const status = loading
    ? 'Searching addresses'
    : isOpen
      ? `${suggestions.length} address ${suggestions.length === 1 ? 'suggestion' : 'suggestions'} available`
      : ''

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        // pr-9 is unconditional so the text doesn't shift when the spinner shows.
        className="pr-9"
        onChange={(event) => {
          typed.current = true
          dismissed.current = false
          skipSearch.current = false
          setHighlight(-1)
          onChange(event.target.value)
          const rect = inputRef.current?.getBoundingClientRect()
          if (rect) {
            // On a phone the keyboard eats the bottom half of the screen;
            // open upward when there isn't room below.
            const viewport = window.visualViewport?.height ?? window.innerHeight
            setDropUp(viewport - rect.bottom < LIST_SPACE_PX && rect.top > viewport - rect.bottom)
          }
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && highlight >= 0 ? `${listboxId}-${highlight}` : undefined
        }
      />
      {loading && (
        <Loader2 className="text-muted-foreground pointer-events-none absolute top-2.5 right-3 size-4 animate-spin" />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Address suggestions"
        className={cn(
          'bg-popover text-popover-foreground absolute right-0 left-0 z-50 max-h-56 overflow-y-auto rounded-md border p-1 shadow-md',
          dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          !isOpen && 'hidden',
        )}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={index === highlight}
            // Fire before blur so the click isn't lost when the input closes.
            onMouseDown={(event) => {
              event.preventDefault()
              select(suggestion)
            }}
            onMouseEnter={() => setHighlight(index)}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm',
              index === highlight && 'bg-accent text-accent-foreground',
            )}
          >
            <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">{suggestion.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
