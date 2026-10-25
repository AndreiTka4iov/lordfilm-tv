import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import {
  parsePlayback,
  CollapsProvider,
} from '../../server/playback/collaps.ts'
import { LordFilmSource } from '../../server/catalog/lordfilm.ts'
import { CatalogService } from '../../server/catalog/service.ts'
import { createCatalogServer } from '../../server/http.ts'
const hls = 'https://media.interkh.com/movie/master.m3u8'
const film = `source: { hls: "${hls}", audio: {"names":["Русский","Original"]} }`
function serial() {
  return (
    'playlist: { seasons:' +
    JSON.stringify([
      { season: 2, episodes: [{ episode: '1', hls, title: 'Серия 1' }] },
      {
        season: 1,
        episodes: [
          { episode: '1', hls, title: 'Серия 1' },
          { episode: '2', hls, title: 'Серия 2' },
        ],
      },
      { season: 3, blocked: true, episodes: [{ episode: '1', hls }] },
    ]) +
    ' }'
  )
}
async function listen(server, t) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return `http://127.0.0.1:${server.address().port}`
}
test('public player config parses as data with movie/episode selection and no script execution', () => {
  assert.equal(parsePlayback(film).src, hls)
  assert.equal(
    parsePlayback('var lok = 1, requestTag = \"1234abcd\";\n' + film).src,
    hls + '?1234abcd',
  )
  assert.deepEqual(parsePlayback(film).audioNames, ['Русский', 'Original'])
  const source = parsePlayback(serial())
  assert.equal(source.kind, 'series')
  assert.equal(source.season, 1)
  assert.equal(source.episode, 1)
  assert.deepEqual(source.seasons, [1, 2])
  assert.equal(parsePlayback(serial(), 1, 2).episode, 2)
  assert.throws(() => parsePlayback(serial(), 3, 1))
  assert.throws(() => parsePlayback(serial(), 1, 999))
  assert.throws(() =>
    parsePlayback('hls: "http://127.0.0.1/private/master.m3u8"'),
  )
  assert.throws(() =>
    parsePlayback('hls: "https://evilinterkh.com/master.m3u8"'),
  )
  assert.throws(() => parsePlayback('source: {hls: fetch("private")}'))
})
test('real playback API fetches fresh provider data, validates query and maps failures', async (t) => {
  let calls = 0
  const providerOrigin = await listen(
    createServer((req, res) => {
      calls++
      res.setHeader('Content-Type', 'text/html')
      if (req.url.endsWith('/2')) return res.end(serial())
      if (req.url.endsWith('/3')) return res.writeHead(451).end('blocked')
      if (req.url.endsWith('/4')) return
      if (req.url.endsWith('/5'))
        return res.end('x'.repeat(2 * 1024 * 1024 + 1))
      res.end(film.replace('master.m3u8', `master.m3u8?t=${calls}`))
    }),
    t,
  )
  const origin = await listen(
    createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html')
      const id = req.url.split('/')[2]
      if (id === '404') return res.writeHead(404).end()
      const item = { id, slug: 'test', xfields: { collaps_id: id } }
      res.end(
        `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify({ item })}\n`])})</script>`,
      )
    }),
    t,
  )
  const source = new LordFilmSource(
    origin,
    500,
    new CollapsProvider(providerOrigin, 80),
  )
  const api = await listen(
    createCatalogServer(new CatalogService(source), undefined, source, source),
    t,
  )
  const endpoint = (id, query = '') =>
    `${api}/v1/movies/${id}/test/playback${query}`
  const first = await fetch(endpoint('1'))
  assert.equal(first.status, 200)
  const firstBody = await first.json()
  const secondBody = await (await fetch(endpoint('1'))).json()
  assert.notEqual(firstBody.src, secondBody.src)
  assert.equal(first.headers.get('cache-control'), 'no-store')
  const episode = await (
    await fetch(endpoint('2', '?season=1&episode=2'))
  ).json()
  assert.equal(episode.episode, 2)
  for (const query of [
    '?season=0',
    '?episode=1&episode=2',
    '?season=nan',
    '?url=http://localhost',
  ])
    assert.equal((await fetch(endpoint('1', query))).status, 400)
  assert.equal((await fetch(endpoint('3'))).status, 422)
  assert.equal((await fetch(endpoint('4'))).status, 504)
  assert.equal((await fetch(endpoint('5'))).status, 502)
  assert.equal((await fetch(endpoint('404'))).status, 404)
  assert.equal((await fetch(endpoint('2', '?season=9'))).status, 422)
})

test('CDN transport preserves URL paths and advances the provider hour', async () => {
  const { cdnUrl } =
    await import('../../src/widgets/video-player/model/cdn-loader.ts')
  const now = 1792956525000
  const url = cdnUrl(
    'https://media.interkh.com/folder/index.m3u8?a=1',
    now / 1000,
    now,
    now,
  )
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const substituted = 'DlChEXitLONYRkFjAsnBbymWzSHMqKPgQZpvwerofJTVdIuUcxaG'
  const encoded = new URL(url).pathname
    .split('/x-en-x/')[1]
    .replace(/[A-Za-z]/g, (char) => alphabet[substituted.indexOf(char)])
  assert.equal(
    Buffer.from(encoded, 'base64').toString(),
    `${Math.round(now / 3600000)}//folder/index.m3u8?a=1`,
  )
  assert.notEqual(
    cdnUrl('https://media.interkh.com/x.ts', now / 1000, now, now + 3600000),
    cdnUrl('https://media.interkh.com/x.ts', now / 1000, now, now),
  )
  assert.throws(() =>
    cdnUrl('https://example.com/master.m3u8', now / 1000, now, now),
  )
})
