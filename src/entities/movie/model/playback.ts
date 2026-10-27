export interface EpisodeSelection {
  season: number
  episode: number
}
export interface Playback {
  kind: 'movie' | 'series'
  type: 'hls'
  cdnTime: number | null
  src: string
  audioNames: string[]
  seasons: number[]
  episodes: { number: number; title: string }[]
  season: number | null
  episode: number | null
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function positive(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 9999
  )
}
export function parsePlayback(value: unknown): Playback {
  if (
    !record(value) ||
    !['movie', 'series'].includes(String(value.kind)) ||
    value.type !== 'hls' ||
    !(
      value.cdnTime === undefined ||
      value.cdnTime === null ||
      (typeof value.cdnTime === 'number' &&
        Number.isInteger(value.cdnTime) &&
        value.cdnTime >= 1_000_000_000 &&
        value.cdnTime <= 9_999_999_999)
    ) ||
    typeof value.src !== 'string' ||
    value.src.length > 8192 ||
    !Array.isArray(value.audioNames) ||
    value.audioNames.length > 32 ||
    !value.audioNames.every(
      (item) => typeof item === 'string' && item.length <= 100,
    ) ||
    !Array.isArray(value.seasons) ||
    value.seasons.length > 200 ||
    !value.seasons.every(positive) ||
    !Array.isArray(value.episodes) ||
    value.episodes.length > 300 ||
    !value.episodes.every(
      (item: unknown) =>
        record(item) &&
        positive(item.number) &&
        typeof item.title === 'string' &&
        item.title.length <= 120,
    ) ||
    !(value.season === null || positive(value.season)) ||
    !(value.episode === null || positive(value.episode))
  )
    throw new Error('Invalid playback data')
  const url = new URL(value.src)
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.interkh.com') ||
    url.username ||
    url.password ||
    !url.pathname.endsWith('.m3u8')
  )
    throw new Error('Invalid video URL')
  const episodes = value.episodes as Playback['episodes']
  if (
    value.kind === 'series' &&
    (value.season === null ||
      !value.seasons.includes(value.season) ||
      !episodes.some((episode) => episode.number === value.episode))
  )
    throw new Error('Invalid episode selection')
  return {
    kind: value.kind as Playback['kind'],
    type: 'hls',
    cdnTime: typeof value.cdnTime === 'number' ? value.cdnTime : null,
    src: url.href,
    audioNames: value.audioNames as string[],
    seasons: value.seasons as number[],
    episodes,
    season: value.season,
    episode: value.episode,
  }
}
