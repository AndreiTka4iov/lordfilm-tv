import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'

test.beforeEach(async ({ page }) => mockCatalog(page))

test('each page remembers its card across reload and menu navigation without stealing menu focus', async ({
  page,
}) => {
  await page.goto('/')
  const home = page.locator('[data-movie-group="new"] [data-movie-card]').nth(3)
  await home.focus()
  await page.reload()
  await expect(home).toBeFocused()
  const seriesLink = page.locator('[data-sidebar] a[href="/series/"]')
  await seriesLink.focus()
  await seriesLink.press('Enter')
  const series = page.locator('[data-series-catalog] [data-movie-card]').nth(8)
  await expect(series).toBeAttached()
  await expect(seriesLink).toBeFocused()
  await series.focus()
  await page.reload()
  await expect(series).toBeFocused()
  const homeLink = page.locator('[data-sidebar] a[href="/"]')
  await homeLink.focus()
  await homeLink.press('Enter')
  await expect(home).toBeAttached()
  await expect(homeLink).toBeFocused()
  await homeLink.press('ArrowRight')
  await expect(home).toBeFocused()
  await seriesLink.focus()
  await seriesLink.press('Enter')
  await expect(series).toBeAttached()
  await expect(seriesLink).toBeFocused()
  await seriesLink.press('ArrowRight')
  await expect(series).toBeFocused()
})

test('unavailable storage does not prevent remembering focus during navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('storage unavailable')
    }
  })
  await page.goto('/series/')
  const card = page.locator('[data-movie-card]').nth(2)
  await card.focus()
  await page.locator('[data-sidebar] a[href="/series/"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(card).toBeFocused()
})

test('movie details restore the last control instead of always focusing Watch', async ({
  page,
}) => {
  await page.goto('/movie/?id=1&slug=movie-1')
  const about = page.locator('[data-about-button]')
  await expect(about).toBeVisible()
  await about.focus()
  await page.reload()
  await expect(about).toBeFocused()
})

test('a new catalog focuses its first card by default', async ({ page }) => {
  for (const path of ['/', '/series/']) {
    await page.goto(path)
    await expect(page.locator('[data-movie-card]').first()).toBeFocused()
  }
})

test('a removed saved card falls back to the first available card', async ({
  page,
}) => {
  await page.goto('/series/')
  const first = page.locator('[data-movie-card]').first()
  await expect(first).toBeFocused()
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith('lordfilm:focus:'),
    )!
    const bookmark = JSON.parse(sessionStorage.getItem(key)!)
    bookmark.href = '/movie/?id=999999&slug=removed'
    bookmark.label = 'Removed title'
    sessionStorage.setItem(key, JSON.stringify(bookmark))
  })
  await page.reload()
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-movie-card]').nth(1)).toBeFocused()
})
