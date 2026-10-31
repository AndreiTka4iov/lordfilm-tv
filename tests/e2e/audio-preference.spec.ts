import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
import { mockPlayback, playback } from './fixtures/playback'

async function setup(page: import('@playwright/test').Page) {
  await mockCatalog(page)
  await mockPlayback(page, true)
  const voices = ['Студия А', 'Студия Б']
  await page.route('**/v1/movies/*/*/playback*', (route) => {
    const url = new URL(route.request().url())
    const season = Number(url.searchParams.get('season') ?? 1)
    const episode = Number(url.searchParams.get('episode') ?? 1)
    const names =
      episode === 2
        ? [...voices].reverse()
        : episode === 3
          ? voices.slice(0, 1)
          : voices
    return route.fulfill({
      json: {
        ...playback(season, episode),
        src: `https://fixture.interkh.com/master.m3u8?episode=${episode}`,
        audioNames: names,
        episodes: [1, 2, 3, 4].map((number) => ({
          number,
          title: `Серия ${number}`,
        })),
      },
    })
  })
  await page.route('https://fixture.interkh.com/master.m3u8*', (route) => {
    const episode = Number(
      new URL(route.request().url()).searchParams.get('episode') ?? 1,
    )
    const names =
      episode === 2 ? ['B', 'A'] : episode === 3 ? ['A'] : ['A', 'B']
    return route.fulfill({
      contentType: 'application/vnd.apple.mpegurl',
      body: [
        '#EXTM3U',
        ...names.map(
          (name, index) =>
            `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="dub",NAME="${name}",LANGUAGE="ru",DEFAULT=${index === 0 ? 'YES' : 'NO'},AUTOSELECT=${index === 0 ? 'YES' : 'NO'}`,
        ),
        '#EXT-X-STREAM-INF:BANDWIDTH=350000,RESOLUTION=320x180,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="dub"',
        'index.m3u8',
      ].join('\n'),
    })
  })
}

test('voice follows its name across reordered episodes, missing tracks and reload', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.locator('[data-watch-button]').click()
  const audio = page.getByLabel('Озвучка', { exact: true })
  await expect(audio).toHaveValue('0')
  await audio.selectOption({ label: 'Студия Б' })
  await page.getByLabel('Серия', { exact: true }).selectOption('2')
  await expect(audio.locator('option:checked')).toHaveText('Студия Б')
  await expect(audio).toHaveValue('0')
  await page.getByLabel('Серия', { exact: true }).selectOption('3')
  await expect(page.getByLabel('Серия', { exact: true })).toHaveValue('3')
  await expect(audio).toHaveCount(0)
  await page.getByLabel('Серия', { exact: true }).selectOption('4')
  await expect(audio).toHaveValue('1')
  await expect(audio.locator('option:checked')).toHaveText('Студия Б')
  await page.getByLabel('Сезон', { exact: true }).selectOption('2')
  await expect(page.getByLabel('Сезон', { exact: true })).toHaveValue('2')
  await expect(audio.locator('option:checked')).toHaveText('Студия Б')
  await page.keyboard.press('Escape')
  await page.reload()
  await page.locator('[data-watch-button]').click()
  await expect(audio.locator('option:checked')).toHaveText('Студия Б')
  await page.keyboard.press('Escape')
  await page.goto('/movie/?id=2&slug=movie-2')
  await page.locator('[data-watch-button]').click()
  await expect(audio.locator('option:checked')).toHaveText('Студия А')
})

test('voice still survives episode changes when storage writes are blocked', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'lordfilm.audio-preferences.v1')
        throw new DOMException('Storage full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await setup(page)
  await page.goto('/movie/?id=1&slug=movie-1')
  await page.locator('[data-watch-button]').click()
  const audio = page.getByLabel('Озвучка', { exact: true })
  await audio.selectOption({ label: 'Студия Б' })
  await page.getByLabel('Серия', { exact: true }).selectOption('2')
  await expect(audio.locator('option:checked')).toHaveText('Студия Б')
})
