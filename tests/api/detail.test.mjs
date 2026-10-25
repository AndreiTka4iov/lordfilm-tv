import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { LordFilmSource, parseDetail } from '../../server/catalog/lordfilm.ts'
import { CatalogService } from '../../server/catalog/service.ts'
import { createCatalogServer } from '../../server/http.ts'

function page(id = '42', kind = 'movie') {
  const item = {
    id,
    slug: 'test-movie',
    title: 'Тест',
    year: 2026,
    poster: '/poster.webp',
    backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
    categoryIds: kind === 'tv' ? [10] : [130],
    description: 'Описание фильма',
    genres: ['драма'],
    xfields: {
      lf_media_kind: kind,
      duration: '2 ч',
      actors: 'Актёр 1, Актёр 2',
      directors: 'Режиссёр',
      countries: 'США',
      rating: '8.2',
      name: 'Test',
    },
  }
  const text = 'Кириллица\nи двоеточие: текст'
  const flight = `a:T${Buffer.byteLength(text).toString(16)},${text}b:${JSON.stringify({ children: { item } })}\n`
  return `<script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`
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
test('detail parser skips byte-length Flight text and extracts bounded plain metadata', () => {
  const d = parseDetail(page(), '42', 'https://example.com')
  assert.equal(d.description, 'Описание фильма')
  assert.equal(d.rating, 8.2)
  assert.deepEqual(d.actors, ['Актёр 1', 'Актёр 2'])
  assert.equal(d.poster, 'https://example.com/poster.webp')
  assert.equal(d.backdrop, 'https://image.tmdb.org/t/p/w780/backdrop.jpg')
  assert.equal(
    parseDetail(page('42', 'tv'), '42', 'https://example.com').kind,
    'series',
  )
  assert.throws(() => parseDetail(page('43'), '42', 'https://example.com'))
  assert.throws(() => parseDetail('broken', '42', 'https://example.com'))
})
test('detail HTTP endpoint validates paths, supports movie and series, propagates failures', async (t) => {
  const origin = await listen(
    createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html')
      if (req.url.includes('/404/')) return res.writeHead(404).end()
      if (req.url.includes('/500/')) return res.writeHead(500).end()
      if (req.url.includes('/99/')) return
      res.end(
        page(
          req.url.includes('/43/') ? '43' : '42',
          req.url.includes('/43/') ? 'tv' : 'movie',
        ),
      )
    }),
    t,
  )
  const source = new LordFilmSource(origin, 100)
  const api = await listen(
    createCatalogServer(new CatalogService(source), undefined, source),
    t,
  )
  for (const [id, status, kind] of [
    ['42', 200, 'movie'],
    ['43', 200, 'series'],
    ['404', 404],
    ['500', 502],
    ['99', 504],
    ['invalid', 404],
  ]) {
    const response = await fetch(`${api}/v1/movies/${id}/test-movie`)
    assert.equal(response.status, status)
    if (status === 200) assert.equal((await response.json()).kind, kind)
  }
  assert.equal(
    (await fetch(`${api}/v1/movies/42/test-movie`, { method: 'POST' })).status,
    405,
  )
  await assert.rejects(source.loadDetail('42', '../private'))
})
