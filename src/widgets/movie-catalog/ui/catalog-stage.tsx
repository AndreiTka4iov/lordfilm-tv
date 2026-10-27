'use client'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Box, Group, Text, Title } from '@mantine/core'
import { useFocusMotion } from '../model/use-focus-motion'
import { useTraySpacing } from '../model/use-tray-spacing'
import {
  createPreviewArtwork,
  previewArtwork,
  previewCacheKey,
} from '../model/preview-cache'
import { useCatalogFocus } from '../model/use-catalog-focus'
import { catalogGroups } from '@/entities/movie'
import { messages } from '@/shared/locales'
import {
  CatalogPreviewContext,
  usePreviewDetail,
} from '../model/catalog-preview'

function Artwork({
  src,
  cacheKey,
}: {
  src: string
  cacheKey: string | undefined
}) {
  const root = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLImageElement | null>(null)
  useLayoutEffect(() => {
    const container = root.current
    if (!container) return
    const image = cacheKey
      ? previewArtwork(cacheKey, current.current)
      : createPreviewArtwork(src, current.current)
    if (!image) return
    image.className = 'block h-full w-full object-cover'
    image.dataset.catalogArtwork = 'true'
    current.current = image
    container.replaceChildren(image)
    const reveal = () => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        container.animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 220,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        })
    }
    if (image.complete && image.naturalWidth > 0) reveal()
    else image.addEventListener('load', reveal, { once: true })
    return () => {
      image.removeEventListener('load', reveal)
      container.getAnimations().forEach((animation) => animation.cancel())
      if (image.parentElement === container) image.remove()
    }
  }, [src, cacheKey])
  return <div ref={root} className="h-full w-full" />
}
export function CatalogStage({ children }: { children: ReactNode }) {
  const { focused, select, release, stageRef } = useCatalogFocus()
  const selected = focused?.movie ?? null
  const focusedKey = focused?.key ?? null
  useFocusMotion(stageRef, focusedKey)
  const scope = focusedKey?.split(':')[0]
  const group = catalogGroups.find((group) => group === scope)
  const listTitle =
    scope === 'history'
      ? messages.history.title
      : scope === 'series-catalog'
        ? messages.seriesCatalog.list
        : group
          ? messages.catalog[group]
          : null
  const context = useMemo(() => ({ focusedKey, select }), [focusedKey, select])
  const { trayRef, contentRef, spacing } = useTraySpacing(selected !== null)
  const result = usePreviewDetail(selected)
  const detail = result?.detail
  const artwork = detail?.backdrop || detail?.poster || selected?.poster
  const cacheKey = selected
    ? previewCacheKey(selected.id, selected.slug)
    : undefined
  return (
    <CatalogPreviewContext value={context}>
      <div
        data-catalog-stage
        ref={stageRef}
        onBlurCapture={(event) =>
          release(event.currentTarget, event.relatedTarget)
        }
        className="relative isolate flex h-[calc(100svh-64px)] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl"
      >
        {selected && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
            >
              {artwork && (
                <Artwork
                  key={`${cacheKey}:${artwork}`}
                  src={artwork}
                  cacheKey={detail ? cacheKey : undefined}
                />
              )}
              <div className="absolute inset-0 bg-linear-to-r from-black/95 via-black/65 to-black/15" />
              <div className="absolute inset-0 bg-linear-to-t from-[var(--mantine-color-body)] from-25% via-[var(--mantine-color-body)]/60 via-60% to-transparent" />
            </div>
            <section
              data-catalog-preview
              className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden text-white px-5 py-3 sm:px-8 lg:px-12"
            >
              <div className="max-w-[min(100%,720px)]">
                <Title
                  order={2}
                  lineClamp={2}
                  className="h-[2.24em] text-[clamp(24px,2.8vw,52px)] leading-[1.12] text-balance"
                >
                  {selected.title}
                </Title>
                <Group gap="md" mt={8} mih={26}>
                  {selected.rating !== null && (
                    <Text c="lime" fw={750}>
                      {selected.rating.toFixed(1)}
                    </Text>
                  )}
                  {selected.year && (
                    <Text className="text-white/80">{selected.year}</Text>
                  )}
                </Group>
                <Text
                  mt="md"
                  size="lg"
                  lineClamp={3}
                  data-catalog-description
                  className="h-[4.5em] max-w-[60ch] text-white/90 leading-normal [@media(max-height:700px)]:h-[3em] [@media(max-height:700px)]:line-clamp-2"
                >
                  {detail
                    ? detail.description || messages.movie.noDescription
                    : result
                      ? messages.catalog.previewUnavailable
                      : messages.catalog.previewLoading}
                </Text>
              </div>
            </section>
          </>
        )}
        {selected && listTitle && (
          <Title
            data-catalog-list-title
            order={2}
            size="h3"
            fw={650}
            className="shrink-0 px-5 pb-2 sm:px-8 lg:px-12"
          >
            {listTitle}
          </Title>
        )}
        <div
          data-catalog-tray
          ref={trayRef}
          className={`min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 sm:px-8 lg:px-12 [scrollbar-width:none] ${selected ? 'h-[calc(clamp(168px,24svh,300px)+40px)] shrink-0' : 'flex-1'}`}
        >
          <Box aria-hidden="true" h={spacing} />
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </CatalogPreviewContext>
  )
}
