import { test, expect } from '@playwright/test'

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Add game preserves page position at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    )
    await page.route('https://static.pokepc.net/**', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>',
      }),
    )
    await page.goto('/pokemon?selected=bulbasaur', { waitUntil: 'networkidle' })
    const section = page.getByRole('heading', { name: /^Obtainable In/ }).locator('..')
    const trigger = section.locator('[data-slot="combobox-trigger"]')
    await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    const before = await page.evaluate(() => window.scrollY)
    await trigger.click()
    const input = page.getByRole('combobox', { name: 'Search games to add...' })
    await expect(input).toBeVisible()
    await expect(input).toBeInViewport()
    await expect(input).toBeFocused()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2)
    await page.screenshot({ path: info.outputPath('add-game-open.png') })
    await input.press('Escape')
    await expect(input).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2)
    await trigger.press('ArrowDown')
    await expect(input).toBeFocused()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(2)
    await input.fill('Winds')
    await page.getByRole('option', { name: 'Winds', exact: true }).click()
    await expect(section.getByTitle('Winds', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  })
}
