'use client'
import { useEffect, useState } from 'react'
import { getPlayback, type Playback } from '@/entities/movie'
type State =
  { status: 'loading' | 'error' } | { status: 'ready'; source: Playback }
export function usePlayback(id: string, slug: string) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selection, setSelection] = useState<{
    season?: number
    episode?: number
    attempt: number
  }>({ attempt: 0 })
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25_000)
    let active = true
    getPlayback(
      id,
      slug,
      controller.signal,
      selection.season,
      selection.episode,
    )
      .then(
        (source) => {
          if (active) setState({ status: 'ready', source })
        },
        () => {
          if (active) setState({ status: 'error' })
        },
      )
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [id, slug, selection])
  function select(season?: number, episode?: number) {
    setState({ status: 'loading' })
    setSelection((current) => ({
      ...(season !== undefined ? { season } : {}),
      ...(episode !== undefined ? { episode } : {}),
      attempt: current.attempt + 1,
    }))
  }
  return {
    state,
    select,
    retry: () => select(selection.season, selection.episode),
  }
}
