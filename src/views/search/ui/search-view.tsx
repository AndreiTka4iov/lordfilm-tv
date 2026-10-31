'use client'
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Stack, Text, Title } from '@mantine/core'
import {
  MovieCard,
  MovieCardSkeleton,
  useVisiblePosters,
} from '@/entities/movie'
import {
  focusSidebar,
  hasPageFocusBookmark,
  focusCatalogSearch as focusSearch,
  navigateMovieGrid,
} from '@/shared/lib'
import {
  CatalogStage,
  useCatalogPreview,
  catalogFocusKey,
} from '@/widgets/movie-catalog'
import { messages } from '@/shared/locales'
import { useMovieSearch } from '../model/use-movie-search'
function Results({ query }: { query: string }) {
  const { state, retry } = useMovieSearch(query)
  const { select, focusedKey } = useCatalogPreview()
  const { listRef, visible } = useVisiblePosters(state.status === 'ready')
  useEffect(() => {
    if (state.status !== 'ready') return
    const params = new URLSearchParams(window.location.search)
    const bookmark = window.history.state?.searchFocus as
      { id?: string; query?: string } | undefined
    const id =
      params.get('focus') ?? (bookmark?.query === query ? bookmark.id : null)
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
      { ...window.history.state, searchFocus: { id, query } },
      '',
      url,
    )
  }, [state, query, listRef])
  const m = messages.search
  if (state.status === 'error')
    return (
      <Stack role="status" align="flex-start" gap="lg" py="xl">
        <Text>{m.loadError}</Text>
        <Button radius="xl" onClick={retry} data-search-action>
          {messages.retry}
        </Button>
      </Stack>
    )
  if (state.status === 'ready' && !state.result.items.length)
    return (
      <Stack role="status" align="flex-start" gap="md" py="xl">
        <Title order={2} size="h3">
          {m.noResults}
        </Title>
        <Text c="dimmed">{m.refine}</Text>
        <Button
          onClick={focusSearch}
          variant="light"
          radius="xl"
          data-search-action
        >
          {m.edit}
        </Button>
      </Stack>
    )
  return (
    <>
      {state.status === 'ready' && state.result.limited && (
        <Text size="sm" c="dimmed" mb="lg">
          {m.limited}
        </Text>
      )}
      <ul
        ref={listRef}
        aria-label={m.results}
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
                searchFocus: { id: card.dataset.movieId, query },
              },
              '',
              window.location.href,
            )
        }}
        className={`m-0 flex flex-nowrap list-none gap-5 overflow-x-auto overscroll-x-contain py-5 pr-5 ${focusedKey ? 'pl-5' : 'pl-0'} [scrollbar-width:none]`}
      >
        {state.status === 'ready'
          ? state.result.items.map((movie) => (
              <li
                key={movie.id}
                data-poster-id={movie.id}
                className="w-[clamp(112px,16svh,200px)] shrink-0"
              >
                <MovieCard
                  movie={movie}
                  onFocus={() =>
                    select(movie, catalogFocusKey('search', movie))
                  }
                  focused={focusedKey === catalogFocusKey('search', movie)}
                  showPoster={visible.has(movie.id)}
                  href={`/movie/?id=${movie.id}&slug=${encodeURIComponent(movie.slug)}&from=search&q=${encodeURIComponent(query)}`}
                />
              </li>
            ))
          : Array.from({ length: 12 }, (_, index) => (
              <li key={index} className="w-[clamp(112px,16svh,200px)] shrink-0">
                <MovieCardSkeleton />
              </li>
            ))}
      </ul>
    </>
  )
}
function SearchContent() {
  const params = useSearchParams()
  const raw = params.get('q') ?? ''
  const query = raw.trim().replace(/\s+/g, ' ')
  const valid =
    query.length >= 2 &&
    query.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(query)
  useEffect(() => {
    if (
      document.activeElement?.closest('[data-sidebar]') ||
      hasPageFocusBookmark()
    )
      return
    const bookmark = window.history.state?.searchFocus as
      { query?: string } | undefined
    if (!params.get('focus') && bookmark?.query !== query) focusSearch()
  }, [query, params])
  return (
    <div
      data-search-results
      className="min-w-0"
      onKeyDown={(event) => {
        if (!(event.target as HTMLElement).closest('[data-search-action]'))
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
          focusSearch()
        }
      }}
    >
      <Title order={1} className="sr-only">
        {messages.navigation.search}
      </Title>
      {valid ? (
        <CatalogStage key={query} withSearchHeader>
          <Results query={query} />
        </CatalogStage>
      ) : (
        <Text c="dimmed" role="status">
          {raw ? messages.search.tooShort : messages.search.intro}
        </Text>
      )}
    </div>
  )
}
export function SearchView() {
  return (
    <Suspense fallback={<Text>{messages.search.loading}</Text>}>
      <SearchContent />
    </Suspense>
  )
}
