'use client'
import { useRef, useEffect, type FocusEvent, type KeyboardEvent } from 'react'
import { Button, Text, Title } from '@mantine/core'
import {
  catalogGroups,
  MovieCard,
  MovieCardSkeleton,
  useVisiblePosters,
  type CatalogGroup,
} from '@/entities/movie'
import { messages } from '@/shared/locales'
import { useMoviePool } from '../model/use-movie-pool'

function navigate(event: KeyboardEvent<HTMLElement>) {
  const card = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-movie-card]',
  )
  const shelf = card?.closest<HTMLElement>('[data-movie-shelf]')
  if (!card || !shelf) return
  const cards = Array.from(
    shelf.querySelectorAll<HTMLElement>('[data-movie-card]'),
  )
  const index = cards.indexOf(card)
  let target: HTMLElement | null | undefined
  if (event.key === 'ArrowRight') target = cards[index + 1]
  else if (event.key === 'ArrowLeft')
    target =
      index > 0
        ? cards[index - 1]
        : document.querySelector<HTMLElement>(
            '[data-sidebar] [aria-current="page"]',
          )
  else if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key))
    target = document.querySelector<HTMLElement>('#main-content')
  else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const shelves = Array.from(
      shelf.parentElement?.querySelectorAll<HTMLElement>(
        '[data-movie-shelf]',
      ) ?? [],
    )
    const adjacent =
      shelves[shelves.indexOf(shelf) + (event.key === 'ArrowDown' ? 1 : -1)]
    const next = adjacent?.querySelectorAll<HTMLElement>('[data-movie-card]')
    target =
      next?.[Math.min(index, next.length - 1)] ??
      adjacent?.querySelector<HTMLElement>('button')
    if (!adjacent && event.key === 'ArrowUp')
      target = document.querySelector<HTMLElement>('[data-catalog-search]')
  } else return
  event.preventDefault()
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'instant',
  })
}
function MovieShelf({ group }: { group: CatalogGroup }) {
  const { state, retry } = useMoviePool(group)
  const { listRef, visible } = useVisiblePosters(state.status === 'ready')
  const title = messages.catalog[group]
  useEffect(() => {
    if (state.status !== 'ready') return
    const query = new URLSearchParams(window.location.search)
    const bookmark = window.history.state?.catalogFocus as
      { id?: string; group?: string } | undefined
    const id = query.get('focus') ?? bookmark?.id
    const selectedGroup = query.get('shelf') ?? bookmark?.group
    if (selectedGroup !== group || !id || !/^\d{1,64}$/.test(id)) return
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-movie-id="${id}"]`,
    )
    card?.focus({ preventScroll: true })
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (card) {
      const url = new URL(window.location.href)
      url.searchParams.delete('focus')
      url.searchParams.delete('shelf')
      window.history.replaceState(
        { ...window.history.state, catalogFocus: { id, group } },
        '',
        url,
      )
    }
  }, [state, group, listRef])
  return (
    <section
      aria-labelledby={`shelf-${group}`}
      aria-busy={state.status === 'loading'}
      data-movie-group={group}
      data-movie-shelf
      className="min-w-0"
    >
      <Title id={`shelf-${group}`} order={2} size="h3" mb="lg" fw={650}>
        {title}
      </Title>
      {state.status === 'error' ? (
        <div
          role="status"
          className="flex min-h-64 flex-col items-start justify-center gap-4"
        >
          <Text c="dimmed">{messages.catalog.loadError}</Text>
          <Button
            variant="light"
            onClick={retry}
            aria-label={`${messages.retry}: ${title}`}
          >
            {messages.retry}
          </Button>
        </div>
      ) : (
        <ul
          ref={listRef}
          aria-label={title}
          onKeyDown={navigate}
          className="-mx-5 my-0 flex scroll-p-5 list-none gap-5 overflow-x-auto overscroll-x-contain px-5 py-5 [scrollbar-width:none]"
        >
          {state.status === 'ready'
            ? state.items.map((movie) => (
                <li
                  key={movie.id}
                  data-poster-id={movie.id}
                  className="w-[clamp(144px,15vw,240px)] shrink-0"
                >
                  <MovieCard
                    movie={movie}
                    showPoster={visible.has(movie.id)}
                    href={`/movie/?id=${movie.id}&slug=${encodeURIComponent(movie.slug)}&from=${group}`}
                  />
                </li>
              ))
            : Array.from({ length: 6 }, (_, index) => (
                <li
                  key={index}
                  className="w-[clamp(144px,15vw,240px)] shrink-0"
                >
                  <MovieCardSkeleton />
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
export function MovieCatalog() {
  const lastCard = useRef<HTMLElement | null>(null)
  function rememberFocus(event: FocusEvent<HTMLDivElement>) {
    const card = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-movie-card]',
    )
    if (!card || card === lastCard.current) return
    lastCard.current?.removeAttribute('data-catalog-focus')
    card.setAttribute('data-catalog-focus', 'true')
    lastCard.current = card
  }
  return (
    <div
      onClickCapture={(event) => {
        const card = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-movie-card]',
        )
        const group =
          card?.closest<HTMLElement>('[data-movie-group]')?.dataset.movieGroup
        if (card && group)
          window.history.replaceState(
            {
              ...window.history.state,
              catalogFocus: { id: card.dataset.movieId, group },
            },
            '',
            window.location.href,
          )
      }}
      onFocusCapture={rememberFocus}
      aria-label={messages.catalog.label}
      className="flex min-w-0 flex-col gap-12"
    >
      {catalogGroups.map((group) => (
        <MovieShelf key={group} group={group} />
      ))}
    </div>
  )
}
