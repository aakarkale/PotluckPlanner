// Ambient header artwork for a potluck, chosen from its name.
//
// Provider: Openverse (https://openverse.org, run by WordPress) — a search
// index over openly-licensed media. Keyless like the geocoder, so it fits the
// "no server, no secrets" shape. Two filters keep it safe to render:
//   * license=cc0,pdm — public-domain / CC0 only, so no attribution is owed
//     for a decorative background.
//   * mature=false    — Openverse's own safe-search.
// The result is blurred behind a scrim, so it reads as ambient colour rather
// than a photo; a miss looks like texture, not a wrong picture.

const ENDPOINT = 'https://api.openverse.org/v1/images/'
/** A hung request must not hold the query pending forever. */
const TIMEOUT_MS = 6000
const CACHE_KEY = 'potluck-image-cache'
/** A found image is stable, so hold it for a week. */
const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** "Nothing found" is often just a rate limit or a blip — retry within the
 *  hour rather than leaving the header plain for a week. */
const MISS_TTL_MS = 60 * 60 * 1000

/**
 * Curated themes. Matching a known theme is preferred over free text so the
 * common cases ("Friendsgiving 2026") get a deliberately good query instead of
 * whatever the index returns for a raw event name.
 */
const THEMES: [RegExp, string][] = [
  [/\b(thanksgiving|friendsgiving)\b/, 'thanksgiving dinner table'],
  [/\b(christmas|xmas|holiday)\b/, 'christmas dinner table'],
  [/\b(hanukkah|chanukah)\b/, 'hanukkah latkes'],
  [/\bdiwali\b/, 'diwali sweets'],
  [/\b(lunar|chinese) new year\b/, 'lunar new year feast'],
  [/\b(eid|iftar|ramadan)\b/, 'iftar feast table'],
  [/\beaster\b/, 'easter brunch table'],
  [/\b(halloween|spooky)\b/, 'halloween pumpkin treats'],
  [/\bnew year\b/, 'new year party food'],
  [/\bbirthday\b/, 'birthday cake'],
  [/\bbaby shower\b/, 'dessert table'],
  [/\b(housewarming|dinner party)\b/, 'dinner party table'],
  [/\b(bbq|barbecue|barbeque|cookout|grill)\b/, 'barbecue grilled food'],
  [/\bpicnic\b/, 'picnic blanket food'],
  [/\bbrunch\b/, 'brunch table spread'],
  [/\b(breakfast|pancakes?)\b/, 'breakfast spread'],
  [/\b(tacos?|mexican)\b/, 'tacos'],
  [/\bpizza\b/, 'pizza'],
  [/\b(pasta|italian)\b/, 'pasta dish'],
  [/\b(sushi|japanese)\b/, 'sushi platter'],
  [/\b(curry|indian)\b/, 'indian curry spread'],
  [/\b(soup|chili|stew)\b/, 'soup pot'],
  [/\b(dessert|bake|baking|cookies?|cake)\b/, 'dessert table'],
  [/\b(vegan|vegetarian|salad)\b/, 'vegetable platter'],
  [/\b(game day|super bowl|tailgate|watch party)\b/, 'game day snacks'],
  [/\b(office|work|team|company)\b/, 'office party food'],
  [/\b(camp|camping|bonfire|campfire)\b/, 'campfire cooking'],
  [/\b(garden|backyard)\b/, 'garden party table'],
  [/\bsummer\b/, 'summer picnic food'],
  [/\bwinter\b/, 'winter comfort food'],
]

/** Used whenever the name matches no theme. */
const GENERIC_QUERY = 'potluck table food'

/**
 * Builds the image search query for an event name.
 *
 * Only the fixed vocabulary above is ever sent to Openverse. An unmatched name
 * falls back to a generic query rather than forwarding the host's own words:
 * every guest's browser performs this lookup, and a potluck name can be
 * personal ("Sam's chemo support dinner") in a way that should not leave the
 * app. Pure and exported for tests.
 */
export function imageQueryFor(name: string): string {
  const normalized = name.toLowerCase().trim()
  if (!normalized) return GENERIC_QUERY

  for (const [pattern, query] of THEMES) {
    if (pattern.test(normalized)) return query
  }
  return GENERIC_QUERY
}

interface CacheEntry {
  url: string | null
  at: number
}

function readCache(): Record<string, CacheEntry> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    // Anything can end up under this key (another tab, a corrupted write), so
    // only trust a plain object — indexing a string or array would throw.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, CacheEntry>)
      : {}
  } catch {
    return {}
  }
}

function writeCache(query: string, url: string | null) {
  try {
    const cache = readCache()
    cache[query] = { url, at: Date.now() }
    // Keep the cache small — this is a nicety, not a store of record.
    const entries = Object.entries(cache).slice(-30)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Private mode or a full quota: skip caching, still show the image.
  }
}

/**
 * Resolves a background image URL for a query from `imageQueryFor`.
 * Never throws: any failure resolves to null and the header renders plain.
 */
export async function fetchEventImage(
  query: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!query) return null

  try {
    const cached = readCache()[query]
    if (cached && Date.now() - cached.at < (cached.url ? HIT_TTL_MS : MISS_TTL_MS)) {
      return cached.url
    }

    const url =
      `${ENDPOINT}?q=${encodeURIComponent(query)}` +
      '&license=cc0,pdm&mature=false&page_size=3&size=medium'
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const res = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!res.ok) return null

    const body = (await res.json()) as {
      results?: { thumbnail?: string; url?: string }[]
    }
    // The thumbnail is plenty: it sits behind a blur, and it keeps the
    // header light on mobile data.
    const hit = body.results?.find((result) => result.thumbnail || result.url)
    const image = hit?.thumbnail ?? hit?.url ?? null
    writeCache(query, image)
    return image
  } catch {
    return null
  }
}
