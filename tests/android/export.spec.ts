import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { expect, test } from '@playwright/test'
import { pool } from '../e2e/fixtures/catalog'

test('standalone export uses cancellable native messages without any API network', async ({
  page,
}) => {
  const origin = 'https://appassets.androidplatform.net'
  const root = resolve('.next-export')
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/v1/')) apiRequests.push(request.url())
  })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    const path = decodeURIComponent(url.pathname)
    const file = resolve(
      root,
      `.${path}${path.endsWith('/') ? 'index.html' : ''}`,
    )
    if (!file.startsWith(root + sep)) return route.abort()
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.woff2': 'font/woff2',
    }
    try {
      await route.fulfill({
        body: await readFile(file),
        contentType: types[extname(file)] ?? 'application/octet-stream',
      })
    } catch {
      await route.fulfill({ status: 404, body: 'Not Found' })
    }
  })
  await page.addInitScript(() => {
    const host = {
      onmessage: null as null | ((event: { data: string }) => void),
      postMessage: (raw: string) => {
        const resolveNative = (
          window as Window & {
            resolveNative?: (raw: string) => Promise<string>
          }
        ).resolveNative
        if (!resolveNative) throw new Error('Missing native test adapter')
        void resolveNative(raw).then((data) => {
          if (data) host.onmessage?.({ data })
        })
      },
    }
    Object.assign(window, { LordFilmAndroid: host })
  })
  const paths: string[] = []
  const cancellations: string[] = []
  await page.exposeFunction('resolveNative', async (raw: string) => {
    const { id, path, cancel } = JSON.parse(raw) as {
      id: string
      path: string
      cancel?: string
    }
    if (cancel) {
      cancellations.push(cancel)
      return ''
    }
    paths.push(path)
    const url = new URL(path, 'https://native.invalid')
    const group = url.pathname.split('/').at(-1) ?? ''
    const data = pool(group)
    if (url.searchParams.get('q') === 'Медленный')
      await new Promise((resolve) => setTimeout(resolve, 1000))
    const body = url.pathname.startsWith('/v1/movies/')
      ? {
          id: url.pathname.split('/')[3],
          slug: url.pathname.split('/')[4],
          title: 'Название фильма',
          kind: 'movie',
          year: 2026,
          rating: 8.2,
          poster: null,
          backdrop: null,
          description: 'Описание с Android',
          originalTitle: null,
          duration: null,
          genres: [],
          countries: [],
          directors: [],
          actors: [],
        }
      : url.pathname === '/v1/catalog/search'
        ? {
            query: url.searchParams.get('q'),
            items: data.items.map((item) => ({ ...item, poster: null })),
            limited: false,
          }
        : {
            ...data,
            items: data.items.map((item) => ({ ...item, poster: null })),
          }
    return JSON.stringify({ id, status: 200, body })
  })
  await page.goto(origin)
  await expect(page.locator('[data-movie-card]')).toHaveCount(60)
  expect(
    paths.filter((path) => path.startsWith('/v1/catalog/pools/')),
  ).toHaveLength(3)
  await page.locator('[data-movie-card]').first().focus()
  await expect(page.locator('[data-catalog-preview]')).toContainText(
    'Описание с Android',
  )
  await expect(
    page.getByRole('button', { name: 'Подключение', exact: true }),
  ).toHaveCount(0)
  await page.goto(`${origin}/search/`)
  await page.getByRole('searchbox').fill('Люпен')
  await page.getByRole('searchbox').press('Enter')
  await expect(
    page.locator('[data-search-results] [data-movie-card]'),
  ).toHaveCount(20)
  expect(paths.at(-1)).toContain('/v1/catalog/search?')
  await page.getByRole('searchbox').fill('Медленный')
  await page.getByRole('searchbox').press('Enter')
  await expect
    .poll(() =>
      paths.some(
        (path) =>
          new URL(path, 'https://native.invalid').searchParams.get('q') ===
          'Медленный',
      ),
    )
    .toBe(true)
  await page.getByRole('searchbox').fill('Гослинг')
  await page.getByRole('searchbox').press('Enter')
  await expect.poll(() => cancellations.length).toBeGreaterThan(0)
  await expect(
    page.locator('[data-search-results] [data-movie-card]'),
  ).toHaveCount(20)
  await page.goto(`${origin}/series/`)
  await expect(
    page.locator('[data-series-catalog] [data-movie-card]'),
  ).toHaveCount(20)
  expect(paths).toContain('/v1/catalog/pools/series')
  await expect(
    page.getByRole('heading', { name: 'Сериалы', exact: true }),
  ).toBeVisible()
  expect(apiRequests).toEqual([])
})
