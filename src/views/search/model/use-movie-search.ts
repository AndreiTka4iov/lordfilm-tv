'use client'
import { useEffect, useState } from 'react'
import { searchMovies, type SearchResults } from '@/entities/movie'
type State =
  { status: 'loading' | 'error' } | { status: 'ready'; result: SearchResults }
export function useMovieSearch(query: string) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    let active = true
    searchMovies(query, controller.signal)
      .then(
        (result) => {
          if (active) setState({ status: 'ready', result })
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
  }, [query, attempt])
  return {
    state,
    retry: () => {
      setState({ status: 'loading' })
      setAttempt((value) => value + 1)
    },
  }
}
