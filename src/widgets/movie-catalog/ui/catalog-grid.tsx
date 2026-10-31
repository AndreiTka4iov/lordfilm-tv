'use client'
import { useEffect } from 'react'
import { Button, Stack, Text } from '@mantine/core'
import {
  MovieCard,
  MovieCardSkeleton,
  useVisiblePosters,
} from '@/entities/movie'
import {
  focusSidebar,
  focusCatalogSearch,
  navigateMovieGrid,
} from '@/shared/lib'
import { messages } from '@/shared/locales'
import { CatalogStage } from './catalog-stage'
import { catalogFocusKey, useCatalogPreview } from '../model/catalog-preview'
import { useMoviePool } from '../model/use-movie-pool'

function CatalogGridContent({ group }: { group: 'series' | 'movies' }) {
  const labels =
    group === 'series' ? messages.seriesCatalog : messages.moviesCatalog
  const historyKey =
    group === 'series' ? 'seriesCatalogFocus' : 'moviesCatalogFocus'
  const scope = `${group}-catalog`
  const { state, retry } = useMoviePool(group)
  const { select: preview, focusedKey } = useCatalogPreview()
  const { listRef, visible } = useVisiblePosters(state.status === 'ready')
  useEffect(() => {
    if (state.status !== 'ready') return
    const params = new URLSearchParams(window.location.search)
    const bookmark = window.history.state?.[historyKey] as
      { id?: string } | undefined
    const id = params.get('focus') ?? bookmark?.id
    if (
      !id ||
      !/^\d{1,12}$/.test(id) ||
      document.activeElement?.closest('[data-sidebar], [role=search]')
    )
      return
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-movie-id="${id}"]`,
    )
    if (!card) return
    card.focus({ preventScroll: true })
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const url = new URL(window.location.href)
    url.searchParams.delete('focus')
    window.history.replaceState(
      { ...window.history.state, [historyKey]: { id } },
      '',
      url,
    )
  }, [state, listRef, historyKey])
  return (
    <div
      data-series-catalog={group === 'series' ? '' : undefined}
      data-movies-catalog={group === 'movies' ? '' : undefined}
      className="min-w-0"
      onKeyDown={(event) => {
        if (
          !(event.target as HTMLElement).closest(
            '[data-series-action], [data-movies-action]',
          )
        )
          return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          event.stopPropagation()
          focusSidebar()
        } else if (
          ['ArrowUp', 'Escape', 'GoBack', 'BrowserBack'].includes(event.key)
        ) {
          event.preventDefault()
          event.stopPropagation()
          focusCatalogSearch()
        }
      }}
    >
      {state.status === 'error' ? (
        <Stack role="status" align="flex-start" gap="lg" py="xl">
          <Text>{labels.error}</Text>
          <Button
            radius="xl"
            data-series-action={group === 'series' ? '' : undefined}
            data-movies-action={group === 'movies' ? '' : undefined}
            onClick={() => {
              document
                .getElementById('main-content')
                ?.focus({ preventScroll: true })
              retry()
            }}
          >
            {messages.retry}
          </Button>
        </Stack>
      ) : (
        <>
          <Text className="sr-only" role="status">
            {state.status === 'ready'
              ? `${labels.selection}: ${state.items.length}`
              : labels.loading}
          </Text>
          <ul
            ref={listRef}
            aria-label={labels.list}
            aria-busy={state.status === 'loading'}
            onKeyDown={navigateMovieGrid}
            onFocusCapture={(event) => {
              const card = (event.target as HTMLElement).closest<HTMLElement>(
                '[data-movie-card]',
              )
              if (!card) return
              listRef.current
                ?.querySelector('[data-catalog-focus]')
                ?.removeAttribute('data-catalog-focus')
              card.setAttribute('data-catalog-focus', 'true')
            }}
            onClickCapture={(event) => {
              const card = (event.target as HTMLElement).closest<HTMLElement>(
                '[data-movie-card]',
              )
              if (card)
                window.history.replaceState(
                  {
                    ...window.history.state,
                    [historyKey]: { id: card.dataset.movieId },
                  },
                  '',
                  window.location.href,
                )
            }}
            className="m-0 grid list-none [&_[data-movie-card]]:scroll-my-4 grid-cols-[repeat(auto-fill,minmax(0,clamp(112px,16svh,200px)))] justify-between gap-x-6 gap-y-10 p-4"
          >
            {state.status === 'ready'
              ? state.items.map((movie) => (
                  <li key={movie.id} data-poster-id={movie.id}>
                    <MovieCard
                      movie={movie}
                      onFocus={() =>
                        preview(movie, catalogFocusKey(scope, movie))
                      }
                      focused={focusedKey === catalogFocusKey(scope, movie)}
                      showPoster={visible.has(movie.id)}
                      href={`/movie/?id=${movie.id}&slug=${encodeURIComponent(movie.slug)}&from=${scope}`}
                    />
                  </li>
                ))
              : Array.from({ length: 12 }, (_, index) => (
                  <li key={index}>
                    <MovieCardSkeleton />
                  </li>
                ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CatalogGrid({ group }: { group: 'series' | 'movies' }) {
  return (
    <CatalogStage>
      <CatalogGridContent group={group} />
    </CatalogStage>
  )
}

export function SeriesCatalog() {
  return <CatalogGrid group="series" />
}
export function MoviesCatalog() {
  return <CatalogGrid group="movies" />
}
