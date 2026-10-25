import { SourceError } from '../catalog/types.ts'
import { PlaybackUnavailable, type Playback } from './types.ts'
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
// Read a JSON value embedded in an assignment; never execute provider JavaScript.
function literal(html: string, pattern: RegExp): unknown {
  const match = pattern.exec(html)
  if (!match) return undefined
  const start = match.index + match[0].length
  const first = html[start]
  if (!['[', '{', '"'].includes(first ?? '')) return undefined
  let quoted = false,
    escaped = false,
    depth = 0
  for (let i = start; i < html.length; i++) {
    const char = html[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') {
        quoted = false
        if (first === '"') {
          try {
            return JSON.parse(html.slice(start, i + 1)) as unknown
          } catch {
            return undefined
          }
        }
      }
    } else if (char === '"') quoted = true
    else if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') {
      if (--depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as unknown
        } catch {
          return undefined
        }
      }
    }
  }
  return undefined
}
function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192)
    throw new PlaybackUnavailable()
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.interkh.com') ||
    url.username ||
    url.password ||
    !url.pathname.endsWith('.m3u8')
  )
    throw new PlaybackUnavailable()
  return url.href
}
function sourceUrl(value: unknown, html: string): string {
  const url = mediaUrl(value)
  // The public embed appends a literal request tag before passing URLs to its player.
  // Read only that declaration, never the decoy text or executable expressions.
  const declaration =
    /^[\t ]*var\s+lok\s*=\s*\d+\s*,\s*[a-zA-Z_$][\w$]*\s*=\s*"([0-9a-f]{8,64})"\s*;/m.exec(
      html,
    )
  return declaration
    ? `${url}${url.includes('?') ? '&' : '?'}${declaration[1]}`
    : url
}
function positive(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 9999
    ? number
    : null
}
function audioNames(value: unknown): string[] {
  if (!record(value) || !Array.isArray(value.names)) return []
  return value.names
    .slice(0, 32)
    .map((name) => (typeof name === 'string' ? name.slice(0, 100) : ''))
}
export function parsePlayback(
  html: string,
  selectedSeason?: number,
  selectedEpisode?: number,
): Playback {
  const clock = /\bunixTime\s*=\s*(\d{9,11})\b/.exec(html)
  const cdnTime = clock ? Number(clock[1]) : null
  const seasonsValue = literal(html, /\bseasons\s*:\s*/)
  if (Array.isArray(seasonsValue)) {
    const seasons = seasonsValue
      .filter(record)
      .filter(
        (season) =>
          season.blocked !== true &&
          positive(season.season) !== null &&
          Array.isArray(season.episodes),
      )
      .sort((a, b) => Number(a.season) - Number(b.season))
    if (seasons.length > 200) throw new PlaybackUnavailable()
    const season = seasons.find(
      (value) =>
        selectedSeason === undefined || Number(value.season) === selectedSeason,
    )
    if (!season || !Array.isArray(season.episodes))
      throw new PlaybackUnavailable()
    const episodes = season.episodes
      .filter(record)
      .filter(
        (value) =>
          value.blocked !== true &&
          positive(value.episode) !== null &&
          typeof value.hls === 'string',
      )
      .sort((a, b) => Number(a.episode) - Number(b.episode))
    if (episodes.length > 300) throw new PlaybackUnavailable()
    const episode = episodes.find(
      (value) =>
        selectedEpisode === undefined ||
        Number(value.episode) === selectedEpisode,
    )
    if (!episode) throw new PlaybackUnavailable()
    return {
      kind: 'series',
      type: 'hls',
      cdnTime,
      src: sourceUrl(episode.hls, html),
      audioNames: audioNames(episode.audio),
      seasons: [...new Set(seasons.map((value) => Number(value.season)))],
      episodes: episodes.map((value) => ({
        number: Number(value.episode),
        title:
          typeof value.title === 'string'
            ? value.title.slice(0, 120)
            : String(value.episode),
      })),
      season: Number(season.season),
      episode: Number(episode.episode),
    }
  }
  if (selectedSeason !== undefined || selectedEpisode !== undefined)
    throw new PlaybackUnavailable()
  const hls = literal(html, /\bhls\s*:\s*/)
  return {
    kind: 'movie',
    type: 'hls',
    cdnTime,
    src: sourceUrl(hls, html),
    audioNames: audioNames(literal(html, /\baudio\s*:\s*/)),
    seasons: [],
    episodes: [],
    season: null,
    episode: null,
  }
}
export class CollapsProvider {
  private readonly origin: string
  private readonly timeoutMs: number
  constructor(origin = 'https://api.ortified.ws', timeoutMs = 10_000) {
    const url = new URL(origin)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid player origin')
    this.origin = url.origin
    this.timeoutMs = timeoutMs
  }
  async resolve(
    id: string,
    season?: number,
    episode?: number,
    userAgent?: string,
  ): Promise<Playback> {
    if (!/^\d{1,12}$/.test(id)) throw new PlaybackUnavailable()
    const signal = AbortSignal.timeout(this.timeoutMs)
    try {
      const response = await fetch(`${this.origin}/embed/movie/${id}`, {
        signal,
        redirect: 'error',
        headers: {
          Accept: 'text/html',
          ...(userAgent ? { 'User-Agent': userAgent.slice(0, 1024) } : {}),
        },
      })
      if (
        response.status === 404 ||
        response.status === 403 ||
        response.status === 451
      )
        throw new PlaybackUnavailable()
      if (
        !response.ok ||
        !response.body ||
        !response.headers.get('content-type')?.includes('text/html')
      )
        throw new SourceError()
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let length = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > 2 * 1024 * 1024) throw new SourceError()
          chunks.push(value)
        }
      } finally {
        await reader.cancel()
      }
      return parsePlayback(
        Buffer.concat(chunks).toString('utf8'),
        season,
        episode,
      )
    } catch (error) {
      if (error instanceof PlaybackUnavailable) throw error
      throw new SourceError(signal.aborted)
    }
  }
}
