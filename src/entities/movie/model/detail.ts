export interface MovieDetail {
  id: string
  slug: string
  title: string
  kind: 'movie' | 'series'
  year: number | null
  rating: number | null
  poster: string | null
  backdrop: string | null
  description: string
  originalTitle: string | null
  duration: string | null
  genres: string[]
  countries: string[]
  directors: string[]
  actors: string[]
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nullableText(value: unknown, limit: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= limit)
}
function names(value: unknown, limit: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= limit &&
    value.every((item) => typeof item === 'string' && item.length <= 200)
  )
}
export function parseMovieDetail(value: unknown, id: string): MovieDetail {
  if (
    !record(value) ||
    value.id !== id ||
    typeof value.slug !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(value.slug) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > 300 ||
    !['movie', 'series'].includes(String(value.kind)) ||
    !(
      value.year === null ||
      (typeof value.year === 'number' &&
        Number.isInteger(value.year) &&
        value.year >= 1888 &&
        value.year <= 2200)
    ) ||
    !(
      value.rating === null ||
      (typeof value.rating === 'number' &&
        Number.isFinite(value.rating) &&
        value.rating >= 0 &&
        value.rating <= 10)
    ) ||
    !nullableText(value.poster, 2048) ||
    !(value.backdrop === undefined || nullableText(value.backdrop, 2048)) ||
    typeof value.description !== 'string' ||
    value.description.length > 12000 ||
    !nullableText(value.originalTitle, 300) ||
    !nullableText(value.duration, 100) ||
    !names(value.genres, 12) ||
    !names(value.countries, 10) ||
    !names(value.directors, 10) ||
    !names(value.actors, 20)
  )
    throw new Error('Invalid movie detail')
  let poster: string | null = null
  if (value.poster) {
    const url = new URL(value.poster)
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Invalid poster')
    if (url.hostname === 'image.tmdb.org')
      url.pathname = url.pathname.replace(
        /^\/t\/p\/(?:original|w\d+)\//,
        '/t/p/w342/',
      )
    poster = url.href
  }
  let backdrop: string | null = null
  if (typeof value.backdrop === 'string' && value.backdrop) {
    const url = new URL(value.backdrop)
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Invalid backdrop')
    if (url.hostname === 'image.tmdb.org')
      url.pathname = url.pathname.replace(
        /^\/t\/p\/(?:original|w\d+)\//,
        '/t/p/w780/',
      )
    backdrop = url.href
  }
  return {
    id,
    slug: value.slug,
    title: value.title,
    kind: value.kind as MovieDetail['kind'],
    year: value.year,
    rating: value.rating,
    poster,
    backdrop,
    description: value.description,
    originalTitle: value.originalTitle,
    duration: value.duration,
    genres: value.genres,
    countries: value.countries,
    directors: value.directors,
    actors: value.actors,
  }
}
