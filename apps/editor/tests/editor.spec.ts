import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, type Page, type TestInfo } from '@playwright/test'

const root = resolve(import.meta.dirname, '../../..')
const fixtureData = (info: TestInfo) =>
  resolve(root, '.local/editor-e2e', info.project.name, 'data')
const diagnostics = new WeakMap<Page, string[]>()

function snapshot(directory: string) {
  return Object.fromEntries(
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = resolve(entry.parentPath, entry.name)
        return [
          file.slice(directory.length + 1),
          createHash('sha256').update(readFileSync(file)).digest('hex'),
        ]
      }),
  )
}

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => Reflect.get(window, '__reactRouterDataRouter')?.state?.initialized === true,
  )
  await page.waitForLoadState('networkidle')
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  diagnostics.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.text())
  })
  page.on('requestfailed', (request) =>
    errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
  )
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

test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle')
  expect(diagnostics.get(page)).toEqual([])
})

test('dataset loader and persisted Pokedex edit preserve sibling files', async ({ page }, info) => {
  const data = fixtureData(info)
  const before = snapshot(data)
  const file = resolve(data, 'pokedexes/kanto.json')
  const original = readFileSync(file, 'utf8')
  const record = JSON.parse(original)
  try {
    await visit(page, '/')
    await expect(page.getByText('Total Pokemon:', { exact: false })).toBeVisible()
    await visit(page, '/pokedexes/kanto')
    const name = page.getByLabel('Name', { exact: true })
    await name.fill('Kanto QA')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Pokedex saved.', { exact: true })).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(name).toHaveValue('Kanto QA')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      ...record,
      desc: record.desc ?? null,
      name: 'Kanto QA',
    })
    const after = snapshot(data)
    expect(Object.keys(after).filter((path) => before[path] !== after[path])).toEqual([
      'pokedexes/kanto.json',
    ])
    await page.screenshot({ path: info.outputPath('pokedex.png') })
    await name.fill(record.name)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Pokedex saved.', { exact: true })).toBeVisible()
  } finally {
    writeFileSync(file, original)
  }
  expect(snapshot(data)).toEqual(before)
})

for (const variant of ['classic', 'modern']) {
  test(`${variant} preset create, save and delete preserve sibling presets`, async ({
    page,
  }, info) => {
    const data = fixtureData(info)
    const before = snapshot(data)
    const indexFile = resolve(data, `boxpresets/${variant}/home.json`)
    const originalIndex = readFileSync(indexFile, 'utf8')
    const presetId = 'editor-migration-qa'
    await visit(page, `/box-presets?variant=${variant}&gameSet=home`)
    await page.getByPlaceholder('my-new-preset').fill(presetId)
    await page.getByPlaceholder('My New Preset').fill('Migration QA')
    await page.getByRole('button', { name: 'Add Preset', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/box-presets/${variant}/home/${presetId}$`))
    await expect(page.getByRole('heading', { name: 'Migration QA', exact: true })).toBeVisible()
    await page.getByRole('textbox').first().fill('Migration QA saved')
    await page.getByRole('button', { name: 'Save', exact: true }).first().click()
    await expect(page.getByText('Box preset saved with', { exact: false }).first()).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Migration QA saved', exact: true }),
    ).toBeVisible()
    const saved = JSON.parse(
      readFileSync(
        variant === 'modern' ? resolve(data, `boxpresets/modern/home/${presetId}.json`) : indexFile,
        'utf8',
      ),
    )
    expect((variant === 'modern' ? saved : saved[presetId]).name).toBe('Migration QA saved')
    if (variant === 'classic') {
      delete saved[presetId]
      expect(saved).toEqual(JSON.parse(originalIndex))
    } else {
      expect(
        JSON.parse(readFileSync(indexFile, 'utf8')).filter((id: string) => id !== presetId),
      ).toEqual(JSON.parse(originalIndex))
    }
    const after = snapshot(data)
    const expectedChanges = [`boxpresets/${variant}/home.json`]
    if (variant === 'modern') expectedChanges.push(`boxpresets/modern/home/${presetId}.json`)
    expect(
      Object.keys(after)
        .filter((path) => before[path] !== after[path])
        .sort(),
    ).toEqual(expectedChanges.sort())
    await page.screenshot({ path: info.outputPath(`${variant}-preset.png`) })
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete preset', exact: true }).click()
    await expect(page).toHaveURL(/\/box-presets\?/)
    expect(JSON.parse(readFileSync(indexFile, 'utf8'))).toEqual(JSON.parse(originalIndex))
    writeFileSync(indexFile, originalIndex)
    expect(snapshot(data)).toEqual(before)
  })
}

test('availability and maintenance routes render without runtime errors', async ({
  page,
}, info) => {
  for (const path of ['/pokemon', '/games', '/games/champions', '/maintenance']) {
    await visit(page, path)
    await expect(page.locator('h1')).toBeVisible()
  }
  await page.screenshot({ path: info.outputPath('maintenance.png') })
})

test('Pokemon availability removals update the draft and persist without changing siblings', async ({
  page,
}, info) => {
  const data = fixtureData(info)
  const before = snapshot(data)
  const file = resolve(data, 'pokemon/zygarde.json')
  const original = readFileSync(file, 'utf8')
  const record = JSON.parse(original)
  const transfer = page.getByRole('heading', { name: /^Transfer-only In/ }).locator('..')
  const obtainable = page.getByRole('heading', { name: /^Obtainable In/ }).locator('..')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  try {
    await visit(page, '/pokemon?selected=zygarde')
    await expect(save).toBeDisabled()

    const removeSword = transfer.getByRole('button', { name: 'Remove Sword', exact: true })
    await removeSword.locator('..').hover()
    await removeSword.click()
    await expect(removeSword).toHaveCount(0)
    await expect(save).toBeEnabled()

    const removeY = obtainable.getByRole('button', { name: 'Remove Y', exact: true })
    await removeY.locator('..').hover()
    await removeY.click()
    await expect(removeY).toHaveCount(0)
    expect(readFileSync(file, 'utf8')).toBe(original)

    await save.click()
    await expect(page.getByText('Pokemon availability saved.', { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
    const saved = {
      ...record,
      obtainableIn: record.obtainableIn.filter((id: string) => id !== 'xy-y'),
      transferOnlyIn: record.transferOnlyIn.filter((id: string) => id !== 'swsh-sw'),
    }
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(saved)

    // A second edit must stay editable after receiving a previous save response.
    const removeShield = transfer.getByRole('button', { name: 'Remove Shield', exact: true })
    await removeShield.focus()
    await page.keyboard.press('Enter')
    await expect(removeShield).toHaveCount(0)
    await expect(save).toBeEnabled()
    await save.click()
    await expect(save).toBeDisabled()
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      ...saved,
      transferOnlyIn: saved.transferOnlyIn.filter((id: string) => id !== 'swsh-sh'),
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(removeSword).toHaveCount(0)
    await expect(removeShield).toHaveCount(0)
    await expect(removeY).toHaveCount(0)
    await expect(save).toBeDisabled()
    const after = snapshot(data)
    expect(Object.keys(after).filter((path) => before[path] !== after[path])).toEqual([
      'pokemon/zygarde.json',
    ])
  } finally {
    writeFileSync(file, original)
  }
  expect(snapshot(data)).toEqual(before)
})

test.describe('touch availability removal', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('tapping a game remove button updates the draft', async ({ page }) => {
    await visit(page, '/pokemon?selected=zygarde')
    const transfer = page.getByRole('heading', { name: /^Transfer-only In/ }).locator('..')
    const remove = transfer.getByRole('button', { name: 'Remove Sword', exact: true })
    await remove.tap()
    await expect(remove).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  })
})
