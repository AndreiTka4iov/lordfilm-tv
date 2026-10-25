import { parseMoviePool, type CatalogGroup } from '../model/catalog'
import { requestMovie } from './request'
export async function getMoviePool(group: CatalogGroup, signal: AbortSignal) {
  return parseMoviePool(
    await requestMovie(`/v1/catalog/pools/${group}`, signal),
    group,
  )
}
