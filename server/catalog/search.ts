import { documents } from './flight.ts'
import { SourceError, type Movie } from './types.ts'
export interface SearchResults {
  query: string
  items: Movie[]
  limited: boolean
}
export interface SearchSource {
  search(query: string): Promise<SearchResults>
}
export function normalizeSearchQuery(value: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  const query = value.trim().replace(/\s+/g, ' ')
  return query.length >= 2 && query.length <= 200 ? query : null
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function searchList(value: unknown): unknown[] | null {
  if (record(value)) {
    if (typeof value.listVersionKey === 'string' && Array.isArray(value.items))
      return value.items
    for (const child of Object.values(value)) {
      const found = searchList(child)
      if (found) return found
    }
  } else if (Array.isArray(value))
    for (const child of value) {
      const found = searchList(child)
      if (found) return found
    }
  return null
}
function emptyState(value: unknown): boolean {
  if (record(value))
    return (
      value.children === 'Ничего не найдено' ||
      Object.values(value).some(emptyState)
    )
  return Array.isArray(value) && value.some(emptyState)
}
export function parseSearch(
  html: string,
  query: string,
  origin: string,
): SearchResults {
  const docs = documents(html)
  const rows = docs.map(searchList).find((value) => value !== null)
  if (!rows) {
    if (docs.some(emptyState)) return { query, items: [], limited: false }
    throw new SourceError()
  }
  const items: Movie[] = [],
    ids = new Set<string>()
  for (const row of rows.slice(0, 40)) {
    if (
      !record(row) ||
      typeof row.id !== 'string' ||
      !/^\d{1,12}$/.test(row.id) ||
      typeof row.slug !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(row.slug) ||
      typeof row.title !== 'string' ||
      !row.title.trim()
    )
      throw new SourceError()
    if (ids.has(row.id)) continue
    ids.add(row.id)
    const fields = record(row.xfields) ? row.xfields : {}
    let poster: string | null = null
    if (typeof row.poster === 'string' && row.poster.length <= 2048) {
      try {
        const url = new URL(row.poster, origin)
        if (url.protocol === 'https:' && !url.username && !url.password)
          poster = url.href
      } catch {
        /* Missing artwork is allowed. */
      }
    }
    const rating =
      typeof fields.rating === 'string' && fields.rating.trim()
        ? Number(fields.rating)
        : typeof fields.rating === 'number'
          ? fields.rating
          : null
    items.push({
      id: row.id,
      slug: row.slug,
      title: row.title.slice(0, 300),
      year:
        typeof row.year === 'number' &&
        Number.isInteger(row.year) &&
        row.year >= 1888 &&
        row.year <= 2200
          ? row.year
          : null,
      rating:
        rating !== null &&
        Number.isFinite(rating) &&
        rating >= 0 &&
        rating <= 10
          ? rating
          : null,
      poster,
      kind:
        fields.lf_media_kind === 'tv' ||
        fields.lf_media_kind === 'series' ||
        (Array.isArray(row.categoryIds) && row.categoryIds.includes(10))
          ? 'series'
          : 'movie',
      sourceUrl: new URL(`/movie/${row.id}/${row.slug}`, origin).href,
    })
  }
  return { query, items, limited: rows.length >= 40 }
}
