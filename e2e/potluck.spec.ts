// End-to-end walkthrough of the potluck platform against the production build
// and a local replica of the production architecture (real Postgres + the real
// migrations behind a PostgREST-protocol shim — see setup-local.sh/rest-shim.mjs).
//
// Two persistent browser contexts simulate two devices: the HOST (signs up,
// stays signed in) and a GUEST who only ever has the share link. Tests are
// serial and share state, walking one potluck through its whole life.
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const REST = 'http://127.0.0.1:3002/rest/v1'
const HEADERS = { apikey: 'test', authorization: 'Bearer test', 'content-type': 'application/json' }

const HOST = { name: 'Dana Host', email: 'dana@example.com', password: 'super-secret-1' }

test.describe.configure({ mode: 'serial' })

let hostContext: BrowserContext
let guestContext: BrowserContext
let host: Page
let guest: Page
let shareUrl: string

/** The app calls two keyless third-party APIs — a geocoder for address
 *  suggestions and an image search for header artwork. Every test stubs both
 *  so the suite stays hermetic; the defaults return nothing. */
const GEOCODER = '**/photon.komoot.io/**'
const IMAGE_API = '**/api.openverse.org/**'
const noSuggestions = { features: [] as unknown[], type: 'FeatureCollection' }
const noImages = { results: [] as unknown[] }

test.beforeAll(async ({ browser }) => {
  hostContext = await browser.newContext()
  guestContext = await browser.newContext()
  for (const context of [hostContext, guestContext]) {
    await context.route(GEOCODER, (route) => route.fulfill({ json: noSuggestions }))
    await context.route(IMAGE_API, (route) => route.fulfill({ json: noImages }))
  }
  host = await hostContext.newPage()
  guest = await guestContext.newPage()
})

test.afterAll(async () => {
  await hostContext.close()
  await guestContext.close()
})

async function addDish(
  page: Page,
  dish: { name: string; category?: string; servings: number; broughtBy?: string },
) {
  await page.getByRole('button', { name: 'Add a dish' }).click()
  await page.getByLabel('Dish', { exact: true }).fill(dish.name)
  if (dish.category) {
    await page.getByLabel('Category').click()
    await page.getByRole('option', { name: dish.category, exact: true }).click()
  }
  await page.getByLabel('Servings').fill(String(dish.servings))
  if (dish.broughtBy) {
    await page.getByLabel(/Who's bringing it/).fill(dish.broughtBy)
  }
  await page.getByRole('button', { name: /Add dish/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('landing page pitches the product and routes to signup', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Plan the whole table with one link/ }),
  ).toBeVisible()
  await expect(page.getByText('Guests skip the signup')).toBeVisible()
  await page.getByRole('link', { name: /Host a potluck/ }).click()
  await expect(page).toHaveURL('/signup')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
})

test('visiting the dashboard signed out redirects to sign in', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/signin')
})

test('host signs up, creates a potluck, and gets a share link', async () => {
  await host.goto('/signup')
  await host.getByLabel('Your name').fill(HOST.name)
  await host.getByLabel('Email').fill(HOST.email)
  await host.getByLabel('Password').fill(HOST.password)
  await host.getByRole('button', { name: 'Create account' }).click()
  await expect(host).toHaveURL('/dashboard')
  await expect(host.getByText('No potlucks yet')).toBeVisible()

  await host.getByRole('button', { name: 'New potluck' }).first().click()
  await host.getByLabel('Name').fill('Friendsgiving 2026')
  await host.getByLabel('Date (optional)').fill('2026-11-21')
  await host.getByLabel('Guests expected').fill('25')
  await host.getByLabel('Location (optional)').fill("Dana's place")
  await host.getByLabel(/Notes for guests/).fill('Oven access is limited.')
  await host.getByRole('button', { name: 'Create potluck' }).click()

  await expect(host).toHaveURL(/\/p\/[a-z0-9]{12}$/)
  shareUrl = host.url()

  await expect(host.getByRole('heading', { name: 'Friendsgiving 2026' })).toBeVisible()
  await expect(host.getByText("Dana's place")).toBeVisible()
  await expect(host.getByText('Oven access is limited.')).toBeVisible()
  await expect(host.getByText('Host', { exact: true })).toBeVisible()
})

test('host adds dishes; the tracker reflects them', async () => {
  await addDish(host, { name: 'Roast turkey', category: 'Main', servings: 12, broughtBy: 'Dana' })
  await addDish(host, { name: 'Something green', category: 'Side', servings: 8 })

  await expect(host.getByTestId('dish-card')).toHaveCount(2)
  await expect(host.getByText('Up for grabs')).toBeVisible()
  await expect(host.getByText('Unclaimed (1)')).toBeVisible()
})

test('guest opens the share link with no login wall and no admin controls', async () => {
  await guest.goto(shareUrl)
  await expect(guest.getByRole('heading', { name: 'Friendsgiving 2026' })).toBeVisible()
  await expect(guest.getByTestId('dish-card')).toHaveCount(2)
  // No host affordances for guests:
  await expect(guest.getByText('Host', { exact: true })).toBeHidden()
  await expect(guest.getByLabel('Edit potluck details')).toBeHidden()
  await expect(guest.getByLabel('Delete potluck')).toBeHidden()
  // Cannot edit the host's dishes either:
  await expect(guest.getByLabel('Edit Roast turkey')).toBeHidden()
})

test('guest claims the unclaimed dish; the host sees it live', async () => {
  await guest.getByRole('button', { name: 'Claim', exact: true }).click()
  await guest.getByLabel('Your name').fill('Priya')
  await guest.getByRole('button', { name: 'Claim dish' }).click()
  await expect(guest.getByText('Brought by Priya')).toBeVisible()

  // Live polling carries the claim to the host without a reload.
  await expect(host.getByText('Brought by Priya')).toBeVisible()
})

test('guest adds their own dish and can edit only that one', async () => {
  await addDish(guest, { name: 'Mango lassi', category: 'Drink', servings: 10, broughtBy: 'Priya' })

  await expect(guest.getByLabel('Edit Mango lassi')).toBeVisible()
  await expect(guest.getByLabel('Edit Roast turkey')).toBeHidden()
})

test('overview shows live coverage; guests cannot edit the guest count', async () => {
  await guest.getByRole('tab', { name: 'Overview' }).click()
  await expect(guest.getByTestId('stat-total-items')).toContainText('3')
  await expect(guest.getByTestId('stat-total-servings')).toContainText('30')
  await expect(guest.getByTestId('stat-guest-count')).toContainText('25')
  await expect(guest.getByTestId('stat-coverage')).toContainText('120%')
  await expect(guest.getByLabel('Edit guest count')).toBeHidden()
  await guest.getByRole('tab', { name: 'Tracker' }).click()
})

test('host edits the guest dish (admin override) and adjusts the headcount', async () => {
  await host.getByLabel('Edit Mango lassi').click()
  await host.getByLabel('Servings').fill('12')
  await host.getByRole('button', { name: 'Save changes' }).click()
  await expect(host.getByRole('dialog')).toBeHidden()
  await expect(
    host.getByTestId('dish-card').filter({ hasText: 'Mango lassi' }),
  ).toContainText('Serves 12')

  await host.getByRole('tab', { name: 'Overview' }).click()
  await host.getByLabel('Edit guest count').click()
  await host.getByRole('spinbutton').fill('40')
  await host.getByLabel('Save guest count').click()
  await expect(host.getByTestId('stat-guest-count')).toContainText('40')
  // 12 + 8 + 12 = 32 servings for 40 guests
  await expect(host.getByTestId('stat-coverage')).toContainText('80%')

  // The guest's poll picks up the new headcount.
  await guest.getByRole('tab', { name: 'Overview' }).click()
  await expect(guest.getByTestId('stat-guest-count')).toContainText('40')
  await guest.getByRole('tab', { name: 'Tracker' }).click()
  await host.getByRole('tab', { name: 'Tracker' }).click()
})

test('host edits event details and the guest sees them live', async () => {
  await host.getByLabel('Edit potluck details').click()
  await host.getByLabel('Name').fill('Friendsgiving: Final Form')
  await host.getByLabel(/Notes for guests/).fill('')
  await host.getByRole('button', { name: 'Save changes' }).click()
  await expect(host.getByRole('dialog')).toBeHidden()

  await expect(guest.getByRole('heading', { name: 'Friendsgiving: Final Form' })).toBeVisible()
  await expect(guest.getByText('Oven access is limited.')).toBeHidden()
})

test('rotating the share link locks out the old link', async () => {
  await host.getByLabel('Rotate share link').click()
  await host.getByRole('alertdialog').getByRole('button', { name: 'Rotate link' }).click()
  await expect(host).not.toHaveURL(shareUrl)
  const newUrl = host.url()
  expect(newUrl).toMatch(/\/p\/[a-z0-9]{12}$/)

  // Old capability is dead for the guest…
  await guest.goto(shareUrl)
  await expect(guest.getByText("This potluck doesn't exist")).toBeVisible()
  // …until the host shares the fresh one.
  await guest.goto(newUrl)
  await expect(guest.getByRole('heading', { name: 'Friendsgiving: Final Form' })).toBeVisible()
  shareUrl = newUrl
})

test('dashboard summarizes the potluck and survives sign out/in', async () => {
  await host.goto('/dashboard')
  const card = host.getByTestId('event-card')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Friendsgiving: Final Form')
  await expect(card).toContainText('3 dishes')
  await expect(card).toContainText('32 servings')
  await expect(card).toContainText('80% covered')

  await host.getByRole('button', { name: 'Sign out' }).click()
  await expect(host).toHaveURL('/')
  await host.goto('/dashboard')
  await expect(host).toHaveURL('/signin')

  await host.getByLabel('Email').fill(HOST.email)
  await host.getByLabel('Password').fill(HOST.password)
  await host.getByRole('button', { name: 'Sign in' }).click()
  await expect(host).toHaveURL('/dashboard')
  await expect(host.getByTestId('event-card')).toHaveCount(1)
})

test('wrong credentials are rejected with friendly copy', async ({ page }) => {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(HOST.email)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Wrong email or password.')).toBeVisible()
})

test('a bogus share link shows the not-found page', async ({ page }) => {
  await page.goto('/p/zzzzzzzzzzzz')
  await expect(page.getByText("This potluck doesn't exist")).toBeVisible()
})

test('deleting the potluck removes it for everyone', async () => {
  await host.goto(shareUrl)
  await host.getByLabel('Delete potluck').click()
  await host.getByRole('alertdialog').getByRole('button', { name: 'Delete potluck' }).click()
  await expect(host).toHaveURL('/dashboard')
  await expect(host.getByText('No potlucks yet')).toBeVisible()

  await guest.goto(shareUrl)
  await expect(guest.getByText("This potluck doesn't exist")).toBeVisible()
})

test.describe('address autocomplete', () => {
  // Photon (OpenStreetMap) response shape, stubbed so the suite never depends
  // on a live third-party geocoder.
  const suggestionFixture = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          osm_id: 1,
          osm_type: 'W',
          name: 'Riverside Park',
          street: 'Main Street',
          city: 'Portland',
          state: 'Oregon',
          postcode: '97204',
        },
      },
      {
        type: 'Feature',
        properties: {
          osm_id: 2,
          osm_type: 'W',
          housenumber: '1600',
          street: 'Amphitheatre Parkway',
          city: 'Mountain View',
          state: 'California',
          postcode: '94043',
        },
      },
      {
        // Longer than the database's 120-char location limit once joined.
        type: 'Feature',
        properties: {
          osm_id: 3,
          osm_type: 'W',
          name: 'The Extremely Long Community Recreation Center And Banquet Facility',
          street: '12345 Northwest Grand Boulevard Extension',
          city: 'Beaverton',
          state: 'Oregon',
          postcode: '97006',
        },
      },
    ],
  }

  test.beforeEach(async () => {
    // Page-level route registered last, so it wins over the context default.
    await host.route(GEOCODER, (route) => route.fulfill({ json: suggestionFixture }))
  })

  test.afterEach(async () => {
    await host.unroute(GEOCODER)
  })

  test('suggests full addresses and fills the field on pick', async () => {
    await host.goto('/dashboard')
    await host.getByRole('button', { name: /New potluck|Create a potluck/ }).first().click()
    await host.getByLabel('Name').fill('Autocomplete Party')

    const location = host.getByLabel('Location (optional)')
    await location.fill('riverside')

    const listbox = host.getByRole('listbox', { name: 'Address suggestions' })
    await expect(listbox).toBeVisible()
    await expect(listbox.getByRole('option')).toHaveCount(3)
    // Composed from the parts, not just the raw name.
    await expect(listbox.getByRole('option').first()).toContainText(
      'Riverside Park, Main Street, Portland, Oregon, 97204',
    )

    await listbox.getByRole('option').nth(1).click()
    await expect(location).toHaveValue('1600 Amphitheatre Parkway, Mountain View, California, 94043')
    await expect(listbox).toBeHidden()
  })

  test('keyboard navigation selects without submitting the form', async () => {
    // Park the cursor away from the list: an option rendering under a
    // stationary pointer fires mouseenter and would pre-highlight it.
    await host.mouse.move(0, 0)

    const location = host.getByLabel('Location (optional)')
    await location.fill('riverside')
    const options = host.getByRole('listbox', { name: 'Address suggestions' }).getByRole('option')
    await expect(options.first()).toBeVisible()

    await location.press('ArrowDown')
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
    await location.press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await location.press('Enter')

    // Enter took the highlighted suggestion; it must NOT have submitted.
    await expect(location).toHaveValue('1600 Amphitheatre Parkway, Mountain View, California, 94043')
    await expect(host.getByRole('dialog')).toBeVisible()
    await expect(host.getByRole('listbox', { name: 'Address suggestions' })).toBeHidden()

    // Escape closes the list but leaves the dialog open. Assert on data-state,
    // not visibility: a dismissed dialog stays mounted through its exit
    // animation and would still look "visible" for a moment.
    await location.fill('main street')
    await expect(host.getByRole('listbox', { name: 'Address suggestions' })).toBeVisible()
    await location.press('Escape')
    await expect(host.getByRole('listbox', { name: 'Address suggestions' })).toBeHidden()
    await expect(host.getByRole('dialog')).toHaveAttribute('data-state', 'open')
  })

  test('long suggestions are clamped to what the database accepts', async () => {
    const location = host.getByLabel('Location (optional)')
    // Distinct from the previous test's query: re-filling an identical value
    // fires no change event, so the list would never reopen.
    await location.fill('grand boulevard')
    const listbox = host.getByRole('listbox', { name: 'Address suggestions' })
    await listbox.getByRole('option').nth(2).click()

    const picked = await location.inputValue()
    expect(picked.length).toBeGreaterThan(0)
    expect(picked.length).toBeLessThanOrEqual(120)

    // The clamped value round-trips through the API.
    await host.getByRole('button', { name: 'Create potluck' }).click()
    await expect(host).toHaveURL(/\/p\/[a-z0-9]{12}$/)
    await expect(host.getByText(picked)).toBeVisible()

    await host.getByLabel('Delete potluck').click()
    await host.getByRole('alertdialog').getByRole('button', { name: 'Delete potluck' }).click()
    await expect(host).toHaveURL('/dashboard')
  })

  test('a failing geocoder never blocks free-typed locations', async () => {
    await host.unroute(GEOCODER)
    await host.route(GEOCODER, (route) => route.abort('failed'))

    await host.getByRole('button', { name: /New potluck|Create a potluck/ }).first().click()
    await host.getByLabel('Name').fill('Offline Geocoder Party')
    await host.getByLabel('Location (optional)').fill("Dana's backyard, past the gate")
    await expect(host.getByRole('listbox', { name: 'Address suggestions' })).toBeHidden()

    await host.getByRole('button', { name: 'Create potluck' }).click()
    await expect(host).toHaveURL(/\/p\/[a-z0-9]{12}$/)
    await expect(host.getByText("Dana's backyard, past the gate")).toBeVisible()

    await host.getByLabel('Delete potluck').click()
    await host.getByRole('alertdialog').getByRole('button', { name: 'Delete potluck' }).click()
    await expect(host).toHaveURL('/dashboard')
  })
})

test.describe('header artwork', () => {
  // 1x1 transparent GIF — enough to prove the backdrop renders and loads.
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

  test('derives a themed image query from the name and blurs it behind the header', async () => {
    const queries: string[] = []
    await host.route(IMAGE_API, (route) => {
      queries.push(new URL(route.request().url()).searchParams.get('q') ?? '')
      route.fulfill({ json: { results: [{ thumbnail: PIXEL }] } })
    })

    await host.goto('/dashboard')
    // Earlier tests ran against the "no results" stub, which caches the miss.
    await host.evaluate(() => localStorage.removeItem('potluck-image-cache'))
    await host.getByRole('button', { name: /New potluck|Create a potluck/ }).first().click()
    await host.getByLabel('Name').fill('Friendsgiving 2026')
    await host.getByRole('button', { name: 'Create potluck' }).click()
    await expect(host).toHaveURL(/\/p\/[a-z0-9]{12}$/)

    await expect(host.getByTestId('header-backdrop')).toBeVisible()
    // "Friendsgiving" maps to a curated query, not the raw event name.
    expect(queries).toContain('thanksgiving dinner table')
    // Purely decorative: hidden from the accessibility tree.
    await expect(host.getByTestId('header-backdrop')).toHaveAttribute('aria-hidden', 'true')
    await expect(host.getByRole('heading', { name: 'Friendsgiving 2026' })).toBeVisible()

    await host.unroute(IMAGE_API)
  })

  test('header renders plain when the image service has nothing', async () => {
    // Drop the cached hit from the previous test, then fall back to the
    // context-level stub, which returns no results.
    await host.evaluate(() => localStorage.removeItem('potluck-image-cache'))
    await host.reload()
    await expect(host.getByRole('heading', { name: 'Friendsgiving 2026' })).toBeVisible()
    await expect(host.getByTestId('header-backdrop')).toBeHidden()

    await host.getByLabel('Delete potluck').click()
    await host.getByRole('alertdialog').getByRole('button', { name: 'Delete potluck' }).click()
    await expect(host).toHaveURL('/dashboard')
  })
})

test.describe('API hardening (wire-level probes)', () => {
  test('tables are sealed off from the API roles', async ({ request }) => {
    for (const table of ['events', 'dishes', 'users', 'sessions']) {
      const res = await request.get(`${REST}/${table}`, { headers: HEADERS })
      expect(res.status(), table).toBeGreaterThanOrEqual(400)
    }
  })

  test('admin RPCs reject missing or garbage session tokens', async ({ request }) => {
    const create = await request.post(`${REST}/rpc/potluck_create_event`, {
      headers: HEADERS,
      data: { p_token: 'garbage', p_name: 'Intruder Party' },
    })
    expect(create.status()).toBe(400)
    expect((await create.json()).message).toBe('not_signed_in')

    const events = await request.post(`${REST}/rpc/potluck_my_events`, {
      headers: HEADERS,
      data: { p_token: null },
    })
    expect(events.status()).toBe(400)
  })

  test('payloads never leak owner ids, host ids, or password material', async ({ request }) => {
    const session = await request.post(`${REST}/rpc/potluck_sign_up`, {
      headers: HEADERS,
      data: { p_email: 'probe@example.com', p_password: 'probe-pass-1', p_name: 'Probe' },
    })
    expect(session.status()).toBe(200)
    const { token } = await session.json()

    const event = await request.post(`${REST}/rpc/potluck_create_event`, {
      headers: HEADERS,
      data: { p_token: token, p_name: 'Leak Check' },
    })
    const slug = (await event.json()).slug

    const data = await request.post(`${REST}/rpc/potluck_get_event`, {
      headers: HEADERS,
      data: { p_slug: slug, p_owner: crypto.randomUUID(), p_token: null },
    })
    const body = JSON.stringify(await data.json())
    for (const needle of ['owner_id', 'host_user_id', 'password', 'token_hash', 'email']) {
      expect(body, `payload must not contain ${needle}`).not.toContain(needle)
    }
  })

  test('nobody can mutate someone else’s dish at the wire level', async ({ request }) => {
    const session = await request.post(`${REST}/rpc/potluck_sign_in`, {
      headers: HEADERS,
      data: { p_email: 'probe@example.com', p_password: 'probe-pass-1' },
    })
    const { token } = await session.json()
    const event = await request.post(`${REST}/rpc/potluck_create_event`, {
      headers: HEADERS,
      data: { p_token: token, p_name: 'Wire Party' },
    })
    const slug = (await event.json()).slug
    const dish = await request.post(`${REST}/rpc/potluck_create_dish`, {
      headers: HEADERS,
      data: {
        p_slug: slug,
        p_owner: crypto.randomUUID(),
        p_name: 'Locked Dish',
        p_category: 'main',
        p_servings: 4,
      },
    })
    const dishId = (await dish.json()).id

    const attack = await request.post(`${REST}/rpc/potluck_update_dish`, {
      headers: HEADERS,
      data: { p_id: dishId, p_owner: crypto.randomUUID(), p_token: null, p_name: 'Pwned' },
    })
    expect(attack.status()).toBe(400)
    expect((await attack.json()).message).toBe('not_allowed')
  })
})
