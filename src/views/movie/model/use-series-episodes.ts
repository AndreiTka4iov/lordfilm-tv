'use client'
import { useEffect, useState } from 'react'
import { getPlayback, type EpisodeSelection } from '@/entities/movie'

type Episodes = { number: number; title: string }[]
type State = {
  status: 'loading' | 'ready' | 'error'
  seasons: number[]
  season: number | null
  episodes: Episodes
}

/** Keep only episode metadata; video URLs are requested fresh when playback starts. */
export function useSeriesEpisodes(
  id: string,
  slug: string,
  onSelection: (selection: EpisodeSelection) => void,
) {
  const [state, setState] = useState<State>({
    status: 'loading',
    seasons: [],
    season: null,
    episodes: [],
  })
  const [request, setRequest] = useState<{ season?: number; attempt: number }>({
    attempt: 0,
  })
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25_000)
    getPlayback(id, slug, controller.signal, request.season)
      .then((source) => {
        if (!active) return
        if (source.kind !== 'series' || source.season === null)
          throw new Error('Expected series')
        setState({
          status: 'ready',
          seasons: source.seasons,
          season: source.season,
          episodes: source.episodes,
        })
        if (source.episode !== null)
          onSelection({ season: source.season, episode: source.episode })
      })
      .catch(() => {
        if (active)
          setState((current) => ({ ...current, status: 'error', episodes: [] }))
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [id, slug, request, onSelection])
  function selectSeason(season?: number) {
    setState((current) => ({
      ...current,
      status: 'loading',
      season: season ?? current.season,
      episodes: [],
    }))
    setRequest((current) => ({
      ...(season !== undefined ? { season } : {}),
      attempt: current.attempt + 1,
    }))
  }
  return { state, selectSeason, retry: () => selectSeason(request.season) }
}
