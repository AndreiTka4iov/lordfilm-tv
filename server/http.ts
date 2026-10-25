import { normalizeSearchQuery, type SearchSource } from './catalog/search.ts'
import { PlaybackUnavailable, type PlaybackSource } from './playback/types.ts'
import { createServer } from 'node:http'
import { CatalogService } from './catalog/service.ts'
import {
  groups,
  SourceError,
  MovieNotFound,
  type MovieDetailSource,
  type Group,
} from './catalog/types.ts'

export function createCatalogServer(
  service: CatalogService,
  allowedOrigin?: string,
  details?: MovieDetailSource,
  playback?: PlaybackSource,
  search?: SearchSource,
) {
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    if (allowedOrigin && request.headers.origin === allowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      response.setHeader('Vary', 'Origin')
    }
    const fail = (status: number, code: string, message: string) => {
      response
        .writeHead(status)
        .end(JSON.stringify({ error: { code, message } }))
    }
    const url = new URL(request.url ?? '/', 'http://localhost')
    const match = /^\/v1\/catalog\/pools\/([^/]+)\/?$/.exec(url.pathname)
    const movie = /^\/v1\/movies\/(\d{1,12})\/([a-zA-Z0-9_-]{1,200})\/?$/.exec(
      url.pathname,
    )
    const player =
      /^\/v1\/movies\/(\d{1,12})\/([a-zA-Z0-9_-]{1,200})\/playback\/?$/.exec(
        url.pathname,
      )
    const isSearch = url.pathname === '/v1/catalog/search'
    const group = match?.[1]
    if (
      !isSearch &&
      !player &&
      !movie &&
      (!group || !groups.includes(group as Group))
    )
      return fail(404, 'NOT_FOUND', 'Unknown catalog pool')
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return fail(405, 'METHOD_NOT_ALLOWED', 'Only GET is supported')
    }
    try {
      let pool
      if (isSearch) {
        const values = url.searchParams.getAll('q')
        const query =
          values.length === 1 ? normalizeSearchQuery(values[0]!) : null
        if (!query || [...url.searchParams.keys()].some((key) => key !== 'q'))
          return fail(
            400,
            'INVALID_QUERY',
            'Query must contain 2 to 200 characters',
          )
        if (!search) throw new SourceError()
        pool = await search.search(query)
      } else if (player) {
        const selection: { season?: number; episode?: number } = {}
        for (const key of url.searchParams.keys())
          if (!['season', 'episode'].includes(key))
            return fail(400, 'INVALID_SELECTION', 'Invalid playback selection')
        for (const key of ['season', 'episode'] as const) {
          const values = url.searchParams.getAll(key)
          if (
            values.length > 1 ||
            (values.length === 1 && !/^[1-9]\d{0,3}$/.test(values[0]!))
          )
            return fail(400, 'INVALID_SELECTION', 'Invalid playback selection')
          if (values[0]) selection[key] = Number(values[0])
        }
        if (!playback) throw new PlaybackUnavailable()
        pool = await playback.loadPlayback(
          player[1]!,
          player[2]!,
          selection.season,
          selection.episode,
          request.headers['user-agent'],
        )
      } else if (movie) {
        if (!details) throw new SourceError()
        pool = await details.loadDetail(movie[1]!, movie[2]!)
      } else {
        pool = await service.get(group as Group)
      }
      response.writeHead(200).end(JSON.stringify(pool))
    } catch (error) {
      if (error instanceof PlaybackUnavailable)
        return fail(
          422,
          'PLAYBACK_UNAVAILABLE',
          'No available supported video source',
        )
      if (error instanceof MovieNotFound)
        return fail(404, 'NOT_FOUND', 'Movie not found')
      const timeout = error instanceof SourceError && error.timeout
      fail(
        timeout ? 504 : 502,
        timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        timeout ? 'Catalog source timed out' : 'Catalog source unavailable',
      )
    }
  })
}
