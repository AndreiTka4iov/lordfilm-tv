import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getMovieDetail, type MoviePreview } from '@/entities/movie'
import {
  previewCacheKey,
  readPreview,
  touchPreview,
  rememberPreview,
} from './preview-cache'

export const CatalogPreviewContext = createContext<{
  focusedKey: string | null
  select: (movie: MoviePreview, key: string) => void
}>({ focusedKey: null, select: () => {} })
export function catalogFocusKey(scope: string, movie: MoviePreview) {
  return `${scope}:${movie.id}:${movie.slug}`
}
export function useCatalogPreview() {
  return useContext(CatalogPreviewContext)
}
export function usePreviewDetail(movie: MoviePreview | null) {
  const id = movie?.id
  const slug = movie?.slug
  const poster = movie?.poster ?? null
  const key = id && slug ? previewCacheKey(id, slug) : null
  const selection = useMemo(() => ({ key }), [key])
  const [result, setResult] = useState<{
    selection: typeof selection
    failed: boolean
  }>()
  const cached = key ? readPreview(key) : undefined
  useEffect(() => {
    if (!id || !slug || !key) return
    if (touchPreview(key)) return
    const controller = new AbortController()
    let active = true
    let timeout: number | undefined
    const timer = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), 25000)
      void getMovieDetail(id, slug, controller.signal)
        .then(
          (detail) => {
            if (active) {
              rememberPreview(key, detail, poster)
              setResult({ selection, failed: false })
            }
          },
          () => {
            if (active) setResult({ selection, failed: true })
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
  }, [id, slug, key, poster, selection])
  if (!id || !slug || !key) return undefined
  if (cached) return { id, slug, detail: cached }
  return result?.selection === selection && result.failed
    ? { id, slug, detail: null }
    : undefined
}
