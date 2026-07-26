// Address autocomplete.
//
// Provider: Photon (https://photon.komoot.io) — an OpenStreetMap geocoder
// purpose-built for type-ahead. Chosen because it needs NO API key and no
// billing account, so it fits this app's "no server, no secrets" shape: the
// browser calls it directly and there is nothing to provision or rotate.
// (Google Places would need a billed, referrer-restricted key in the client;
// swapping providers means reimplementing `searchAddresses` and nothing else.)
//
// Privacy note: what the host types in the Location field is sent to
// komoot's public API to fetch suggestions. Nothing else about the potluck
// leaves the app, and typing a free-form location without picking a
// suggestion still works if the service is unreachable.

/** Max length of `location` accepted by the database (events_location_len). */
export const LOCATION_MAX = 120

export interface AddressSuggestion {
  /** Stable key for React lists. */
  id: string
  /** Single-line address, already clamped to LOCATION_MAX. */
  label: string
}

interface PhotonProperties {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  district?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
  osm_id?: number
  osm_type?: string
  type?: string
}

/** Joins address parts, dropping trailing detail until it fits LOCATION_MAX. */
function clampParts(parts: (string | undefined)[]): string {
  const kept = parts.filter((part): part is string => Boolean(part && part.trim()))
  for (let end = kept.length; end > 0; end--) {
    const label = kept.slice(0, end).join(', ')
    if (label.length <= LOCATION_MAX) return label
  }
  return (kept[0] ?? '').slice(0, LOCATION_MAX)
}

/**
 * Formats one Photon feature as a human address line.
 * Exported for tests — pure, no network.
 */
export function formatFeature(properties: PhotonProperties): string {
  const streetLine = [properties.housenumber, properties.street].filter(Boolean).join(' ')
  const { name } = properties
  // A POI ("Riverside Park") keeps its name and appends the street; a plain
  // address has no distinct name, so the street line leads.
  const head = name && name !== streetLine ? name : streetLine
  const detail = name && streetLine && name !== streetLine ? streetLine : ''
  const locality = properties.city || properties.district || properties.county

  return clampParts([head, detail, locality, properties.state, properties.postcode])
}

const ENDPOINT = 'https://photon.komoot.io/api/'
/** A hung connection must not leave the spinner running forever. */
const TIMEOUT_MS = 6000

/** Caller's signal, additionally bounded by TIMEOUT_MS. */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/**
 * Looks up address suggestions for a partial query.
 * Never throws: any failure (offline, rate limit, unexpected shape) resolves
 * to an empty list, because free-typed text must keep working regardless.
 */
export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []

  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=5&lang=en`
    const res = await fetch(url, { signal: withTimeout(signal) })
    if (!res.ok) return []

    const body = (await res.json()) as { features?: { properties?: PhotonProperties }[] }
    const seen = new Set<string>()
    const suggestions: AddressSuggestion[] = []

    for (const feature of body.features ?? []) {
      const label = formatFeature(feature.properties ?? {})
      if (!label || seen.has(label.toLowerCase())) continue
      seen.add(label.toLowerCase())
      const properties = feature.properties ?? {}
      suggestions.push({
        id: `${properties.osm_type ?? 'x'}${properties.osm_id ?? suggestions.length}-${label}`,
        label,
      })
    }
    return suggestions
  } catch {
    // Aborted, offline, blocked, or malformed — suggestions are a convenience.
    return []
  }
}
