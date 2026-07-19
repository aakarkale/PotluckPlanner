import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// Full product walkthrough against the production build + real Postgres/
// PostgREST. Two browser contexts simulate two devices (distinct localStorage
// owner ids). Tests are serial and share state.

const SUPABASE = 'http://127.0.0.1:3002'
const ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.MVPNNyBwd2n2FlEi424lOLPT0Z2W34D0wpiC6P_VZAg'
const HOST_SECRET = 'test-host-secret'

const rpcHeaders = {
  'content-type': 'application/json',
  apikey: ANON_JWT,
  authorization: `Bearer ${ANON_JWT}`,
}

const dishCard = (page: Page, name: string) =>
  page.getByTestId('dish-card').filter({ hasText: name })

test.describe.configure({ mode: 'serial' })

let contextA: BrowserContext
let contextB: BrowserContext
let pageA: Page
let pageB: Page

test.beforeAll(async ({ browser }) => {
  contextA = await browser.newContext()
  contextB = await browser.newContext()
  pageA = await contextA.newPage()
  pageB = await contextB.newPage()
})

test.afterAll(async () => {
  await contextA.close()
  await contextB.close()
})

test('device A adds a claimed and an unclaimed dish', async () => {
  await pageA.goto('/')
  await expect(pageA.getByText('No dishes yet')).toBeVisible()

  await pageA.getByRole('button', { name: 'Add a dish' }).click()
  await pageA.getByLabel('Dish', { exact: true }).fill('Mac and Cheese')
  await pageA.getByLabel('Servings').fill('8')
  await pageA.getByLabel("Who's bringing it? (optional)").fill('Aakar')
  await pageA.getByRole('button', { name: 'Add dish' }).click()

  await expect(pageA.getByText('Added Mac and Cheese')).toBeVisible()
  await expect(pageA.getByText('Serves 8')).toBeVisible()
  await expect(pageA.getByText('Brought by')).toBeVisible()
  await expect(pageA.getByText('Aakar', { exact: true })).toBeVisible()

  await pageA.getByRole('button', { name: 'Add a dish' }).click()
  await pageA.getByLabel('Dish', { exact: true }).fill('Garden Salad')
  await pageA.getByLabel('Category').click()
  await pageA.getByRole('option', { name: 'Side' }).click()
  await pageA.getByLabel('Servings').fill('6')
  await pageA.getByRole('button', { name: 'Add dish' }).click()

  await expect(pageA.getByText('Up for grabs', { exact: true })).toBeVisible()
  await expect(pageA.getByRole('button', { name: 'Claim', exact: true })).toBeVisible()

  // A owns both dishes, so edit/delete controls are visible.
  await expect(pageA.getByRole('button', { name: 'Edit Mac and Cheese' })).toBeVisible()
  await expect(pageA.getByRole('button', { name: 'Delete Garden Salad' })).toBeVisible()
})

test('device B sees the dishes but has no edit rights, then claims the salad', async () => {
  await pageB.goto('/')
  await expect(dishCard(pageB, 'Mac and Cheese')).toBeVisible()
  await expect(dishCard(pageB, 'Garden Salad')).toBeVisible()

  // Not B's dishes — no management controls.
  await expect(pageB.getByRole('button', { name: 'Edit Mac and Cheese' })).toHaveCount(0)
  await expect(pageB.getByRole('button', { name: 'Delete Mac and Cheese' })).toHaveCount(0)

  await pageB.getByRole('button', { name: 'Claim', exact: true }).click()
  await expect(pageB.getByRole('heading', { name: 'Claim Garden Salad' })).toBeVisible()
  await pageB.getByLabel('Your name').fill('Priya')
  await pageB.getByRole('button', { name: 'Claim dish' }).click()

  await expect(pageB.getByText('Priya is bringing Garden Salad')).toBeVisible()
  await expect(pageB.getByText('Priya', { exact: true })).toBeVisible()

  // Device A sees the claim arrive via live polling, no reload.
  await expect(pageA.getByText('Priya', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(pageA.getByText('Up for grabs')).toHaveCount(0)
})

test('device A edits its own dish', async () => {
  await pageA.getByRole('button', { name: 'Edit Mac and Cheese' }).click()
  await pageA.getByLabel('Servings').fill('12')
  await pageA.getByRole('button', { name: 'Save changes' }).click()
  await expect(pageA.getByText('Dish updated')).toBeVisible()
  await expect(pageA.getByText('Serves 12')).toBeVisible()
})

test('filter chips narrow the list', async () => {
  await pageA.getByRole('button', { name: 'Sides' }).click()
  await expect(dishCard(pageA, 'Garden Salad')).toBeVisible()
  await expect(dishCard(pageA, 'Mac and Cheese')).toHaveCount(0)

  await pageA.getByRole('button', { name: 'Unclaimed' }).click()
  await expect(pageA.getByText('No dishes match this filter.')).toBeVisible()

  await pageA.getByRole('button', { name: 'All', exact: true }).click()
  await expect(dishCard(pageA, 'Mac and Cheese')).toBeVisible()
  await expect(dishCard(pageA, 'Garden Salad')).toBeVisible()
})

test('dashboard shows totals, editable guest count, and color-coded coverage', async () => {
  await pageA.getByRole('tab', { name: 'Dashboard' }).click()

  await expect(pageA.getByTestId('stat-total-items').getByText('2', { exact: true })).toBeVisible()
  await expect(
    pageA.getByTestId('stat-total-servings').getByText('18', { exact: true }),
  ).toBeVisible()

  // 18 servings for 24 guests -> 75%, 6 short.
  await pageA.getByRole('button', { name: 'Edit guest count' }).click()
  await pageA.getByTestId('stat-guest-count').getByRole('spinbutton').fill('24')
  await pageA.getByRole('button', { name: 'Save guest count' }).click()
  await expect(pageA.getByText('Guest count updated')).toBeVisible()
  await expect(pageA.getByTestId('stat-coverage').getByText('75%')).toBeVisible()
  await expect(pageA.getByText('6 servings short')).toBeVisible()

  // 18 servings for 9 guests -> 200%, fully covered.
  await pageA.getByRole('button', { name: 'Edit guest count' }).click()
  await pageA.getByTestId('stat-guest-count').getByRole('spinbutton').fill('9')
  await pageA.getByRole('button', { name: 'Save guest count' }).click()
  await expect(pageA.getByTestId('stat-coverage').getByText('200%')).toBeVisible()
  await expect(pageA.getByText("Everyone's covered")).toBeVisible()

  // Category breakdown reflects the two dishes.
  await expect(pageA.getByText('1 item · 12 servings')).toBeVisible()
  await expect(pageA.getByText('1 item · 6 servings')).toBeVisible()

  await pageA.getByRole('tab', { name: 'Tracker' }).click()
})

test('guest count syncs to the other device', async () => {
  await pageB.getByRole('tab', { name: 'Dashboard' }).click()
  await expect(pageB.getByTestId('stat-guest-count').getByText('9', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await pageB.getByRole('tab', { name: 'Tracker' }).click()
})

test('an invalid host link is rejected', async () => {
  await pageB.goto('/?host=wrong-secret')
  await expect(pageB.getByText("That host link isn't valid.")).toBeVisible()
  await expect(pageB.getByText('Host', { exact: true })).toHaveCount(0)
})

test('host mode grants edit rights on every dish and strips the URL param', async () => {
  await pageB.goto(`/?host=${HOST_SECRET}`)
  await expect(pageB.getByText('Host mode on — you can edit every dish')).toBeVisible()
  await expect(pageB.getByText('Host', { exact: true })).toBeVisible()
  expect(pageB.url()).not.toContain('host=')

  // B can now manage A's dish: delete Garden Salad with confirmation.
  await expect(pageB.getByRole('button', { name: 'Edit Mac and Cheese' })).toBeVisible()
  await pageB.getByRole('button', { name: 'Delete Garden Salad' }).click()
  await expect(pageB.getByRole('heading', { name: 'Delete Garden Salad?' })).toBeVisible()
  await pageB.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(pageB.getByText('Dish removed')).toBeVisible()
  await expect(dishCard(pageB, 'Garden Salad')).toHaveCount(0)

  // A sees the deletion via polling.
  await expect(dishCard(pageA, 'Garden Salad')).toHaveCount(0, { timeout: 10_000 })

  // Exiting host mode drops the extra powers.
  await pageB.getByRole('button', { name: 'Exit host mode' }).click()
  await expect(pageB.getByText('Left host mode')).toBeVisible()
  await expect(pageB.getByRole('button', { name: 'Edit Mac and Cheese' })).toHaveCount(0)
})

test('deleting the last dish returns to the empty state', async () => {
  await pageA.getByRole('button', { name: 'Delete Mac and Cheese' }).click()
  await pageA.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(pageA.getByText('No dishes yet')).toBeVisible()
})

test('API hardening: tables are sealed and ownership is enforced server-side', async ({
  request,
}) => {
  // Direct table access with the anon key must be denied (RLS deny-all).
  const tableRead = await request.get(`${SUPABASE}/rest/v1/dishes`, { headers: rpcHeaders })
  expect(tableRead.status()).toBeGreaterThanOrEqual(400)

  const rpc = async (fn: string, args: Record<string, unknown>) =>
    request.post(`${SUPABASE}/rest/v1/rpc/${fn}`, { headers: rpcHeaders, data: args })

  // Create a dish as owner X.
  const ownerX = crypto.randomUUID()
  const ownerY = crypto.randomUUID()
  const created = await rpc('create_dish', {
    p_owner: ownerX,
    p_name: 'Probe Dish',
    p_category: 'other',
    p_servings: 4,
    p_brought_by: 'X',
  })
  expect(created.ok()).toBe(true)
  const dish = await created.json()

  // The payload computes `mine` but never exposes the owner id.
  expect(dish.mine).toBe(true)
  expect(JSON.stringify(dish)).not.toContain(ownerX)

  // list_dishes as Y: dish visible, not mine, owner id absent.
  const listed = await (await rpc('list_dishes', { p_owner: ownerY })).json()
  const probe = listed.find((d: { id: string }) => d.id === dish.id)
  expect(probe.mine).toBe(false)
  expect(JSON.stringify(listed)).not.toContain(ownerX)

  // Y cannot edit or delete X's dish.
  const patch = await rpc('update_dish', { p_id: dish.id, p_owner: ownerY, p_name: 'Hijacked' })
  expect(patch.status()).toBe(400)
  expect((await patch.json()).message).toBe('not_allowed')

  const del = await rpc('delete_dish', { p_id: dish.id, p_owner: ownerY })
  expect(del.status()).toBe(400)
  expect((await del.json()).message).toBe('not_allowed')

  // Claiming an already-claimed dish is rejected.
  const claim = await rpc('claim_dish', { p_id: dish.id, p_owner: ownerY, p_name: 'Y' })
  expect((await claim.json()).message).toBe('already_claimed')

  // The host secret unlocks the same operations.
  const hostDel = await rpc('delete_dish', { p_id: dish.id, p_owner: ownerY, p_host: HOST_SECRET })
  expect(hostDel.ok()).toBe(true)

  // Settings guardrail.
  const badCount = await rpc('set_guest_count', { p_count: -1 })
  expect((await badCount.json()).message).toBe('guest_count_out_of_range')
})
