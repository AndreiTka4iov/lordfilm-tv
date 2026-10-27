import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { expect, test } from '@playwright/test'
import { playback } from '../e2e/fixtures/playback'

test('exported series page selects episodes through the native bridge without an HTTP API', async ({
  page,
}) => {
  const origin = 'https://appassets.androidplatform.net'
  const root = resolve('.next-export')
  const paths: string[] = []
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
      '.woff2': 'font/woff2',
      '.txt': 'text/plain',
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
        const resolveSeries = (
          window as Window & {
            resolveSeries?: (raw: string) => Promise<string>
          }
        ).resolveSeries
        if (!resolveSeries) throw new Error('Missing native adapter')
        void resolveSeries(raw).then((data) => {
          if (data) host.onmessage?.({ data })
        })
      },
    }
    Object.assign(window, { LordFilmAndroid: host })
  })
  await page.exposeFunction('resolveSeries', async (raw: string) => {
    const { id, path, cancel } = JSON.parse(raw) as {
      id: string
      path: string
      cancel?: string
    }
    if (cancel) return ''
    paths.push(path)
    const url = new URL(path, 'https://native.invalid')
    const body = url.pathname.endsWith('/playback')
      ? playback(
          Number(url.searchParams.get('season') ?? 1),
          Number(url.searchParams.get('episode') ?? 1),
        )
      : {
          id: '1',
          slug: 'series',
          title: 'Нативный сериал',
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
        }
    return JSON.stringify({ id, status: 200, body })
  })
  await page.goto(`${origin}/movie/?id=1&slug=series`)
  const picker = page.locator('[data-series-picker]')
  await expect(picker.locator('[data-series-episode]')).toHaveCount(2)
  await picker.getByRole('button', { name: 'Сезон 2', exact: true }).click()
  await expect(picker.locator('[data-series-episode="2"]')).toBeVisible()
  await picker.locator('[data-series-episode="2"]').click()
  await expect
    .poll(() =>
      paths.some((path) => path.endsWith('/playback?season=2&episode=2')),
    )
    .toBe(true)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(picker.locator('[data-series-episode="2"]')).toBeFocused()
  expect(apiRequests).toEqual([])
})
