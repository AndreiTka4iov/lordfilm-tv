import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMoviePool } from '../src/entities/movie/model/catalog.ts'

test('new releases reject old years on the client while other shelves allow classics', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: String(index + 1),
    slug: `movie-${index}`,
    title: 'Film',
    year: new Date().getUTCFullYear(),
    rating: null,
    poster: null,
  }))
  assert.equal(parseMoviePool({ group: 'new', items }, 'new').length, 20)
  items[0].year = 1995
  assert.throws(() => parseMoviePool({ group: 'new', items }, 'new'))
  assert.equal(
    parseMoviePool({ group: 'popular', items }, 'popular')[0].year,
    1995,
  )
})
