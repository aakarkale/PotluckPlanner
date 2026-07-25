import { Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { searchAddresses, type AddressSuggestion } from '@/lib/geocode'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 300

interface AddressInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  /**
   * Fired when the suggestion list opens or closes. A surrounding dialog uses
   * this to let Escape dismiss the list first instead of the whole dialog —
   * React's stopPropagation cannot beat Radix's document-level key handler,
   * so the dialog has to opt out via onEscapeKeyDown.
   */
  onOpenChange?: (open: boolean) => void
}

/**
 * Text input that suggests complete addresses as you type (ARIA combobox).
 *
 * Suggestions are a convenience layer only: the field stays a plain text
 * input, so a host can type "Dana's backyard" and never touch the list. If
 * the geocoder is slow, blocked, or offline, the list simply stays empty.
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

  const listboxId = useId()
  // Set when the value change came from picking a suggestion, so we don't
  // immediately re-query for the text we just inserted.
  const skipSearch = useRef(false)

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false
      setLoading(false)
      return
    }
    if (value.trim().length < 3) {
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
        if (results.length > 0) setOpen(true)
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

  const select = (suggestion: AddressSuggestion) => {
    skipSearch.current = true
    onChange(suggestion.label)
    setOpen(false)
    setSuggestions([])
    setHighlight(-1)
  }

  const isOpen = open && suggestions.length > 0

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

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
      // Close the list, but keep the surrounding dialog open.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
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

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Address suggestions"
        className={cn(
          'bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-md border p-1 shadow-md',
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
