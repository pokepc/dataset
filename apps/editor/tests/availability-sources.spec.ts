import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, type APIResponse, type Page, type TestInfo } from '@playwright/test'

async function visit(page: Page) {
  await page.goto('/pokemon?selected=zygarde', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => Reflect.get(window, '__reactRouterDataRouter')?.state?.initialized === true,
  )
  await expect(
    page.getByRole('button', { name: 'Load availability sources', exact: true }),
  ).toBeVisible()
}

const comparison = (page: Page) =>
  page.getByRole('region', { name: 'Availability source comparison', exact: true })
const record = (info: TestInfo) =>
  resolve(
    import.meta.dirname,
    '../../../.local/editor-e2e',
    info.project.name,
    'data/pokemon/zygarde.json',
  )

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  )
  await page.route('https://static.pokepc.net/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#64748b"/></svg>',
    }),
  )
})

test('comparison loads real source fixtures independently and preserves the draft', async ({
  page,
}, info) => {
  const before = readFileSync(record(info), 'utf8')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const requests: string[] = []
  let releaseSerebii: () => void = () => {}
  const slowSource = new Promise<void>((resolve) => {
    releaseSerebii = resolve
  })
  const responses = new Map<string, APIResponse>()
  await page.route(/\/availability-sources(?:\.data)?\?/, async (route) => {
    const url = new URL(route.request().url())
    const source = url.searchParams.get('source')!
    requests.push(source)
    const response = responses.get(source) ?? (await route.fetch())
    responses.set(source, response)
    if (source === 'serebii' && !url.searchParams.has('refresh')) await slowSource
    await route.fulfill({ response })
  })
  await visit(page)
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Load availability sources', exact: true }).click()
  await expect(page).toHaveURL(/sources=true(?:&|$)/)
  const panel = comparison(page)
  const sword = panel.locator('[data-game-id="swsh-sw"]')
  await expect(sword.locator('[data-source="bulbapedia"]')).toContainText('Dynamax Adventures')
  await expect(sword.locator('[data-source="pokeapi"]')).toContainText('max-lair')
  await expect(panel.getByTestId('source-status-serebii')).toContainText('Loading…')
  await expect(sword.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'loading')
  releaseSerebii()
  await expect(sword.locator('[data-source="serebii"]')).toContainText('Dynamax Adventures')
  await expect(panel.getByRole('columnheader').nth(1)).toHaveText('Verdict')
  await expect(sword.locator('[data-verdict="obtainable"]')).toContainText('✅')
  await expect(
    panel.locator('[data-game-id="oras-as"] [data-verdict="transfer-only"]'),
  ).toContainText('🔀')
  await expect(panel.locator('[data-game-id="usum-um"] [data-verdict="event-only"]')).toContainText(
    '🎁',
  )
  await expect(panel.locator('[data-game-id="sv-s"] [data-verdict="unavailable"]')).toContainText(
    '❌',
  )
  await expect(panel.locator('[data-game-id="rb-r"] [data-verdict="unknown"]')).toContainText('—')
  await sword.locator('[data-verdict] summary').click()
  await expect(sword.locator('[data-verdict] details')).toHaveAttribute('open', '')
  await expect(sword.locator('[data-verdict] p')).toContainText('Bulbapedia:')
  await sword.locator('[data-verdict] summary').click()
  await expect(sword).toContainText('Transfer only')
  await expect(sword.locator('[data-source="bulbapedia"]')).toContainText('50% Forme')
  await expect(sword.locator('[data-source="bulbapedia"] a').first()).toHaveAttribute(
    'href',
    /^https:\/\/bulbapedia\.bulbagarden\.net\//,
  )
  const games = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../data/indices/games.json'), 'utf8'),
  ) as string[]
  const concrete = games.filter(
    (id) =>
      JSON.parse(
        readFileSync(resolve(import.meta.dirname, `../../../data/games/${id}.json`), 'utf8'),
      ).type === 'game',
  )
  expect(
    await panel
      .locator('tbody tr')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-game-id'))),
  ).toEqual(concrete)
  await panel.getByLabel('Filter comparison games').fill('swsh-')
  await expect(panel.locator('tbody tr')).toHaveCount(2)
  await panel.getByRole('button', { name: 'Refresh sources', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Refresh sources', exact: true })).toBeEnabled()
  expect(requests).toHaveLength(6)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  expect(readFileSync(record(info), 'utf8')).toBe(before)
  await panel.screenshot({ path: info.outputPath('availability-comparison.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel.getByRole('button', { name: 'Refresh sources', exact: true })).toBeVisible()
  const scroller = panel.getByRole('region', { name: 'Availability comparison table', exact: true })
  expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await panel.screenshot({ path: info.outputPath('availability-comparison-mobile.png') })
  expect(errors).toEqual([])
})

test('source errors can be retried and late responses do not follow Pokemon navigation', async ({
  page,
}) => {
  let failSerebii = true
  let releaseLate: () => void = () => {}
  const lateResponse = new Promise<void>((resolve) => {
    releaseLate = resolve
  })
  let holdRefresh = false
  const responses = new Map<string, APIResponse>()
  await page.route(/\/availability-sources(?:\.data)?\?/, async (route) => {
    const url = new URL(route.request().url())
    const source = url.searchParams.get('source')!
    if (source === 'serebii' && failSerebii) {
      failSerebii = false
      url.searchParams.set('source', 'invalid-fixture-source')
      await route.fulfill({ response: await route.fetch({ url: url.toString() }) })
      return
    }
    // Reuse the cached real response for explicit refreshes; no live network in QA.
    url.searchParams.delete('refresh')
    const pokemonId = url.searchParams.get('pokemonId')!
    const key = `${pokemonId}:${source}`
    const response = responses.get(key) ?? (await route.fetch({ url: url.toString() }))
    responses.set(key, response)
    if (holdRefresh && source === 'bulbapedia' && pokemonId === 'zygarde') await lateResponse
    await route.fulfill({ response })
  })
  await visit(page)
  await page.getByRole('button', { name: 'Load availability sources', exact: true }).click()
  const panel = comparison(page)
  await expect(panel.getByTestId('source-status-serebii')).toContainText(
    'Unknown availability source.',
  )
  await expect(panel.locator('[data-game-id="swsh-sw"] [data-source="bulbapedia"]')).toContainText(
    'Dynamax Adventures',
  )
  await panel.getByRole('button', { name: 'Reload Serebii', exact: true }).click()
  await expect(panel.locator('[data-game-id="swsh-sw"] [data-source="serebii"]')).toContainText(
    'Dynamax Adventures',
  )
  holdRefresh = true
  await panel.getByRole('button', { name: 'Reload Bulbapedia', exact: true }).click()
  await expect(panel.getByTestId('source-status-bulbapedia')).toContainText('Loading…')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/selected=zygarde-10(?:&|$)/)
  await expect(page).toHaveURL(/sources=true(?:&|$)/)
  await expect(panel.getByTestId('source-status-pokeapi')).toContainText('Loaded')
  releaseLate()
  await page.waitForLoadState('networkidle')
  await expect(panel.getByRole('button', { name: 'Refresh sources', exact: true })).toBeEnabled()
  await expect(panel.locator('[data-source="pokeapi"]')).not.toContainText(['max-lair'])
  await expect(
    page.getByRole('region', { name: 'Availability comparison table', exact: true }),
  ).toBeVisible()
})

test('open comparison follows Next, Prev and reload; hiding stops automatic loading', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route(/\/availability-sources(?:\.data)?\?/, async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.has('refresh')).toBe(false)
    requests.push(`${url.searchParams.get('pokemonId')}:${url.searchParams.get('source')}`)
    await route.continue()
  })
  const panel = comparison(page)
  async function expectLoaded(pokemonId: string, count: number) {
    await expect(panel.getByRole('button', { name: 'Refresh sources', exact: true })).toBeEnabled()
    expect(requests).toHaveLength(count)
    expect(requests.slice(-3).sort()).toEqual(
      ['bulbapedia', 'pokeapi', 'serebii'].map((source) => `${pokemonId}:${source}`),
    )
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  }

  await visit(page)
  await page.getByRole('button', { name: 'Load availability sources', exact: true }).click()
  await expect(page).toHaveURL(/sources=true(?:&|$)/)
  await expectLoaded('zygarde', 3)

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/selected=zygarde-10(?:&|$)/)
  await expectLoaded('zygarde-10', 6)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expectLoaded('zygarde-10', 9)

  await page.getByRole('button', { name: 'Prev', exact: true }).click()
  await expect(page).toHaveURL(/selected=zygarde(?:&|$)/)
  await expectLoaded('zygarde', 12)

  await panel.getByRole('button', { name: 'Hide comparison', exact: true }).click()
  await expect(page).not.toHaveURL(/sources=/)
  await expect(panel.getByRole('table')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Show comparison', exact: true }).click()
  await expect(page).toHaveURL(/sources=true(?:&|$)/)
  await expect(panel.getByRole('table')).toBeVisible()
  expect(requests).toHaveLength(12)

  await panel.getByRole('button', { name: 'Hide comparison', exact: true }).click()
  await expect(page).not.toHaveURL(/sources=/)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/selected=zygarde-10(?:&|$)/)
  await expect(
    panel.getByRole('button', { name: 'Load availability sources', exact: true }),
  ).toBeVisible()
  await expect(panel.getByRole('table')).toHaveCount(0)
  expect(requests).toHaveLength(12)
})
