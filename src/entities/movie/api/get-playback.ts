import { parsePlayback } from '../model/playback'
import { requestMovie } from './request'
export async function getPlayback(
  id: string,
  slug: string,
  signal: AbortSignal,
  season?: number,
  episode?: number,
) {
  const query = new URLSearchParams()
  if (season !== undefined) query.set('season', String(season))
  if (episode !== undefined) query.set('episode', String(episode))
  return parsePlayback(
    await requestMovie(
      `/v1/movies/${id}/${slug}/playback${query.size ? `?${query}` : ''}`,
      signal,
    ),
  )
}
