import { parseMovieDetail } from '../model/detail'
import { requestMovie } from './request'
export async function getMovieDetail(
  id: string,
  slug: string,
  signal: AbortSignal,
) {
  return parseMovieDetail(
    await requestMovie(`/v1/movies/${id}/${slug}`, signal),
    id,
  )
}
