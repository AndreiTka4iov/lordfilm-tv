import { expect, test } from '@playwright/test'
import { mockCatalog, pool } from './fixtures/catalog'
import { mockPlayback } from './fixtures/playback'

test.use({ reducedMotion: 'reduce' })

test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await page.route('**/v1/movies/*/*', (route) => {
    const path = new URL(route.request().url()).pathname.split('/')
    return route.fulfill({
      json: {
        id: path[3],
        slug: path[4],
        title: 'Название сериала',
        kind: 'series',
        year: 2026,
        rating: 8,
        poster: null,
        backdrop: null,
        description: 'Описание',
        originalTitle: null,
        duration: null,
        genres: [],
        countries: [],
        directors: [],
        actors: [],
      },
    })
  })
  await mockPlayback(page, true)
})

test('series route loads only its pool, shows 20 cards and keeps posters bounded', async ({
  page,
}) => {
  const pools: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/v1/catalog/pools/'))
      pools.push(new URL(request.url()).pathname)
  })
  await page.goto('/series/')
  await expect(
    page.getByRole('heading', { name: 'Сериалы', exact: true }),
  ).toBeVisible()
  const cards = page.locator('[data-series-catalog] [data-movie-card]')
  await expect(cards).toHaveCount(20)
  expect([...new Set(pools)]).toEqual(['/v1/catalog/pools/series'])
  await expect(page.getByText('Каталог пока не подключён')).toHaveCount(0)
  await expect(
    page.locator('[data-sidebar] a[href="/series/"]'),
  ).toHaveAttribute('aria-current', 'page')
  await expect(cards.first()).toHaveAttribute('href', /from=series-catalog/)
  await expect
    .poll(() =>
      page.locator('[data-series-catalog] [data-movie-poster]').count(),
    )
    .toBeGreaterThan(0)
  expect(
    await page.locator('[data-series-catalog] [data-movie-poster]').count(),
  ).toBeLessThanOrEqual(20)
  await page.screenshot({
    path: test.info().outputPath('lordfilm-series-catalog-1920.png'),
  })
})

test('opening a series and returning via Back, link and browser history restores the exact card', async ({
  page,
}) => {
  await page.goto('/series/')
  const cards = page.locator('[data-series-catalog] [data-movie-card]')
  await expect(cards).toHaveCount(20)
  const chosen = cards.nth(7)
  await chosen.focus()
  await chosen.press('Enter')
  await expect(page).toHaveURL(/id=8.*from=series-catalog/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Название сериала',
  )
  await page
    .getByRole('button', { name: 'Смотреть', exact: true })
    .press('Escape')
  await expect(chosen).toBeFocused()
  await chosen.press('Enter')
  await expect(page).toHaveURL(/\/movie\//)
  await page.getByRole('link', { name: 'Назад к сериалам' }).click()
  await expect(chosen).toBeFocused()
  await chosen.press('Enter')
  await expect(page).toHaveURL(/\/movie\//)
  await page.goBack()
  await expect(page).toHaveURL(/\/series\//)
  await expect(chosen).toBeFocused()
  await page.reload()
  await expect(chosen).toBeFocused()
})

test('remote navigates grid rows, sidebar and search at a small TV size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.goto('/series/')
  const cards = page.locator('[data-series-catalog] [data-movie-card]')
  await expect(cards).toHaveCount(20)
  const menu = page.locator('[data-sidebar] a[href="/series/"]')
  await menu.focus()
  await menu.press('ArrowRight')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(1)).toBeFocused()
  const columns = await page
    .locator('[data-series-catalog] li')
    .evaluateAll(
      (cells) =>
        cells.filter(
          (cell) =>
            (cell as HTMLElement).offsetTop ===
            (cells[0] as HTMLElement).offsetTop,
        ).length,
    )
  await page.keyboard.press('ArrowDown')
  await expect(cards.nth(columns + 1)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(cards.nth(columns)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(menu).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(columns)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-sidebar] a[href="/search/"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(cards.first()).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('lordfilm-series-catalog-960.png'),
  })
})

test('failed series request offers retry and keyboard exits; malformed lists do not render', async ({
  page,
}) => {
  let fail = true
  await page.route('**/v1/catalog/pools/series', (route) =>
    route.fulfill(fail ? { status: 502, json: {} } : { json: pool('series') }),
  )
  await page.goto('/series/')
  const retry = page.getByRole('button', { name: 'Попробовать снова' })
  await expect(retry).toBeVisible()
  const menu = page.locator('[data-sidebar] a[href="/series/"]')
  await menu.focus()
  await menu.press('ArrowRight')
  await expect(retry).toBeFocused()
  await retry.press('ArrowLeft')
  await expect(menu).toBeFocused()
  await menu.press('ArrowRight')
  fail = false
  await retry.press('Enter')
  await expect(
    page.locator('[data-series-catalog] [data-movie-card]'),
  ).toHaveCount(20)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-movie-card]').first()).toBeFocused()
  await page.route('**/v1/catalog/pools/series', (route) =>
    route.fulfill({ json: { ...pool('series'), items: [] } }),
  )
  await page.reload()
  await expect(retry).toBeVisible()
  await expect(page.locator('[data-movie-card]')).toHaveCount(0)
})

test('a late series catalog does not steal focus from the sidebar', async ({
  page,
}) => {
  let release = () => {}
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/v1/catalog/pools/series', async (route) => {
    await wait
    await route.fulfill({ json: pool('series') })
  })
  await page.goto('/series/?focus=8')
  const menu = page.locator('[data-sidebar] a[href="/series/"]')
  await menu.focus()
  release()
  await expect(
    page.locator('[data-series-catalog] [data-movie-card]'),
  ).toHaveCount(20)
  await expect(menu).toBeFocused()
})
