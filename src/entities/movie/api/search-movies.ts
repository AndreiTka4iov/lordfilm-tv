import { parseMoviePreviews, type MoviePreview } from '../model/catalog'
import { requestMovie } from './request'
export interface SearchResults {
  query: string
  items: MoviePreview[]
  limited: boolean
}
export async function searchMovies(
  query: string,
  signal: AbortSignal,
): Promise<SearchResults> {
  const result = await requestMovie(
    `/v1/catalog/search?${new URLSearchParams({ q: query })}`,
    signal,
  )
  if (
    typeof result !== 'object' ||
    result === null ||
    !('query' in result) ||
    result.query !== query ||
    !('items' in result) ||
    !('limited' in result) ||
    typeof result.limited !== 'boolean'
  )
    throw new Error('Invalid search response')
  return {
    query,
    items: parseMoviePreviews(result.items, 40),
    limited: result.limited,
  }
}
