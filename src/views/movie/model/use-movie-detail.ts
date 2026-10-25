'use client'
import { useEffect, useState } from 'react'
import {
  getMovieDetail,
  MovieRequestError,
  type MovieDetail,
} from '@/entities/movie'
type State =
  | { status: 'loading' | 'error' | 'not-found' }
  | { status: 'ready'; movie: MovieDetail }
export function useMovieDetail(id: string, slug: string) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!/^\d{1,12}$/.test(id) || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    let active = true
    getMovieDetail(id, slug, controller.signal)
      .then(
        (movie) => {
          if (active) setState({ status: 'ready', movie })
        },
        (error: unknown) => {
          if (active)
            setState({
              status:
                error instanceof MovieRequestError && error.status === 404
                  ? 'not-found'
                  : 'error',
            })
        },
      )
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [id, slug, attempt])
  return {
    state,
    retry: () => {
      setState({ status: 'loading' })
      setAttempt((value) => value + 1)
    },
  }
}
