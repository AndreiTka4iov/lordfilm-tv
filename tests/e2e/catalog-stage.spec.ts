import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'

test.beforeEach(async ({ page }) => mockCatalog(page))
test('home updates the preview with focus while only the bottom shelves scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.goto('/')
  const preview = page.locator('[data-catalog-preview]')
  await page
    .locator('[data-movie-group="popular"] [data-movie-card]')
    .first()
    .focus()
  await expect(preview.getByRole('heading')).toHaveText('popular фильм 1')
  await expect(preview).toContainText('Описание фильма 1')
  const top = (await preview.boundingBox())?.y
  const card = page
    .locator('[data-movie-group="popular"] [data-movie-card]')
    .first()
  await card.focus()
  await page.keyboard.press('ArrowRight')
  await expect(preview.getByRole('heading')).toHaveText('popular фильм 2')
  await expect(preview).toContainText('Описание фильма 2')
  await page.keyboard.press('ArrowDown')
  await expect(preview.getByRole('heading')).toHaveText('new фильм 2')
  expect((await preview.boundingBox())?.y).toBe(top)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  expect(
    await page
      .locator('[data-catalog-tray]')
      .evaluate((node) => node.scrollTop),
  ).toBeGreaterThan(0)
  await page.screenshot({
    path: test.info().outputPath('lordfilm-stage-home-960.png'),
  })
})
test('series grid stays below its preview and restores selected item after details', async ({
  page,
}) => {
  await page.goto('/series/')
  const preview = page.locator('[data-catalog-preview]')
  const cards = page.locator('[data-series-catalog] [data-movie-card]')
  await expect(cards).toHaveCount(20)
  await cards.last().focus()
  await expect(preview.getByRole('heading')).toHaveText('series фильм 20')
  await expect(preview).toContainText('Описание фильма 20')
  expect(await page.evaluate(() => scrollY)).toBe(0)
  await page.screenshot({
    path: test.info().outputPath('lordfilm-stage-series-1920.png'),
  })
  await cards.last().press('Enter')
  await expect(page).toHaveURL(/\/movie\//)
  await page.getByRole('link', { name: 'Назад к сериалам' }).click()
  await expect(cards.last()).toBeFocused()
  await expect(preview.getByRole('heading')).toHaveText('series фильм 20')
})
test('rapid focus changes load only the final preview and ignore an older response', async ({
  page,
}) => {
  await page.goto('/series/')
  const preview = page.locator('[data-catalog-preview]')
  await page.locator('[data-series-catalog] [data-movie-card]').first().focus()
  await expect(preview).toContainText('Описание фильма 1')
  let release = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested = false
  await page.route('**/v1/movies/2/*', async (route) => {
    requested = true
    await pending
    await route.fulfill({ status: 502, json: {} }).catch(() => {})
  })
  const cards = page.locator('[data-series-catalog] [data-movie-card]')
  await cards.nth(1).focus()
  await expect.poll(() => requested).toBe(true)
  const calls: string[] = []
  page.on('request', (r) => {
    if (/\/v1\/movies\//.test(r.url())) calls.push(new URL(r.url()).pathname)
  })
  await cards.evaluateAll((nodes) => {
    nodes[2]?.focus()
    nodes[3]?.focus()
    nodes[4]?.focus()
  })
  await expect(preview).toContainText('Описание фильма 5')
  release()
  await expect(preview.getByRole('heading')).toHaveText('series фильм 5')
  await expect(preview).toContainText('Описание фильма 5')
  expect(calls).toEqual(['/v1/movies/5/movie-5'])
  await expect(cards.nth(4)).toBeFocused()
})
test('unavailable preview never prevents opening a focused movie', async ({
  page,
}) => {
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ status: 502, json: {} }),
  )
  await page.goto('/')
  const card = page.locator('[data-movie-card]').first()
  await card.focus()
  await expect(page.locator('[data-catalog-preview]')).toContainText(
    'Описание недоступно',
  )
  await card.press('Enter')
  await expect(page).toHaveURL(/\/movie\//)
})

test('without an active card only the list is shown; leaving cards restores the full list', async ({
  page,
}) => {
  const details: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/v1/movies/')) details.push(r.url())
  })
  for (const path of ['/', '/series/']) {
    await page.goto(path)
    const stage = page.locator('[data-catalog-stage]')
    const tray = page.locator('[data-catalog-tray]')
    const card = stage.locator('[data-movie-card]').first()
    await expect(card).toBeFocused()
    await page.locator('[data-sidebar] a[href="/search/"]').focus()
    await expect(page.locator('[data-catalog-preview]')).toHaveCount(0)
    await expect(page.locator('[data-catalog-artwork]')).toHaveCount(0)
    const full = (await tray.boundingBox())?.height ?? 0
    const before = details.length
    await card.focus()
    await expect(page.locator('[data-catalog-preview]')).toBeVisible()
    await expect.poll(() => details.length).toBeGreaterThan(before)
    expect((await tray.boundingBox())?.height).toBeLessThan(full)
    await page.locator('[data-sidebar] a[href="/search/"]').focus()
    await expect(page.locator('[data-catalog-preview]')).toHaveCount(0)
    await expect(page.locator('[data-catalog-artwork]')).toHaveCount(0)
    expect((await tray.boundingBox())?.height).toBeCloseTo(full, 0)
    await page.keyboard.press('ArrowRight')
    await expect(card).toBeFocused()
    await expect(page.locator('[data-catalog-preview]')).toBeVisible()
  }
})

for (const viewport of [
  { width: 960, height: 540 },
  { width: 1920, height: 1080 },
]) {
  test(`scrolling down clips the previous row at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    for (const path of ['/', '/series/']) {
      await page.goto(path)
      const first = page.locator('[data-movie-card]').first()
      await first.focus()
      await page.keyboard.press('ArrowDown')
      await expect(first).not.toBeFocused()
      await expect
        .poll(async () => {
          const previous = await first.boundingBox()
          const tray = await page.locator('[data-catalog-tray]').boundingBox()
          return previous && tray
            ? previous.y + previous.height - tray.y
            : Infinity
        })
        .toBeLessThanOrEqual(0)
      const active = page.locator('[data-movie-card]:focus')
      await expect(active).toBeInViewport({ ratio: 0.999 })
    }
  })
}

test('the current shelf title stays above the clipped list while navigating', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.goto('/')
  await page.locator('[data-movie-card]').first().focus()
  const title = page.locator('[data-catalog-list-title]')
  await expect(title).toHaveText('Популярные фильмы')
  await page.keyboard.press('ArrowDown')
  await expect(title).toHaveText('Новинки')
  const bounds = await title.boundingBox()
  const tray = await page.locator('[data-catalog-tray]').boundingBox()
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(tray!.y)
  await expect(title).toBeInViewport({ ratio: 0.999 })
  await expect(page.locator('[data-movie-card]:focus')).toBeInViewport({
    ratio: 0.999,
  })
  await expect(page.locator('[data-catalog-preview]')).toContainText(
    'Описание фильма 1',
  )
  await page.screenshot({
    path: test.info().outputPath('lordfilm-list-title-960.png'),
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.press('ArrowUp')
  await expect(title).toHaveText('Популярные фильмы')
  await expect(page.locator('[data-movie-card]:focus')).toBeInViewport({
    ratio: 0.999,
  })
})
