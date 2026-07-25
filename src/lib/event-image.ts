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
  [/thanksgiving|friendsgiving/, 'thanksgiving dinner table'],
  [/christmas|xmas|holiday/, 'christmas dinner table'],
  [/hanukkah|chanukah/, 'hanukkah latkes'],
  [/diwali/, 'diwali sweets'],
  [/lunar new year|chinese new year/, 'lunar new year feast'],
  [/eid|iftar|ramadan/, 'iftar feast table'],
  [/easter/, 'easter brunch table'],
  [/halloween|spooky/, 'halloween pumpkin treats'],
  [/new year/, 'new year party food'],
  [/birthday/, 'birthday cake'],
  [/baby shower/, 'dessert table'],
  [/housewarming|dinner party/, 'dinner party table'],
  [/bbq|barbecue|barbeque|cookout|grill/, 'barbecue grilled food'],
  [/picnic/, 'picnic blanket food'],
  [/brunch/, 'brunch table spread'],
  [/breakfast|pancake/, 'breakfast spread'],
  [/taco|mexican/, 'tacos'],
  [/pizza/, 'pizza'],
  [/pasta|italian/, 'pasta dish'],
  [/sushi|japanese/, 'sushi platter'],
  [/curry|indian/, 'indian curry spread'],
  [/soup|chili|stew/, 'soup pot'],
  [/dessert|bake|cookie|cake/, 'dessert table'],
  [/vegan|vegetarian|salad/, 'vegetable platter'],
  [/game day|super bowl|tailgate|watch party/, 'game day snacks'],
  [/office|work|team|company/, 'office party food'],
  [/camp|bonfire|campfire/, 'campfire cooking'],
  [/garden|backyard/, 'garden party table'],
  [/summer/, 'summer picnic food'],
  [/winter/, 'winter comfort food'],
]

/** Words that carry no visual meaning on their own. */
const FILLER =
  /\b(potluck|party|the|a|an|of|at|for|and|with|our|my|annual|\d{1,4}(st|nd|rd|th)?|v\d+)\b/g

/**
 * Builds the image search query for an event name.
 * Pure and exported for tests. Returns null when there is nothing to go on.
 */
export function imageQueryFor(name: string): string | null {
  const normalized = name.toLowerCase().trim()
  if (!normalized) return null

  for (const [pattern, query] of THEMES) {
    if (pattern.test(normalized)) return query
  }

  // Fall back to the distinctive words of the name, anchored with "food" so a
  // generic name still lands on something table-shaped.
  const words = normalized
    .replace(FILLER, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)

  return words.length > 0 ? `${words.join(' ')} food` : 'potluck table food'
}

interface CacheEntry {
  url: string | null
  at: number
}

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>
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
 * Resolves a background image URL for an event name.
 * Never throws: any failure resolves to null and the header renders plain.
 */
export async function fetchEventImage(
  name: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const query = imageQueryFor(name)
  if (!query) return null

  const cached = readCache()[query]
  if (cached && Date.now() - cached.at < (cached.url ? HIT_TTL_MS : MISS_TTL_MS)) {
    return cached.url
  }

  try {
    const url =
      `${ENDPOINT}?q=${encodeURIComponent(query)}` +
      '&license=cc0,pdm&mature=false&page_size=3&size=medium'
    const res = await fetch(url, { signal })
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
