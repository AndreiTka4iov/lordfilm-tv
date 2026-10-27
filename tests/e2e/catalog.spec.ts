import { expect, test } from '@playwright/test'
import { mockCatalog, pool } from './fixtures/catalog'

test.beforeEach(async ({ page }) => mockCatalog(page))
test('bounded posters, remote navigation and no persistent catalog cache', async ({
  page,
}) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/v1/catalog/pools/'))
      apiRequests.push(request.url())
  })
  await page.goto('/')
  const cards = page.locator('[data-movie-card]')
  await expect(cards).toHaveCount(60)
  const popular = page.getByRole('list', { name: 'Популярные фильмы' })
  const first = popular.locator('[data-movie-card]').first()
  await expect(first.locator('img')).toHaveCount(1)
  await expect(first.locator('img')).toHaveAttribute('src', /\/w342\//)
  const initialImages = await page.locator('[data-movie-poster]').count()
  expect(initialImages).toBeGreaterThan(0)
  expect(initialImages).toBeLessThan(25)
  await page.getByRole('main').focus()
  await page.keyboard.press('ArrowDown')
  await expect(first).toBeFocused()
  for (let i = 0; i < 19; i++) await page.keyboard.press('ArrowRight')
  await expect(popular.locator('[data-movie-card]').last()).toBeFocused()
  await expect(first.locator('img')).toHaveCount(0)
  await expect(
    popular.locator('[data-movie-card]').last().locator('img'),
  ).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(
    page
      .getByRole('list', { name: 'Новинки' })
      .locator('[data-movie-card]')
      .last(),
  ).toBeFocused()
  expect(await page.locator('[data-movie-poster]').count()).toBeLessThan(25)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('main')).toBeFocused()
  const before = apiRequests.length
  await page
    .getByRole('complementary')
    .getByRole('link', { name: 'Фильмы', exact: true })
    .click()
  await expect(cards).toHaveCount(0)
  await page
    .getByRole('complementary')
    .getByRole('link', { name: 'Главная', exact: true })
    .click()
  await expect(cards).toHaveCount(60)
  await expect.poll(() => apiRequests.length).toBeGreaterThan(before)
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }))
  expect(storage.local.filter((key) => /catalog|movie|pool/.test(key))).toEqual(
    [],
  )
  expect(
    storage.session.filter((key) => /catalog|movie|pool/.test(key)),
  ).toEqual([])
  const after = apiRequests.length
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  expect(apiRequests.length).toBe(after)
})
test('independent failures, manual retry and malformed data validation', async ({
  page,
}) => {
  let attempts = 0
  let unavailable = true
  await page.route('**/v1/catalog/pools/new', (route) => {
    attempts++
    return unavailable
      ? route.fulfill({
          status: 502,
          json: { error: { code: 'UPSTREAM_UNAVAILABLE' } },
        })
      : route.fulfill({ json: pool('new') })
  })
  await page.route('**/v1/catalog/pools/series', (route) =>
    route.fulfill({ json: { ...pool('series'), items: [] } }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('list', { name: 'Популярные фильмы' }).getByRole('listitem'),
  ).toHaveCount(20)
  await expect(page.getByRole('status')).toHaveCount(2)
  unavailable = false
  const beforeRetry = attempts
  await page.getByRole('button', { name: 'Попробовать снова: Новинки' }).click()
  await expect(
    page.getByRole('list', { name: 'Новинки' }).getByRole('listitem'),
  ).toHaveCount(20)
  expect(attempts).toBe(beforeRetry + 1)
  await expect(page.getByRole('status')).toHaveCount(1)
})
test('poster failure keeps title and card geometry', async ({ page }) => {
  await page.route('https://image.tmdb.org/**', (route) => route.abort())
  await page.goto('/')
  const card = page.locator('[data-movie-card]').first()
  await expect(card).toHaveAttribute('aria-label', 'popular фильм 1')
  await expect(card.locator('img')).toHaveCount(0)
  expect((await card.boundingBox())?.height).toBeGreaterThan(250)
})
test('leaving the home page aborts outstanding requests', async ({ page }) => {
  const failed: string[] = []
  page.on('requestfailed', (request) => {
    if (request.url().includes('/v1/catalog/pools/')) failed.push(request.url())
  })
  await page.route('**/v1/catalog/pools/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.fulfill({ json: pool('popular') }).catch(() => {})
  })
  await page.goto('/')
  await expect(
    page.locator('[data-movie-shelf][aria-busy="true"]'),
  ).toHaveCount(3)
  await page
    .getByRole('complementary')
    .getByRole('link', { name: 'Фильмы', exact: true })
    .click()
  await expect.poll(() => failed.length).toBeGreaterThan(0)
  await expect(page.locator('[data-movie-shelf]')).toHaveCount(0)
})

test('remote focus enlarges vertical cards without scrolling after focus', async ({
  page,
}) => {
  await page.goto('/')
  const row = page.getByRole('list', { name: 'Популярные фильмы' })
  const first = row.locator('[data-movie-card]').first()
  const next = row.locator('[data-movie-card]').nth(1)
  await expect(first).toBeVisible()
  const initial = await first.boundingBox()
  const neighbour = await next.boundingBox()
  await page.getByRole('main').focus()
  await page.keyboard.press('ArrowDown')
  await expect(first).toBeFocused()
  const scrollFrames = await page.evaluate(async () => {
    const positions: number[] = []
    for (let i = 0; i < 24; i++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      positions.push(window.scrollY)
    }
    return positions
  })
  expect(
    Math.max(...scrollFrames) - Math.min(...scrollFrames),
  ).toBeLessThanOrEqual(1)
  await expect
    .poll(async () => (await first.boundingBox())?.width ?? 0)
    .toBeCloseTo((initial?.width ?? 0) * 1.04, 1)
  const cover = await first.locator('div').first().boundingBox()
  expect((cover?.width ?? 0) / (cover?.height ?? 1)).toBeCloseTo(2 / 3, 2)
  expect((await next.boundingBox())?.width).toBeCloseTo(
    neighbour?.width ?? 0,
    1,
  )
  const frame = await first.boundingBox()
  const container = await row.boundingBox()
  if (!frame || !container) throw new Error('Missing card bounds')
  expect(frame.x - 6).toBeGreaterThanOrEqual(container.x)
  expect(frame.y - 6).toBeGreaterThanOrEqual(container.y)
  expect(frame.y + frame.height + 6).toBeLessThanOrEqual(
    container.y + container.height,
  )
  for (let i = 0; i < 19; i++) await page.keyboard.press('ArrowRight')
  const last = row.locator('[data-movie-card]').last()
  await expect(last).toBeFocused()
  await expect
    .poll(async () => (await last.boundingBox())?.width ?? 0)
    .toBeCloseTo((initial?.width ?? 0) * 1.04, 1)
  const end = await last.boundingBox()
  if (!end) throw new Error('Missing last card bounds')
  expect(end.x + end.width + 6).toBeLessThanOrEqual(
    container.x + container.width + 1,
  )
  await page.keyboard.press('ArrowRight')
  await expect(last).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('main')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(last).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const newLast = page
    .getByRole('list', { name: 'Новинки' })
    .locator('[data-movie-card]')
    .last()
  await expect(newLast).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(last).toBeFocused()
  await page.evaluate(() =>
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'GoBack',
        bubbles: true,
        cancelable: true,
      }),
    ),
  )
  await expect(page.getByRole('main')).toBeFocused()
})

test('reduced motion preserves a visible focus without zoom', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 960, height: 540 })
  await page.goto('/')
  const first = page.locator('[data-movie-card]').first()
  await expect(first).toBeVisible()
  const before = await first.boundingBox()
  await page.getByRole('main').focus()
  await page.keyboard.press('ArrowDown')
  await expect(first).toBeFocused()
  const focused = await first.boundingBox()
  expect(focused?.width).toBeCloseTo(before?.width ?? 0, 1)
  const style = await first.evaluate((node) => ({
    outline: getComputedStyle(node).outlineStyle,
    transition: getComputedStyle(node).transitionProperty,
  }))
  expect(style.outline).toBe('solid')
  expect(style.transition).toBe('none')
})
