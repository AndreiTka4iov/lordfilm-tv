import { expect, test, type Page } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
const detail = (id: string, slug = `movie-${id}`) => ({
  id,
  slug,
  title: `Фильм ${id}`,
  kind: 'movie',
  year: 2026,
  rating: 8.2,
  poster: null,
  backdrop: `https://image.tmdb.org/t/p/w1280/bg-${id}.jpg`,
  description: `Описание ${id}`,
  originalTitle: null,
  duration: null,
  genres: [],
  countries: [],
  directors: [],
  actors: [],
})
async function focus(page: Page, id: number) {
  await page
    .locator('[data-series-catalog] [data-movie-card]')
    .nth(id - 1)
    .focus()
  await expect(page.locator('[data-catalog-description]')).toHaveText(
    `Описание ${id}`,
  )
  await expect(page.locator('[data-catalog-artwork]')).toHaveCount(1)
  await page
    .locator('[data-catalog-artwork]')
    .evaluate((image) => (image as HTMLImageElement).decode())
}
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await page.route('**/v1/movies/*/*', (route) => {
    const path = new URL(route.request().url()).pathname.split('/')
    return route.fulfill({ json: detail(path[3]!, path[4]!) })
  })
  await page.route('https://image.tmdb.org/**', (route) =>
    route.fulfill({
      headers: { 'cache-control': 'no-store' },
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440"><rect width="780" height="440" fill="#394637"/></svg>',
    }),
  )
})
test('revisiting a loaded preview reuses metadata and the image even with no-store', async ({
  page,
}) => {
  const details: string[] = []
  const images: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/v1/movies/'))
      details.push(new URL(request.url()).pathname)
    if (/\/bg-\d+\.jpg/.test(request.url())) images.push(request.url())
  })
  await page.goto('/series/')
  await focus(page, 1)
  await focus(page, 2)
  await focus(page, 1)
  expect(details).toEqual(['/v1/movies/1/movie-1', '/v1/movies/2/movie-2'])
  expect(images).toHaveLength(2)
})
test('the 11th preview evicts the least recently used entry and its background', async ({
  page,
}) => {
  const calls: Record<string, number> = {}
  const images: Record<string, number> = {}
  page.on('request', (r) => {
    const id = new URL(r.url()).pathname.match(/\/v1\/movies\/(\d+)\//)?.[1]
    if (id) calls[id] = (calls[id] ?? 0) + 1
    const image = r.url().match(/bg-(\d+)\.jpg/)?.[1]
    if (image) images[image] = (images[image] ?? 0) + 1
  })
  await page.goto('/series/')
  for (let id = 1; id <= 10; id++) await focus(page, id)
  await focus(page, 1)
  await focus(page, 11)
  await focus(page, 1)
  expect(calls['1']).toBe(1)
  expect(images['1']).toBe(1)
  await focus(page, 2)
  expect(calls['2']).toBe(2)
  expect(images['2']).toBe(2)
})
test('client navigation keeps the preview cache, while reload clears it', async ({
  page,
}) => {
  let calls = 0
  let images = 0
  page.on('request', (r) => {
    if (r.url().includes('/v1/movies/1/')) calls++
    if (r.url().includes('/bg-1.jpg')) images++
  })
  await page.goto('/')
  await page.locator('[data-movie-card]').first().focus()
  await expect(page.locator('[data-catalog-description]')).toHaveText(
    'Описание 1',
  )
  await page
    .locator('[data-catalog-artwork]')
    .evaluate((image) => (image as HTMLImageElement).decode())
  await page.locator('[data-sidebar] a[href="/series/"]').click()
  await expect(page).toHaveURL(/\/series\//)
  await focus(page, 1)
  expect(calls).toBe(1)
  expect(images).toBe(1)
  await page.reload()
  await focus(page, 1)
  expect(calls).toBe(2)
  expect(images).toBe(2)
})
test('failed metadata is not cached and is requested again on return', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/v1/movies/2/*', (route) => {
    calls++
    return route.fulfill(
      calls === 1 ? { status: 502, json: {} } : { json: detail('2') },
    )
  })
  await page.goto('/series/')
  await focus(page, 3)
  await page.locator('[data-movie-card]').nth(1).focus()
  await expect(page.locator('[data-catalog-description]')).toHaveText(
    'Описание недоступно',
  )
  await focus(page, 3)
  await page.locator('[data-movie-card]').nth(1).focus()
  await expect(page.locator('[data-catalog-description]')).toHaveText(
    'Загружаем описание…',
  )
  await focus(page, 2)
  expect(calls).toBe(2)
})
test('a cancelled preview request does not populate the cache', async ({
  page,
}) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  await page.route('**/v1/movies/2/*', async (route) => {
    calls++
    if (calls === 1) await pending
    await route.fulfill({ json: detail('2') }).catch(() => {})
  })
  await page.goto('/series/')
  await page.locator('[data-movie-card]').nth(1).focus()
  await expect.poll(() => calls).toBe(1)
  await focus(page, 3)
  release()
  await focus(page, 2)
  expect(calls).toBe(2)
})
test('a failed background retries without refetching successful metadata', async ({
  page,
}) => {
  let images = 0
  let details = 0
  page.on('request', (r) => {
    if (r.url().includes('/v1/movies/1/')) details++
  })
  await page.route('https://image.tmdb.org/**/bg-1.jpg', (route) => {
    images++
    return route.fulfill(
      images === 1
        ? { status: 502, body: '' }
        : {
            headers: { 'cache-control': 'no-store' },
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="780" height="440"/>',
          },
    )
  })
  await page.goto('/series/')
  await page.locator('[data-movie-card]').first().focus()
  await expect.poll(() => images).toBe(1)
  await expect(page.locator('[data-catalog-artwork]')).toHaveCount(0)
  await focus(page, 2)
  await focus(page, 1)
  expect(images).toBe(2)
  expect(details).toBe(1)
})

test('a successful preview without its own artwork retains the catalog poster fallback', async ({
  page,
}) => {
  await page.route('**/v1/movies/1/*', (route) =>
    route.fulfill({ json: { ...detail('1'), poster: null, backdrop: null } }),
  )
  await page.goto('/series/')
  await focus(page, 1)
  await expect(page.locator('[data-catalog-artwork]')).toHaveAttribute(
    'src',
    /test-series-1/,
  )
  await focus(page, 2)
  await focus(page, 1)
  await expect(page.locator('[data-catalog-artwork]')).toHaveAttribute(
    'src',
    /test-series-1/,
  )
})
