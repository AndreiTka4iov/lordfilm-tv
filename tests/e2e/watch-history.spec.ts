import { expect, test, type Page } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
import { mockPlayback } from './fixtures/playback'
const key = 'lordfilm.watch-history.v1'
const movie = {
  id: '1',
  slug: 'movie-1',
  title: 'Тестовый фильм',
  kind: 'movie',
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
}
const saved = (id = '1') => ({
  ...movie,
  id,
  slug: `movie-${id}`,
  season: null,
  episode: null,
  time: 9,
  duration: 32,
  completed: false,
  updatedAt: 1000 + Number(id),
})
async function setup(page: Page, series = false) {
  await mockCatalog(page)
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ json: { ...movie, kind: series ? 'series' : 'movie' } }),
  )
  await mockPlayback(page, series)
}
async function waitPlaying(page: Page) {
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .evaluate((node) => (node as HTMLVideoElement).currentTime),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.3)
}
test('movie saves exact position on close, survives reload and appears on home', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await waitPlaying(page)
  await page.locator('video').evaluate((node) => {
    const v = node as HTMLVideoElement
    v.pause()
    v.currentTime = 9
  })
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((node) => (node as HTMLVideoElement).seeking),
    )
    .toBe(false)
  await page.keyboard.press('Escape')
  const value = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0],
    key,
  )
  expect(value.time).toBeGreaterThanOrEqual(9)
  expect(value.time).toBeLessThan(10)
  await page.reload()
  await page
    .getByRole('button', { name: 'Продолжить просмотр', exact: true })
    .click()
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((node) => (node as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThanOrEqual(9)
  await page.keyboard.press('Escape')
  await page.goto('/')
  await expect(
    page.locator('[data-movie-group="history"] [data-movie-card]'),
  ).toHaveCount(1)
  await page.screenshot({ path: '/private/tmp/lordfilm-watch-history.png' })
})
test('series restores season and episode; explicit different episode starts fresh', async ({
  page,
}) => {
  await setup(page, true)
  await page.addInitScript(
    ({ key, entry }) => localStorage.setItem(key, JSON.stringify([entry])),
    { key, entry: { ...saved(), kind: 'series', season: 2, episode: 2 } },
  )
  const requests: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/playback')) requests.push(r.url())
  })
  await page.goto('/movie/?id=1&slug=movie-1')
  await page
    .getByRole('button', { name: 'Продолжить просмотр', exact: true })
    .click()
  await expect
    .poll(() =>
      requests.some(
        (url) => url.includes('season=2') && url.includes('episode=2'),
      ),
    )
    .toBe(true)
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((node) => (node as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThanOrEqual(9)
  await page.keyboard.press('Escape')
  await page.locator('[data-series-episode="1"]').click()
  await expect.poll(() => requests.at(-1)).toContain('episode=1')
  await waitPlaying(page)
  expect(
    await page
      .locator('video')
      .evaluate((node) => (node as HTMLVideoElement).currentTime),
  ).toBeLessThan(5)
})
test('history deduplicates, moves watched item first and evicts the oldest beyond 20', async ({
  page,
}) => {
  await setup(page)
  await page.addInitScript(
    ({ key, items }) => localStorage.setItem(key, JSON.stringify(items)),
    { key, items: Array.from({ length: 20 }, (_, i) => saved(String(i + 2))) },
  )
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await waitPlaying(page)
  await page.keyboard.press('Escape')
  const items = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    key,
  )
  expect(items).toHaveLength(20)
  expect(items[0].id).toBe('1')
  expect(items.some((item: { id: string }) => item.id === '2')).toBe(false)
  await page
    .getByRole('button', { name: 'Продолжить просмотр', exact: true })
    .click()
  await waitPlaying(page)
  await page.keyboard.press('Escape')
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key) ?? '[]').filter(
          (item: { id: string }) => item.id === '1',
        ).length,
      key,
    ),
  ).toBe(1)
})
test('corrupt or unavailable storage does not prevent playback', async ({
  page,
}) => {
  await setup(page)
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'broken')
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError')
    }
  }, key)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await waitPlaying(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('completed film starts again and series navigation saves the new episode independently', async ({
  page,
}) => {
  await setup(page, true)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.locator('[data-watch-button]').click()
  await waitPlaying(page)
  await page.locator('video').evaluate((node) => {
    const v = node as HTMLVideoElement
    v.pause()
    v.currentTime = 9
  })
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((node) => (node as HTMLVideoElement).seeking),
    )
    .toBe(false)
  await page
    .getByRole('combobox', { name: 'Серия', exact: true })
    .selectOption('2')
  await waitPlaying(page)
  expect(
    await page
      .locator('video')
      .evaluate((node) => (node as HTMLVideoElement).currentTime),
  ).toBeLessThan(5)
  await page.keyboard.press('Escape')
  const entry = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0],
    key,
  )
  expect(entry.episode).toBe(2)
  expect(entry.time).toBeLessThan(5)
  await page.evaluate(
    ({ key, entry }) =>
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            ...entry,
            kind: 'movie',
            season: null,
            episode: null,
            completed: true,
            time: 32,
          },
        ]),
      ),
    { key, entry },
  )
  await setup(page)
  await page.reload()
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await waitPlaying(page)
  expect(
    await page
      .locator('video')
      .evaluate((node) => (node as HTMLVideoElement).currentTime),
  ).toBeLessThan(5)
})
