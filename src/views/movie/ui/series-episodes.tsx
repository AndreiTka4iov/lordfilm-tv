'use client'
import { useRef, type KeyboardEvent } from 'react'
import { Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconPlayerPlayFilled } from '@tabler/icons-react'
import type { EpisodeSelection } from '@/entities/movie'
import { focusSidebar } from '@/shared/lib'
import { messages } from '@/shared/locales'
import { useSeriesEpisodes } from '../model/use-series-episodes'

export function SeriesEpisodes({
  id,
  slug,
  onSelection,
  onPlay,
  onUp,
  onDown,
}: {
  id: string
  slug: string
  onSelection: (selection: EpisodeSelection) => void
  onPlay: (selection: EpisodeSelection) => void
  onUp: () => void
  onDown: () => void
}) {
  const { state, selectSeason, retry } = useSeriesEpisodes(
    id,
    slug,
    onSelection,
  )
  const root = useRef<HTMLElement>(null)
  const m = messages.seriesDetail
  function focus(node: HTMLElement | null | undefined) {
    node?.focus({ preventScroll: true })
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      onUp()
      return
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as HTMLElement
    const seasons = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        '[data-series-season]',
      ) ?? [],
    )
    const episodes = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        '[data-series-episode]',
      ) ?? [],
    )
    const seasonIndex = seasons.indexOf(target as HTMLButtonElement)
    const selected = seasons.find(
      (node) => node.getAttribute('aria-pressed') === 'true',
    )
    if (seasonIndex >= 0) {
      if (event.key === 'ArrowLeft') {
        if (seasonIndex === 0) focusSidebar()
        else focus(seasons[seasonIndex - 1])
      } else if (event.key === 'ArrowRight') focus(seasons[seasonIndex + 1])
      else if (event.key === 'ArrowUp') onUp()
      else
        focus(
          episodes[0] ??
            root.current?.querySelector<HTMLButtonElement>(
              '[data-series-retry]',
            ) ??
            root.current,
        )
      return
    }
    if (episodes.includes(target as HTMLButtonElement)) {
      const rect = target.getBoundingClientRect()
      const horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key)
      const candidates = episodes
        .filter((node) => {
          if (node === target) return false
          const other = node.getBoundingClientRect()
          if (horizontal && Math.abs(other.top - rect.top) > 2) return false
          if (event.key === 'ArrowLeft') return other.left < rect.left - 2
          if (event.key === 'ArrowRight') return other.left > rect.left + 2
          if (event.key === 'ArrowUp') return other.top < rect.top - 2
          return other.top > rect.top + 2
        })
        .sort((a, b) => {
          const distance = (node: HTMLElement) => {
            const other = node.getBoundingClientRect()
            return horizontal
              ? Math.abs(other.left - rect.left)
              : Math.abs(other.top - rect.top) * 100 +
                  Math.abs(other.left - rect.left)
          }
          return distance(a) - distance(b)
        })
      if (candidates[0]) focus(candidates[0])
      else if (event.key === 'ArrowLeft') focusSidebar()
      else if (event.key === 'ArrowUp') focus(selected)
      else if (event.key === 'ArrowDown') onDown()
      return
    }
    if (event.key === 'ArrowUp') {
      if (selected) focus(selected)
      else onUp()
    } else if (event.key === 'ArrowLeft') focusSidebar()
    else if (event.key === 'ArrowDown') {
      if (episodes[0]) focus(episodes[0])
      else {
        const retryButton = root.current?.querySelector<HTMLButtonElement>(
          '[data-series-retry]',
        )
        if (retryButton && target !== retryButton) focus(retryButton)
        else onDown()
      }
    }
  }
  return (
    <section
      ref={root}
      tabIndex={-1}
      data-series-picker
      aria-labelledby="series-episodes-title"
      onKeyDown={navigate}
      className="mt-8 min-w-0 scroll-mt-8 rounded-lg outline-none focus:outline-solid focus:outline-2 focus:outline-offset-8 focus:outline-accent"
    >
      <Title id="series-episodes-title" order={2} size="h2" mb="lg">
        {m.title}
      </Title>
      {state.seasons.length > 0 && (
        <Group
          role="group"
          aria-label={m.seasons}
          gap="sm"
          wrap="nowrap"
          mb="xl"
          className="overflow-x-auto px-2 py-2"
        >
          {state.seasons.map((season) => (
            <Button
              key={season}
              size="lg"
              radius="xl"
              variant={state.season === season ? 'filled' : 'light'}
              aria-pressed={state.season === season}
              data-series-season={season}
              data-series-entry={state.season === season || undefined}
              className="shrink-0 outline-none focus:outline-solid focus:outline-2 focus:outline-offset-4 focus:outline-accent"
              onClick={() => {
                if (state.season !== season || state.status === 'error')
                  selectSeason(season)
              }}
            >
              {m.season} {season}
            </Button>
          ))}
        </Group>
      )}
      <div aria-busy={state.status === 'loading'} aria-live="polite">
        {state.status === 'loading' ? (
          <Stack gap="md">
            <Text c="dimmed" role="status">
              {m.loading}
            </Text>
            <div
              aria-hidden="true"
              className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
            >
              {[0, 1, 2, 3].map((number) => (
                <Skeleton key={number} h={112} radius="lg" animate={false} />
              ))}
            </div>
          </Stack>
        ) : state.status === 'error' ? (
          <Stack align="flex-start" gap="md" role="status">
            <Text fw={650}>{m.error}</Text>
            <Text c="dimmed">{m.errorDescription}</Text>
            <Button
              radius="xl"
              data-series-retry
              onClick={() => {
                root.current?.focus({ preventScroll: true })
                retry()
              }}
            >
              {messages.retry}
            </Button>
          </Stack>
        ) : state.episodes.length === 0 ? (
          <Text c="dimmed">{m.empty}</Text>
        ) : (
          <div
            role="group"
            aria-label={`${m.episodes} ${state.season}`}
            className="grid grid-cols-2 gap-4 p-2 md:grid-cols-3 xl:grid-cols-4"
          >
            {state.episodes.map((episode) => (
              <Button
                key={`${state.season}/${episode.number}`}
                variant="default"
                radius="lg"
                size="xl"
                data-series-episode={episode.number}
                aria-label={`${m.play}: ${m.season} ${state.season}, ${m.episode} ${episode.number}${episode.title ? `, ${episode.title}` : ''}`}
                onClick={() => {
                  if (state.season !== null)
                    onPlay({ season: state.season, episode: episode.number })
                }}
                className="h-auto! min-h-28 scroll-my-4 items-start px-5 py-5 text-left outline-none focus:outline-solid focus:outline-2 focus:outline-offset-4 focus:outline-accent"
                classNames={{
                  inner: 'w-full justify-between gap-3',
                  label: 'min-w-0 flex-col items-start whitespace-normal',
                }}
                rightSection={
                  <IconPlayerPlayFilled size={20} aria-hidden="true" />
                }
              >
                <Text component="span" size="lg" fw={700}>
                  {m.episode} {episode.number}
                </Text>
                {episode.title && (
                  <Text
                    component="span"
                    size="sm"
                    c="dimmed"
                    mt={6}
                    lineClamp={2}
                  >
                    {episode.title}
                  </Text>
                )}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
