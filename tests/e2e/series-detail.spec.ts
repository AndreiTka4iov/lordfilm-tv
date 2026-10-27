import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
import { mockPlayback, playback } from './fixtures/playback'

const series = {
  id: '1',
  slug: 'movie-1',
  title: 'Тестовый сериал',
  kind: 'series',
  year: 2026,
  rating: 8.5,
  poster: null,
  backdrop: null,
  description: 'Описание сериала.',
  originalTitle: null,
  duration: null,
  genres: ['Драма'],
  countries: [],
  directors: [],
  actors: [],
}
const url = '/movie/?id=1&slug=movie-1&from=series'
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ json: series }),
  )
  await mockPlayback(page, true)
})

test('series metadata loads without video; selected season and episode start in the player and regain focus', async ({
  page,
}) => {
  let videoRequests = 0
  page.on('request', (request) => {
    if (request.url().startsWith('https://fixture.interkh.com/'))
      videoRequests++
  })
  await page.goto(url)
  const picker = page.locator('[data-series-picker]')
  await expect(
    picker.getByRole('button', { name: 'Сезон 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(picker.locator('[data-series-episode]')).toHaveCount(2)
  await expect(page.locator('[data-watch-button]')).toBeFocused()
  await picker.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/private/tmp/lordfilm-series-1920.png' })
  expect(videoRequests).toBe(0)
  await expect(page.locator('video')).toHaveCount(0)
  await picker.getByRole('button', { name: 'Сезон 2', exact: true }).click()
  const second = picker.locator('[data-series-episode="2"]')
  await expect(second).toBeVisible()
  const request = page.waitForRequest((r) =>
    r.url().includes('/playback?season=2&episode=2'),
  )
  await second.press('Enter')
  await request
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Сезон', { exact: true })).toHaveValue('2')
  await expect(page.getByLabel('Серия', { exact: true })).toHaveValue('2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(second).toBeFocused()
})

test('D-pad enters seasons, crosses rows, opens sidebar and returns; Back returns to Watch', async ({
  page,
}) => {
  await page.goto(url)
  await expect(page.locator('[data-series-episode]')).toHaveCount(2)
  await page.locator('[data-watch-button]').press('ArrowDown')
  const firstSeason = page.locator('[data-series-season="1"]')
  await expect(firstSeason).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-series-season="2"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-series-season="2"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[data-series-episode]')).toHaveCount(2)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-series-episode="1"]')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-sidebar] a[href="/"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-series-episode="1"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-series-episode="2"]')).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-series-season="2"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-watch-button]')).toBeFocused()
  await expect(page).toHaveURL(/\/movie\//)
})

test('series errors can be retried and never prevent opening the player', async ({
  page,
}) => {
  let failing = true
  await page.route('**/v1/movies/*/*/playback*', (route) =>
    route.fulfill(
      failing ? { status: 502, json: {} } : { json: playback(1, 1) },
    ),
  )
  await page.goto(url)
  const picker = page.locator('[data-series-picker]')
  await expect(
    picker.getByText('Не удалось загрузить серии', { exact: true }),
  ).toBeVisible()
  const watch = page.locator('[data-watch-button]')
  await watch.press('ArrowDown')
  await expect(picker).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    picker.getByRole('button', { name: 'Попробовать снова' }),
  ).toBeFocused()
  failing = false
  await page.keyboard.press('Enter')
  await expect(picker.locator('[data-series-episode]')).toHaveCount(2)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await watch.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('changing seasons ignores a late response and preserves focus on the chosen season', async ({
  page,
}) => {
  let lateFinished = false
  await page.route('**/v1/movies/*/*/playback*', async (route) => {
    const season = Number(
      new URL(route.request().url()).searchParams.get('season') ?? 1,
    )
    if (season === 2) await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({
      json: {
        ...playback(season, 1),
        episodes: [{ number: 1, title: `Сезон ${season}: начало` }],
      },
    })
    if (season === 2) lateFinished = true
  })
  await page.goto(url)
  await expect(page.locator('[data-series-episode]')).toHaveCount(1)
  await page.locator('[data-series-season="2"]').click()
  await page.locator('[data-series-season="1"]').click()
  await expect.poll(() => lateFinished).toBe(true)
  await expect(page.getByText('Сезон 1: начало', { exact: true })).toBeVisible()
  await expect(page.locator('[data-series-season="1"]')).toBeFocused()
  await expect(page.locator('[data-series-season="1"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('series grid fits a small TV and navigates between episode rows without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.route('**/v1/movies/*/*/playback*', (route) =>
    route.fulfill({
      json: {
        ...playback(1, 1),
        episodes: Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          title: `Название серии ${i + 1}`,
        })),
      },
    }),
  )
  await page.goto(url)
  const episodes = page.locator('[data-series-episode]')
  await expect(episodes).toHaveCount(12)
  await episodes.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(episodes.nth(3)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(episodes.nth(6)).toBeFocused()
  await expect(episodes.nth(6)).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/private/tmp/lordfilm-series-960.png' })
})

test('Watch starts the selected season; description and remote navigation stay reachable', async ({
  page,
}) => {
  await page.goto(url)
  const secondSeason = page.locator('[data-series-season="2"]')
  await secondSeason.click()
  await expect(page.locator('[data-series-episode]')).toHaveCount(2)
  await secondSeason.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-detail-copy]')).toBeFocused()
  await page.locator('[data-watch-button]').focus()
  const request = page.waitForRequest((r) =>
    r.url().includes('/playback?season=2&episode=1'),
  )
  await page.keyboard.press('Enter')
  await request
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-watch-button]')).toBeFocused()
})
