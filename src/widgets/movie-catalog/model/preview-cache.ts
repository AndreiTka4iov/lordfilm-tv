import type { MovieDetail } from '@/entities/movie'

export type PreviewDetail = Pick<
  MovieDetail,
  'description' | 'backdrop' | 'poster'
>
interface PreviewEntry {
  detail: PreviewDetail
  artwork: HTMLImageElement | null
}
const previews = new Map<string, PreviewEntry>()
const limit = 10
export function previewCacheKey(id: string, slug: string) {
  return `${id}/${slug}`
}
export function readPreview(key: string) {
  return previews.get(key)?.detail
}
export function touchPreview(key: string) {
  const entry = previews.get(key)
  if (!entry) return false
  previews.delete(key)
  previews.set(key, entry)
  return true
}
export function rememberPreview(
  key: string,
  detail: MovieDetail,
  fallbackPoster: string | null,
) {
  const data = {
    description: detail.description,
    backdrop: detail.backdrop,
    poster: detail.poster || fallbackPoster,
  }
  const entry = previews.get(key) ?? { detail: data, artwork: null }
  if (
    (entry.detail.backdrop || entry.detail.poster) !==
    (data.backdrop || data.poster)
  ) {
    entry.artwork?.remove()
    entry.artwork?.removeAttribute('src')
    entry.artwork = null
  }
  entry.detail = data
  previews.delete(key)
  previews.set(key, entry)
  while (previews.size > limit) {
    const oldest = previews.keys().next().value
    if (oldest === undefined) break
    const entry = previews.get(oldest)
    entry?.artwork?.remove()
    entry?.artwork?.removeAttribute('src')
    previews.delete(oldest)
  }
}
export function createPreviewArtwork(
  src: string,
  candidate?: HTMLImageElement | null,
) {
  if (
    candidate?.getAttribute('src') === src &&
    (!candidate.complete || candidate.naturalWidth > 0)
  )
    return candidate
  const image = new Image()
  image.alt = ''
  image.decoding = 'async'
  image.addEventListener('error', () => image.remove(), { once: true })
  image.src = src
  return image
}
export function previewArtwork(
  key: string,
  candidate?: HTMLImageElement | null,
) {
  const entry = previews.get(key)
  if (!entry) return null
  const src = entry.detail.backdrop || entry.detail.poster
  if (!src) return null
  if (entry.artwork) return entry.artwork
  const image = createPreviewArtwork(src, candidate)
  entry.artwork = image
  image.addEventListener(
    'error',
    () => {
      if (entry.artwork === image) entry.artwork = null
    },
    { once: true },
  )
  return image
}
