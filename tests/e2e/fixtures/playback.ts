import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
export function playback(
  season: number | null = null,
  episode: number | null = null,
) {
  return {
    kind: season === null ? 'movie' : 'series',
    type: 'hls',
    cdnTime: null,
    src: `https://fixture.interkh.com/master.m3u8${episode ? `?episode=${episode}` : ''}`,
    audioNames: [],
    seasons: season === null ? [] : [1, 2],
    episodes:
      season === null
        ? []
        : [
            { number: 1, title: 'Первая серия' },
            { number: 2, title: 'Вторая серия' },
          ],
    season,
    episode,
  }
}
export async function mockPlayback(page: Page, series = false) {
  await page.route('**/v1/movies/*/*/playback*', (route) => {
    const url = new URL(route.request().url())
    const season = series ? Number(url.searchParams.get('season') ?? 1) : null
    const episode = series ? Number(url.searchParams.get('episode') ?? 1) : null
    return route.fulfill({ json: playback(season, episode) })
  })
  await page.route('https://fixture.interkh.com/**', async (route) => {
    const file = new URL(route.request().url()).pathname.slice(1)
    if (!/^(master\.m3u8|index\.m3u8|init\.mp4|segment\d{2}\.m4s)$/.test(file))
      return route.abort()
    const body = await readFile(
      path.join(process.cwd(), 'tests/e2e/fixtures/media', file),
    )
    return route.fulfill({
      body,
      contentType: file.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp4',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
}
