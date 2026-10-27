'use client'
import { useCallback, useState, type ReactNode } from 'react'
import { Box, Group, Image, Text, Title } from '@mantine/core'
import { useTraySpacing } from '../model/use-tray-spacing'
import type { MoviePreview } from '@/entities/movie'
import { messages } from '@/shared/locales'
import {
  CatalogPreviewContext,
  usePreviewDetail,
} from '../model/catalog-preview'

function Artwork({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <Image
      src={src}
      alt=""
      w="100%"
      h="100%"
      fit="cover"
      decoding="async"
      onError={() => setFailed(true)}
      data-catalog-artwork
    />
  )
}
export function CatalogStage({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<MoviePreview | null>(null)
  const select = useCallback((movie: MoviePreview) => setSelected(movie), [])
  const { trayRef, contentRef, spacing } = useTraySpacing(selected !== null)
  const result = usePreviewDetail(selected)
  const detail = result?.detail
  const artwork = detail?.backdrop || detail?.poster || selected?.poster
  return (
    <CatalogPreviewContext value={select}>
      <div
        data-catalog-stage
        onBlurCapture={(event) => {
          const next = event.relatedTarget
          if (
            !(next instanceof HTMLElement) ||
            !event.currentTarget.contains(next) ||
            !next.closest('[data-movie-card]')
          )
            setSelected(null)
        }}
        className="relative isolate flex h-[calc(100svh-64px)] min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl"
      >
        {selected && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
            >
              {artwork && <Artwork key={artwork} src={artwork} />}
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
                  className="text-[clamp(24px,2.8vw,52px)] leading-[1.12] text-balance"
                >
                  {selected.title}
                </Title>
                <Group gap="md" mt="sm">
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
                  className="max-w-[60ch] text-white/90 leading-relaxed [@media(max-height:700px)]:line-clamp-2"
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
        <div
          data-catalog-tray
          ref={trayRef}
          className={`min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 sm:px-8 lg:px-12 [scrollbar-width:none] ${selected ? 'h-[60%] max-h-[420px] shrink-0' : 'flex-1'}`}
        >
          <Box aria-hidden="true" h={spacing} />
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </CatalogPreviewContext>
  )
}
