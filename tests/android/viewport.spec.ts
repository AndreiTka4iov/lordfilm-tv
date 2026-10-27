import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { expect, test } from '@playwright/test'
import { pool } from '../e2e/fixtures/catalog'

test.use({
  viewport: { width: 819, height: 461 },
  screen: { width: 819, height: 461 },
  deviceScaleFactor: 250 / 160,
  isMobile: true,
})
test('native TV viewport fits a 1280px canvas on a dense 720p display and survives navigation', async ({
  page,
}) => {
  const origin = 'https://appassets.androidplatform.net'
  const root = resolve('.next-export')
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
  await page.addInitScript(
    ({ pools }) => {
      const host: {
        onmessage: null | ((event: { data: string }) => void)
        postMessage: (raw: string) => void
      } = {
        onmessage: null,
        postMessage(raw) {
          const { id, path, cancel } = JSON.parse(raw) as {
            id: string
            path: string
            cancel?: string
          }
          if (cancel) return
          const parts = path.split('/')
          const body = path.startsWith('/v1/catalog/pools/')
            ? pools[parts[4] as keyof typeof pools]
            : {
                id: parts[3],
                slug: parts[4],
                title: 'Фильм',
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
          queueMicrotask(() =>
            host.onmessage?.({
              data: JSON.stringify({ id, status: 200, body }),
            }),
          )
        },
      }
      Object.assign(window, { LordFilmAndroid: host })
    },
    {
      pools: Object.fromEntries(
        ['popular', 'new', 'series'].map((group) => [
          group,
          {
            ...pool(group),
            items: pool(group).items.map((item) => ({ ...item, poster: null })),
          },
        ]),
      ),
    },
  )
  for (const path of ['/', '/series/']) {
    await page.goto(origin + path)
    await expect(page.locator('[data-movie-card]').first()).toBeVisible()
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      'width=1280',
    )
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scale: visualViewport?.scale,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    expect(metrics.width).toBeGreaterThanOrEqual(1279)
    expect(metrics.width).toBeLessThanOrEqual(1281)
    expect(metrics.height).toBeGreaterThanOrEqual(719)
    expect(metrics.scale).toBeCloseTo(819 / 1280, 2)
    expect(metrics.overflow).toBe(false)
    await page.locator('[data-movie-card]').first().focus()
    await expect(page.locator('[data-catalog-preview]')).toBeVisible()
    await page.reload()
    await expect
      .poll(() => page.evaluate(() => innerWidth))
      .toBeGreaterThanOrEqual(1279)
  }
  await page.screenshot({
    path: test.info().outputPath('lordfilm-tv-scale-emulation.png'),
  })
})
