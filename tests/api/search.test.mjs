import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import {
  parseSearch,
  normalizeSearchQuery,
} from '../../server/catalog/search.ts'
import { LordFilmSource } from '../../server/catalog/lordfilm.ts'
import { CatalogService } from '../../server/catalog/service.ts'
import { createCatalogServer } from '../../server/http.ts'
function flight(value) {
  return `<script>self.__next_f.push(${JSON.stringify([1, `1:${JSON.stringify(value)}\n`])})</script>`
}
const row = {
  id: '1',
  slug: 'film',
  title: 'Фильм',
  year: 2026,
  poster: 'https://example.com/poster.jpg',
  categoryIds: [10],
  xfields: { rating: '8.2', lf_media_kind: 'tv' },
}
test('search parses only the search list, caps results and validates empty state', () => {
  const html = flight({
    items: Array.from({ length: 42 }, (_, i) => ({
      ...row,
      id: String(i + 1),
    })),
    listVersionKey: 'query',
  })
  const result = parseSearch(html, 'query', 'https://example.com')
  assert.equal(result.items.length, 40)
  assert.equal(result.limited, true)
  assert.equal(result.items[0].kind, 'series')
  assert.equal(
    parseSearch(
      flight({ items: [row, row], listVersionKey: 'x' }),
      'query',
      'https://example.com',
    ).items.length,
    1,
  )
  assert.deepEqual(
    parseSearch(
      flight(['$', 'p', null, { children: 'Ничего не найдено' }]),
      'query',
      'https://example.com',
    ).items,
    [],
  )
  assert.throws(() =>
    parseSearch(flight({ items: [row] }), 'query', 'https://example.com'),
  )
  assert.throws(() =>
    parseSearch('upstream error', 'query', 'https://example.com'),
  )
  assert.throws(() =>
    parseSearch(
      flight({ items: [{ id: 'bad' }], listVersionKey: 'x' }),
      'query',
      'https://example.com',
    ),
  )
  assert.equal(normalizeSearchQuery('  Люпен   сериал '), 'Люпен сериал')
  for (const value of ['я', 'x'.repeat(201), 'ab\u0000'])
    assert.equal(normalizeSearchQuery(value), null)
})
async function listen(server, t) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return `http://127.0.0.1:${server.address().port}`
}
test('search HTTP validates query, does not cache and propagates timeout or invalid source', async (t) => {
  let calls = 0
  const origin = await listen(
    createServer((req, res) => {
      calls++
      const url = new URL(req.url, 'http://localhost')
      res.setHeader('Content-Type', 'text/html')
      if (url.searchParams.get('q') === 'timeout') return
      if (url.searchParams.get('q') === 'broken') return res.end('broken')
      if (url.searchParams.get('q') === 'empty')
        return res.end(flight({ children: 'Ничего не найдено' }))
      assert.equal(url.pathname, '/search')
      res.end(flight({ items: [row], listVersionKey: 'query' }))
    }),
    t,
  )
  const source = new LordFilmSource(origin, 80)
  const api = await listen(
    createCatalogServer(
      new CatalogService(source),
      undefined,
      source,
      source,
      source,
    ),
    t,
  )
  for (const params of [
    '',
    '?q=я',
    '?q=ok&q=two',
    '?q=ab&url=http://localhost',
    '?q=' + 'x'.repeat(201),
  ])
    assert.equal((await fetch(`${api}/v1/catalog/search${params}`)).status, 400)
  assert.equal(calls, 0)
  const url = `${api}/v1/catalog/search?q=${encodeURIComponent('  Люпен  сериал ')}`
  assert.equal((await (await fetch(url)).json()).query, 'Люпен сериал')
  await fetch(url)
  assert.equal(calls, 2)
  assert.deepEqual(
    (await (await fetch(`${api}/v1/catalog/search?q=empty`)).json()).items,
    [],
  )
  assert.equal((await fetch(`${api}/v1/catalog/search?q=broken`)).status, 502)
  assert.equal((await fetch(`${api}/v1/catalog/search?q=timeout`)).status, 504)
  assert.equal((await fetch(url, { method: 'POST' })).status, 405)
})
