import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { LordFilmSource, parsePool } from '../../server/catalog/lordfilm.ts'
import { CatalogService } from '../../server/catalog/service.ts'
import { createCatalogServer } from '../../server/http.ts'

function page(rows, popular = false) {
  const data = popular ? { rows } : { initialList: { items: rows } }
  const payload = `1:${JSON.stringify(data)}\n`
  return `<script>self.__next_f.push(${JSON.stringify([1, payload])})</script>`
}
const rows = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  newsId: String(i + 1),
  slug: `film-${i}`,
  title: `Film ${i}`,
  year: 2026,
  poster: '/poster.webp',
  posterUrl: '/poster.webp',
  anchorId: `films-rank-${i + 1}`,
  inCatalog: true,
  kp: 8.2,
  xfields: { rating: '7.8' },
}))
async function listen(server, t) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return `http://127.0.0.1:${server.address().port}`
}
test('parser selects distinct records and normalizes URLs and numeric metadata', () => {
  const items = parsePool(
    page([
      rows[0],
      rows[0],
      { ...rows[1], poster: 'javascript:alert(1)', year: 'bad' },
      ...rows.slice(2),
    ]),
    'new',
    'https://example.com',
  )
  assert.equal(items.length, 20)
  assert.equal(items[0].poster, 'https://example.com/poster.webp')
  assert.equal(items[0].rating, 7.8)
  assert.equal(items[1].poster, null)
  assert.equal(items[1].year, null)
  assert.throws(() =>
    parsePool(page(rows.slice(0, 12)), 'new', 'https://example.com'),
  )
  assert.throws(() =>
    parsePool('<script>alert(1)</script>', 'popular', 'https://example.com'),
  )
})
test('real HTTP flow: each pool has 20, independent cache, coalescing and expiry', async (t) => {
  const calls = new Map()
  const origin = await listen(
    createServer((req, res) => {
      calls.set(req.url, (calls.get(req.url) ?? 0) + 1)
      res.setHeader('Content-Type', 'text/html')
      res.end(page(rows, req.url === '/top-100'))
    }),
    t,
  )
  let now = Date.now()
  const api = await listen(
    createCatalogServer(
      new CatalogService(new LordFilmSource(origin), 100, () => now),
      'http://localhost:3000',
    ),
    t,
  )
  const urls = ['popular', 'new', 'series'].map(
    (g) => `${api}/v1/catalog/pools/${g}`,
  )
  const responses = await Promise.all(
    [...urls, urls[0]].map((url) =>
      fetch(url, { headers: { Origin: 'http://localhost:3000' } }),
    ),
  )
  for (const response of responses) {
    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('Access-Control-Allow-Origin'),
      'http://localhost:3000',
    )
    const pool = await response.json()
    assert.equal(pool.items.length, 20)
    assert.equal(new Set(pool.items.map((item) => item.id)).size, 20)
    assert.equal(
      pool.items[0].kind,
      pool.group === 'series' ? 'series' : 'movie',
    )
  }
  assert.deepEqual(Object.fromEntries(calls), {
    '/top-100': 1,
    '/filmy': 1,
    '/serialy': 1,
  })
  await fetch(urls[0])
  assert.equal(calls.get('/top-100'), 1)
  now += 101
  await fetch(urls[0])
  assert.equal(calls.get('/top-100'), 2)
  assert.equal((await fetch(`${api}/v1/catalog/pools/unknown`)).status, 404)
  assert.equal((await fetch(urls[0], { method: 'POST' })).status, 405)
})
test('upstream failures, redirects, malformed content and short catalogs return 502', async (t) => {
  for (const mode of ['error', 'redirect', 'malformed', 'short', 'oversize']) {
    const origin = await listen(
      createServer((req, res) => {
        res.setHeader('Content-Type', 'text/html')
        if (mode === 'error') res.writeHead(503)
        if (mode === 'redirect') res.writeHead(302, { Location: '/login' })
        res.end(
          mode === 'short'
            ? page(rows.slice(0, 12))
            : mode === 'oversize'
              ? 'x'.repeat(4 * 1024 * 1024 + 1)
              : 'unavailable',
        )
      }),
      t,
    )
    const api = await listen(
      createCatalogServer(new CatalogService(new LordFilmSource(origin))),
      t,
    )
    const response = await fetch(`${api}/v1/catalog/pools/new`)
    assert.equal(response.status, 502, mode)
    assert.equal((await response.json()).error.code, 'UPSTREAM_UNAVAILABLE')
  }
})
test('HTTP timeout returns 504 and failed requests are retried', async (t) => {
  let calls = 0
  const origin = await listen(
    createServer(() => {
      calls++
    }),
    t,
  )
  const api = await listen(
    createCatalogServer(new CatalogService(new LordFilmSource(origin, 30))),
    t,
  )
  for (let i = 0; i < 2; i++)
    assert.equal((await fetch(`${api}/v1/catalog/pools/new`)).status, 504)
  assert.equal(calls, 2)
})
test('expired data is not served when the source fails', async () => {
  let now = 0
  let calls = 0
  const service = new CatalogService(
    {
      load: async () => {
        if (++calls > 1) throw new Error('offline')
        return parsePool(page(rows), 'new', 'https://example.com')
      },
    },
    10,
    () => now,
  )
  await service.get('new')
  now = 11
  await assert.rejects(service.get('new'))
  await assert.rejects(service.get('new'))
  assert.equal(calls, 3)
})
