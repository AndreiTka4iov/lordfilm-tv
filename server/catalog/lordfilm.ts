import { documents } from './flight.ts'
import {
  parseSearch,
  normalizeSearchQuery,
  type SearchSource,
} from './search.ts'
import { CollapsProvider } from '../playback/collaps.ts'
import { PlaybackUnavailable, type PlaybackSource } from '../playback/types.ts'
import {
  SourceError,
  MovieNotFound,
  type MovieDetail,
  type MovieDetailSource,
  type CatalogSource,
  type Group,
  type Movie,
} from './types.ts'

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
function numeric(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null
}
function image(value: unknown, origin: string): string | null {
  const path = text(value)
  if (!path) return null
  try {
    const url = new URL(path, origin)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

function findRows(value: unknown, group: Group): unknown[] | null {
  if (record(value)) {
    if (group === 'popular' && Array.isArray(value.rows)) {
      const first: unknown = value.rows[0]
      if (record(first) && text(first.anchorId)?.startsWith('films-rank-'))
        return value.rows
    }
    if (
      group !== 'popular' &&
      record(value.initialList) &&
      Array.isArray(value.initialList.items)
    ) {
      return value.initialList.items
    }
    for (const child of Object.values(value)) {
      const found = findRows(child, group)
      if (found) return found
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const found = findRows(child, group)
      if (found) return found
    }
  }
  return null
}
export function parsePool(
  html: string,
  group: Group,
  origin: string,
  releaseYear?: number,
): Movie[] {
  const rows = documents(html)
    .map((value) => findRows(value, group))
    .find((value) => value !== null)
  const result: Movie[] = []
  const ids = new Set<string>()
  for (const value of rows ?? []) {
    if (!record(value)) continue
    const id = text(group === 'popular' ? value.newsId : value.id)
    const slug = text(value.slug)
    const title = text(value.title)
    if (
      !id ||
      !/^\d+$/.test(id) ||
      !slug ||
      !/^[a-zA-Z0-9_-]+$/.test(slug) ||
      !title ||
      ids.has(id)
    )
      continue
    if (group === 'popular' && value.inCatalog !== true) continue
    const fields = record(value.xfields) ? value.xfields : {}
    const year = numeric(value.year, 1888, 2200)
    if (releaseYear !== undefined && year !== releaseYear) continue
    result.push({
      id,
      slug,
      title,
      year: year !== null && Number.isInteger(year) ? year : null,
      poster: image(
        group === 'popular' ? value.posterUrl : value.poster,
        origin,
      ),
      rating: numeric(group === 'popular' ? value.kp : fields.rating, 0, 10),
      kind: group === 'series' ? 'series' : 'movie',
      sourceUrl: new URL(`/movie/${id}/${slug}`, origin).href,
    })
    ids.add(id)
    if (result.length === 20) return result
  }
  throw new SourceError()
}
function findDetail(value: unknown, id: string): RecordValue | null {
  if (record(value)) {
    if (value.id === id && record(value.xfields)) return value
    for (const child of Object.values(value)) {
      const found = findDetail(child, id)
      if (found) return found
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const found = findDetail(child, id)
      if (found) return found
    }
  }
  return null
}
function names(value: unknown, limit: number): string[] {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  return entries
    .filter((item): item is string => typeof item === 'string' && !!item.trim())
    .slice(0, limit)
    .map((item) => item.trim().slice(0, 200))
}
export function parseDetail(
  html: string,
  id: string,
  origin: string,
): MovieDetail {
  const item = documents(html)
    .map((value) => findDetail(value, id))
    .find((value) => value !== null)
  if (
    !item ||
    !record(item.xfields) ||
    !text(item.title) ||
    !text(item.slug) ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(String(item.slug))
  )
    throw new SourceError()
  const fields = item.xfields
  const year = numeric(item.year, 1888, 2200)
  const kind =
    fields.lf_media_kind === 'tv' ||
    fields.lf_media_kind === 'series' ||
    (Array.isArray(item.categoryIds) && item.categoryIds.includes(10))
      ? 'series'
      : 'movie'
  return {
    id,
    slug: String(item.slug),
    title: String(item.title).slice(0, 300),
    year: year !== null && Number.isInteger(year) ? year : null,
    poster: image(item.poster, origin),
    rating: numeric(fields.rating, 0, 10),
    kind,
    sourceUrl: new URL(`/movie/${id}/${String(item.slug)}`, origin).href,
    backdrop:
      image(item.backdrop, origin)?.replace(
        /(https:\/\/image\.tmdb\.org\/t\/p\/)(?:original|w\d+)\//,
        '$1w780/',
      ) ?? null,
    description: (text(item.description) ?? '').slice(0, 12000),
    originalTitle:
      (text(fields.lf_original_title) ?? text(fields.name))?.slice(0, 300) ??
      null,
    duration: text(fields.duration)?.slice(0, 100) ?? null,
    genres: names(item.genres, 12),
    countries: names(fields.countries, 10),
    directors: names(fields.directors, 10),
    actors: names(fields.actors, 20),
  }
}
export class LordFilmSource
  implements CatalogSource, MovieDetailSource, PlaybackSource, SearchSource
{
  private readonly origin: string
  private readonly timeoutMs: number
  private readonly player: CollapsProvider
  constructor(
    origin: string,
    timeoutMs = 10_000,
    player = new CollapsProvider(),
  ) {
    this.player = player
    this.timeoutMs = timeoutMs
    const url = new URL(origin)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid source origin')
    this.origin = url.origin
  }
  async load(group: Group): Promise<Movie[]> {
    const year = new Date().getUTCFullYear()
    const paths: Record<Group, string> = {
      popular: '/top-100',
      new: `/catalog/category/${year}`,
      series: '/serialy',
    }
    return parsePool(
      await this.fetchHtml(paths[group]),
      group,
      this.origin,
      group === 'new' ? year : undefined,
    )
  }
  async search(value: string) {
    const query = normalizeSearchQuery(value)
    if (!query) throw new SourceError()
    const params = new URLSearchParams({ q: query, search_text_mode: 'full' })
    return parseSearch(
      await this.fetchHtml(`/search?${params}`),
      query,
      this.origin,
    )
  }
  async loadDetail(id: string, slug: string): Promise<MovieDetail> {
    if (!/^\d{1,12}$/.test(id) || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug))
      throw new MovieNotFound()
    return parseDetail(
      await this.fetchHtml(`/movie/${id}/${slug}`, true),
      id,
      this.origin,
    )
  }
  async loadPlayback(
    id: string,
    slug: string,
    season?: number,
    episode?: number,
    userAgent?: string,
  ) {
    if (!/^\d{1,12}$/.test(id) || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug))
      throw new MovieNotFound()
    const html = await this.fetchHtml(`/movie/${id}/${slug}`, true)
    const item = documents(html)
      .map((value) => findDetail(value, id))
      .find((value) => value !== null)
    if (!item || !record(item.xfields)) throw new SourceError()
    const providerId = text(item.xfields.collaps_id)
    if (!providerId || !/^\d{1,12}$/.test(providerId))
      throw new PlaybackUnavailable()
    return this.player.resolve(providerId, season, episode, userAgent)
  }
  private async fetchHtml(path: string, detail = false): Promise<string> {
    const signal = AbortSignal.timeout(this.timeoutMs)
    try {
      const response = await fetch(new URL(path, this.origin), {
        signal,
        redirect: 'error',
        headers: { Accept: 'text/html' },
      })
      if (detail && response.status === 404) throw new MovieNotFound()
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('text/html') ||
        !response.body
      )
        throw new SourceError()
      const chunks: Uint8Array[] = []
      let size = 0
      const reader = response.body.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 4 * 1024 * 1024) throw new SourceError()
          chunks.push(value)
        }
      } finally {
        await reader.cancel()
      }
      return Buffer.concat(chunks).toString('utf8')
    } catch (error) {
      if (error instanceof MovieNotFound) throw error
      throw new SourceError(signal.aborted)
    }
  }
}
