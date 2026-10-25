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
export interface PlaybackSource {
  loadPlayback(
    id: string,
    slug: string,
    season?: number,
    episode?: number,
    userAgent?: string,
  ): Promise<Playback>
}
export class PlaybackUnavailable extends Error {}
