export const groups = ['popular', 'new', 'series'] as const
export type Group = (typeof groups)[number]
export interface Movie {
  id: string
  slug: string
  title: string
  year: number | null
  poster: string | null
  rating: number | null
  kind: 'movie' | 'series'
  sourceUrl: string
}
export interface Pool {
  group: Group
  items: Movie[]
  generatedAt: string
}
export interface CatalogSource {
  load(group: Group): Promise<Movie[]>
}
export class SourceError extends Error {
  readonly timeout: boolean
  constructor(timeout = false) {
    super(timeout ? 'Source timed out' : 'Source catalog unavailable')
    this.timeout = timeout
  }
}

export interface MovieDetail extends Movie {
  backdrop: string | null
  description: string
  originalTitle: string | null
  duration: string | null
  genres: string[]
  countries: string[]
  directors: string[]
  actors: string[]
}
export interface MovieDetailSource {
  loadDetail(id: string, slug: string): Promise<MovieDetail>
}
export class MovieNotFound extends Error {}
