import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
import { mockPlayback } from './fixtures/playback'
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
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ json: movie }),
  )
})
test('real HLS decodes, pauses, seeks and releases video when closed', async ({
  page,
}) => {
  await mockPlayback(page)
  let requests = 0
  page.on('request', (request) => {
    if (request.url().includes('/playback')) requests++
  })
  await page.goto('/movie/?id=1&slug=movie-1')
  const watch = page.getByRole('button', { name: 'Смотреть', exact: true })
  await expect(watch).toBeFocused()
  expect(requests).toBe(0)
  await watch.press('Enter')
  const screen = page.locator('[data-player-screen]')
  await expect(screen).toBeFocused()
  const video = page.locator('video')
  await expect
    .poll(
      () => video.evaluate((node) => (node as HTMLVideoElement).currentTime),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.3)
  expect(
    await video.evaluate((node) => (node as HTMLVideoElement).videoWidth),
  ).toBe(320)
  await page.keyboard.press('Enter')
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).paused))
    .toBe(true)
  const before = await video.evaluate(
    (node) => (node as HTMLVideoElement).currentTime,
  )
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() =>
      video.evaluate((node) => (node as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(before + 8)
  await page.keyboard.press('ArrowUp')
  await expect(
    page.getByRole('button', { name: 'Воспроизвести', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect
    .poll(() => video.evaluate((node) => (node as HTMLVideoElement).paused))
    .toBe(false)
  const element = await video.elementHandle()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(watch).toBeFocused()
  expect(
    await element?.evaluate((node) => ({
      src: node.getAttribute('src'),
      paused: (node as HTMLVideoElement).paused,
    })),
  ).toEqual({ src: null, paused: true })
  await watch.press('Enter')
  await expect.poll(() => requests).toBeGreaterThan(1)
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .evaluate((node) => (node as HTMLVideoElement).currentTime),
      {
        timeout: 15000,
      },
    )
    .toBeGreaterThan(0.3)
  expect(await page.locator('video').count()).toBe(1)
  await expect(page.locator('[data-player-controls]')).toHaveAttribute(
    'aria-hidden',
    'true',
    { timeout: 6000 },
  )
  await page.keyboard.press('ArrowUp')
  await expect(
    page.getByRole('button', { name: 'Пауза', exact: true }),
  ).toBeFocused()
  await page.evaluate(() =>
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'MediaPlayPause',
        bubbles: true,
        cancelable: true,
      }),
    ),
  )
  await expect
    .poll(() =>
      page
        .locator('video')
        .evaluate((node) => (node as HTMLVideoElement).paused),
    )
    .toBe(true)
})
test('series switches episode through the API and replaces the active video', async ({
  page,
}) => {
  await mockPlayback(page, true)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .evaluate((node) => (node as HTMLVideoElement).currentTime),
      {
        timeout: 15000,
      },
    )
    .toBeGreaterThan(0.2)
  await page.keyboard.press('ArrowUp')
  const episode = page.getByLabel('Серия', { exact: true })
  await episode.selectOption('2')
  await expect(page.getByLabel('Серия', { exact: true })).toHaveValue('2')
  await expect
    .poll(
      () =>
        page
          .locator('video')
          .evaluate((node) => (node as HTMLVideoElement).currentTime),
      {
        timeout: 15000,
      },
    )
    .toBeGreaterThan(0.2)
  expect(await page.locator('video').count()).toBe(1)
  await page.getByLabel('Сезон', { exact: true }).selectOption('2')
  await expect(page.getByLabel('Сезон', { exact: true })).toHaveValue('2')
  await expect(page.getByLabel('Серия', { exact: true })).toHaveValue('1')
})
test('unavailable source and broken HLS provide recovery and Back exits only player', async ({
  page,
}) => {
  await mockPlayback(page)
  await page.route('**/v1/movies/*/*/playback*', (route) =>
    route.fulfill({ status: 422, json: {} }),
  )
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Видео недоступно',
  )
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Смотреть', exact: true }),
  ).toBeFocused()
  await mockPlayback(page)
  await page.route('https://fixture.interkh.com/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.getByRole('button', { name: 'Смотреть', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Не удалось воспроизвести',
    { timeout: 15000 },
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/movie\//)
})

test('Android background event closes the player and releases media', async ({
  page,
}) => {
  await mockPlayback(page)
  await page.goto('/movie/?id=1&slug=movie-1')
  const watch = page.getByRole('button', { name: 'Смотреть', exact: true })
  await expect(watch).toBeFocused()
  await watch.press('Enter')
  await expect(page.locator('video')).toHaveCount(1)
  const video = await page.locator('video').elementHandle()
  await page.evaluate(() => window.dispatchEvent(new Event('lordfilm:pause')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(watch).toBeFocused()
  expect(await video?.evaluate((node) => node.getAttribute('src'))).toBeNull()
  await video?.dispose()
})
