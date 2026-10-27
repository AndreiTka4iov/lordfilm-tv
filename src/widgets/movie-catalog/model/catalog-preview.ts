import { createContext, useContext, useEffect, useState } from 'react'
import {
  getMovieDetail,
  type MovieDetail,
  type MoviePreview,
} from '@/entities/movie'

export const CatalogPreviewContext = createContext<
  (movie: MoviePreview) => void
>(() => {})
export function useCatalogPreview() {
  return useContext(CatalogPreviewContext)
}
export function usePreviewDetail(movie: MoviePreview | null) {
  const [result, setResult] = useState<{
    id: string
    slug: string
    detail: MovieDetail | null
  }>()
  const id = movie?.id
  const slug = movie?.slug
  useEffect(() => {
    if (!id || !slug) return
    const controller = new AbortController()
    let active = true
    let timeout: number | undefined
    const timer = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), 25000)
      void getMovieDetail(id, slug, controller.signal)
        .then(
          (detail) => {
            if (active) setResult({ id, slug, detail })
          },
          () => {
            if (active) setResult({ id, slug, detail: null })
          },
        )
        .finally(() => window.clearTimeout(timeout))
    }, 220)
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
      window.clearTimeout(timeout)
    }
  }, [id, slug])
  return result?.id === id && result?.slug === slug ? result : undefined
}
