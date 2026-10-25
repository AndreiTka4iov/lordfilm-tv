'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Group,
  Image,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconArrowLeft, IconPlayerPlayFilled } from '@tabler/icons-react'
import { messages } from '@/shared/locales'
import { focusSidebar } from '@/shared/lib'
import { useMovieDetail } from '../model/use-movie-detail'

const VideoPlayer = dynamic(
  () => import('@/widgets/video-player').then((module) => module.VideoPlayer),
  { ssr: false },
)

function MovieContent({
  id,
  slug,
  returnHref,
  returnLabel,
}: {
  id: string
  slug: string
  returnHref: string
  returnLabel: string
}) {
  const { state, retry } = useMovieDetail(id, slug)
  const [artworkFailed, setArtworkFailed] = useState(false)
  const [watchRequested, setWatchRequested] = useState(false)
  const watch = useRef<HTMLButtonElement>(null)
  const back = useRef<HTMLAnchorElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    if (document.activeElement?.closest('[data-sidebar], [role=search]')) return
    if (state.status === 'ready') watch.current?.focus({ preventScroll: true })
    else if (state.status === 'error' || state.status === 'not-found')
      back.current?.focus({ preventScroll: true })
  }, [state.status])
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      router.replace(returnHref)
      return
    }
    if (
      !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as HTMLElement
    const aboutButton = root.current?.querySelector<HTMLElement>(
      '[data-about-button]',
    )
    const copy = root.current?.querySelector<HTMLElement>('[data-detail-copy]')
    const retryButton = root.current?.querySelector<HTMLElement>(
      '[data-detail-retry]',
    )
    const focus = (node: HTMLElement | null | undefined) => {
      node?.focus({ preventScroll: true })
      node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    if (event.key === 'ArrowLeft') {
      if (target === aboutButton) focus(watch.current)
      else focusSidebar()
      return
    }
    if (target === copy) {
      if (event.key === 'ArrowDown')
        window.scrollBy({
          top: Math.round(window.innerHeight * 0.6),
          behavior: 'instant',
        })
      else if (event.key === 'ArrowUp') {
        if (copy.getBoundingClientRect().top < 0)
          window.scrollBy({
            top: -Math.round(window.innerHeight * 0.6),
            behavior: 'instant',
          })
        else focus(watch.current ?? back.current)
      }
      return
    }
    if (event.key === 'ArrowRight') {
      if (target === watch.current) focus(aboutButton)
      else if (target === back.current) focus(watch.current ?? retryButton)
      return
    }
    if (event.key === 'ArrowDown') {
      if (target === back.current) focus(watch.current ?? retryButton)
      else focus(copy)
      return
    }
    if (target === back.current)
      focus(document.querySelector<HTMLElement>('[data-catalog-search]'))
    else focus(back.current)
  }
  const m = messages.movie
  return (
    <div
      ref={root}
      onFocusCapture={(event) => {
        if (!root.current?.contains(event.target as Node)) return
        root.current
          ?.querySelector('[data-detail-last-focus]')
          ?.removeAttribute('data-detail-last-focus')
        ;(event.target as HTMLElement).setAttribute(
          'data-detail-last-focus',
          'true',
        )
      }}
      onKeyDown={onKeyDown}
      data-movie-detail
      className="min-w-0 pb-8"
    >
      <Button
        component={Link}
        ref={back}
        href={returnHref}
        prefetch={false}
        variant="subtle"
        radius="xl"
        leftSection={<IconArrowLeft size={20} />}
        mb="xl"
      >
        {returnLabel}
      </Button>
      {state.status === 'loading' ? (
        <div
          aria-label={m.loading}
          aria-busy="true"
          className="grid gap-8 sm:grid-cols-[minmax(144px,240px)_1fr]"
        >
          <Skeleton animate={false} className="aspect-[2/3]" radius="lg" />
          <Stack>
            <Skeleton animate={false} h={48} w="80%" />
            <Skeleton animate={false} h={24} w="45%" />
            <Skeleton animate={false} h={160} mt="lg" />
          </Stack>
        </div>
      ) : state.status !== 'ready' ? (
        <Stack role="status" gap="lg" py="xl" align="flex-start">
          <Title order={1} size="h2">
            {state.status === 'not-found' ? m.notFound : m.error}
          </Title>
          <Text c="dimmed">
            {state.status === 'not-found'
              ? m.notFoundDescription
              : m.errorDescription}
          </Text>
          {state.status === 'error' && (
            <Button onClick={retry} radius="xl" data-detail-retry>
              {messages.retry}
            </Button>
          )}
        </Stack>
      ) : (
        <>
          {watchRequested && (
            <VideoPlayer
              id={id}
              slug={slug}
              title={state.movie.title}
              onClose={() => {
                setWatchRequested(false)
                window.requestAnimationFrame(() =>
                  watch.current?.focus({ preventScroll: true }),
                )
              }}
            />
          )}
          <div
            className="relative isolate min-h-[360px] overflow-visible lg:min-h-[520px]"
            data-movie-hero
          >
            {!watchRequested &&
              !artworkFailed &&
              (state.movie.backdrop || state.movie.poster) && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-3/4 overflow-visible"
                >
                  <Image
                    src={state.movie.backdrop || state.movie.poster || ''}
                    alt=""
                    w="100%"
                    h="100%"
                    fit="cover"
                    decoding="async"
                    onError={() => setArtworkFailed(true)}
                    data-movie-artwork
                  />
                  <div className="absolute inset-0 bg-linear-to-r from-[var(--mantine-color-body)] from-0% via-[var(--mantine-color-body)]/80 via-35% to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-t from-[var(--mantine-color-body)] from-0% via-transparent via-65% to-transparent" />
                </div>
              )}
            <div className="max-w-[min(100%,680px)] py-4 pr-4 sm:max-w-[72%] lg:max-w-[65%] lg:py-10">
              <Title
                order={1}
                className="max-w-3xl text-[clamp(28px,3.4vw,60px)] leading-[1.08] text-balance"
              >
                {state.movie.title}
              </Title>
              <Group
                gap="md"
                mt="lg"
                className="text-[var(--mantine-color-dimmed)]"
              >
                {state.movie.rating !== null && (
                  <Text c="lime" fw={750}>
                    {state.movie.rating.toFixed(1)}
                  </Text>
                )}
                <Text>{state.movie.kind === 'series' ? m.series : m.film}</Text>
                {state.movie.year && <Text>{state.movie.year}</Text>}
                {state.movie.duration && <Text>{state.movie.duration}</Text>}
              </Group>
              {state.movie.genres.length > 0 && (
                <Text mt={8} c="dimmed">
                  {state.movie.genres.join(' · ')}
                </Text>
              )}
              <Group mt="xl" gap="lg">
                <Button
                  ref={watch}
                  onClick={() => setWatchRequested(true)}
                  size="xl"
                  radius="xl"
                  leftSection={<IconPlayerPlayFilled size={22} />}
                  data-watch-button
                  className="border-0 bg-white! px-8 text-black! outline-none transition-transform duration-150 focus:scale-[1.04] focus:outline-solid focus:outline-2 focus:outline-offset-4 focus:outline-accent motion-reduce:transition-none motion-reduce:focus:scale-100"
                >
                  {m.watch}
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  size="lg"
                  radius="xl"
                  onClick={() => {
                    const copy =
                      root.current?.querySelector<HTMLElement>(
                        '[data-detail-copy]',
                      )
                    copy?.focus()
                  }}
                  data-about-button
                >
                  {state.movie.kind === 'series' ? m.aboutSeries : m.about}
                </Button>
              </Group>

              <Text
                mt="xl"
                size="lg"
                lineClamp={3}
                className="max-w-[54ch] leading-relaxed"
              >
                {state.movie.description || m.noDescription}
              </Text>
            </div>
          </div>
          <section
            tabIndex={0}
            data-detail-copy
            aria-label={state.movie.kind === 'series' ? m.aboutSeries : m.about}
            className="mt-10 max-w-5xl rounded-lg outline-none focus:outline-solid focus:outline-2 focus:outline-offset-8 focus:outline-accent"
          >
            <Title order={2} size="h3" mb="md">
              {state.movie.kind === 'series' ? m.aboutSeries : m.about}
            </Title>
            {state.movie.originalTitle && (
              <Text c="dimmed" mb="lg">
                {state.movie.originalTitle}
              </Text>
            )}
            <Text
              size="lg"
              className="max-w-[70ch] whitespace-pre-line leading-relaxed"
            >
              {state.movie.description || m.noDescription}
            </Text>
            <dl className="mt-8 grid gap-5">
              {(
                [
                  [m.directors, state.movie.directors],
                  [m.actors, state.movie.actors],
                  [m.countries, state.movie.countries],
                ] as const
              ).map(
                ([label, names]) =>
                  names.length > 0 && (
                    <div key={label}>
                      <Text component="dt" c="dimmed" size="sm" mb={4}>
                        {label}
                      </Text>
                      <Text component="dd" m={0} className="max-w-[70ch]">
                        {names.join(', ')}
                      </Text>
                    </div>
                  ),
              )}
            </dl>
          </section>
        </>
      )}
    </div>
  )
}
function MovieFromQuery() {
  const query = useSearchParams()
  const id = query.get('id') ?? ''
  const slug = query.get('slug') ?? ''
  const group = query.get('from')
  const searchQuery = (query.get('q') ?? '').trim().slice(0, 200)
  const returnHref =
    group === 'search' && searchQuery.length >= 2
      ? `/search/?q=${encodeURIComponent(searchQuery)}&focus=${encodeURIComponent(id)}`
      : /^\d{1,12}$/.test(id) &&
          ['popular', 'new', 'series'].includes(group ?? '')
        ? `/?shelf=${group}&focus=${id}`
        : '/'
  if (!/^\d{1,12}$/.test(id) || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug))
    return (
      <Stack>
        <Title order={1}>{messages.movie.notFound}</Title>
        <Button component={Link} href="/" prefetch={false} radius="xl">
          {messages.movie.back}
        </Button>
      </Stack>
    )
  return (
    <MovieContent
      key={`${id}/${slug}`}
      id={id}
      slug={slug}
      returnHref={returnHref}
      returnLabel={
        group === 'search' ? messages.movie.backSearch : messages.movie.back
      }
    />
  )
}
export function MovieView() {
  return (
    <Suspense fallback={<Text>{messages.movie.loading}</Text>}>
      <MovieFromQuery />
    </Suspense>
  )
}
