export const catalogGroups = ['popular', 'new', 'series'] as const
export type CatalogGroup = (typeof catalogGroups)[number]
export interface MoviePreview {
  id: string
  slug: string
  title: string
  year: number | null
  rating: number | null
  poster: string | null
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nullableNumber(
  value: unknown,
  min: number,
  max: number,
): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max)
  )
}
export function parseMoviePreviews(
  items: unknown,
  limit: number,
): MoviePreview[] {
  if (!Array.isArray(items) || items.length > limit)
    throw new Error('Invalid movie list')
  const ids = new Set<string>()
  return items.map((item: unknown) => {
    if (
      !object(item) ||
      typeof item.id !== 'string' ||
      !/^\d{1,64}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.slug !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(item.slug) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 300 ||
      !nullableNumber(item.year, 1888, 2200) ||
      (item.year !== null && !Number.isInteger(item.year)) ||
      !nullableNumber(item.rating, 0, 10)
    )
      throw new Error('Invalid movie')
    let poster: string | null = null
    if (item.poster !== null) {
      if (typeof item.poster !== 'string' || item.poster.length > 2048)
        throw new Error('Invalid poster')
      const url = new URL(item.poster)
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Invalid poster URL')
      // Use the source CDN's smaller derivative; never request original TMDB posters.
      if (url.hostname === 'image.tmdb.org')
        url.pathname = url.pathname.replace(
          /^\/t\/p\/(?:original|w\d+)\//,
          '/t/p/w342/',
        )
      poster = url.href
    }
    ids.add(item.id)
    // Keep only the fields rendered by the shelf, rather than retaining the DTO.
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      year: item.year,
      rating: item.rating,
      poster,
    }
  })
}

export function parseMoviePool(
  value: unknown,
  group: CatalogGroup,
): MoviePreview[] {
  if (
    !object(value) ||
    value.group !== group ||
    !Array.isArray(value.items) ||
    value.items.length !== 20
  )
    throw new Error('Invalid catalog pool')
  const items = parseMoviePreviews(value.items, 20)
  if (
    group === 'new' &&
    items.some((item) => item.year !== new Date().getUTCFullYear())
  )
    throw new Error('Invalid release year')
  return items
}
