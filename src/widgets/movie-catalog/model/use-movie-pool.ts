'use client'
import { useEffect, useState } from 'react'
import {
  getMoviePool,
  type CatalogGroup,
  type MoviePreview,
} from '@/entities/movie'

type PoolState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: MoviePreview[] }
export function useMoviePool(group: CatalogGroup) {
  const [state, setState] = useState<PoolState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    let active = true
    getMoviePool(group, controller.signal)
      .then(
        (items) => {
          if (active) setState({ status: 'ready', items })
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
  }, [group, attempt])
  function retry() {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }
  return { state, retry }
}
