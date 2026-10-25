'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Modal,
  NativeSelect,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerTrackNext,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import type { Playback } from '@/entities/movie'
import { messages } from '@/shared/locales'
import { usePlayback } from '../model/use-playback'
import { useVideoEngine } from '../model/use-video-engine'

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  const h = Math.floor(seconds / 3600)
  return `${h ? `${h}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
function VideoScreen({
  source,
  title,
  onClose,
  retry,
  select,
}: {
  source: Playback
  title: string
  onClose: () => void
  retry: () => void
  select: (season?: number, episode?: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const {
    playing,
    buffering,
    error,
    time,
    duration,
    levels,
    audios,
    quality,
    audio,
    muted,
    togglePlay,
    seek,
    setLevel,
    setTrack,
    toggleMute,
  } = useVideoEngine(source, videoRef)
  const root = useRef<HTMLDivElement>(null)
  const playButton = useRef<HTMLButtonElement>(null)
  const [controls, setControls] = useState(true)
  const [wake, setWake] = useState(0)
  const m = messages.player
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (
      !playing ||
      error ||
      !controls ||
      root.current !== document.activeElement
    )
      return
    const timer = window.setTimeout(() => setControls(false), 3000)
    return () => window.clearTimeout(timer)
  }, [playing, error, controls, wake])
  useEffect(() => {
    if (error)
      root.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus({ preventScroll: true })
  }, [error])
  function show() {
    setControls(true)
    setWake((value) => value + 1)
  }
  const index = source.episodes.findIndex(
    (episode) => episode.number === source.episode,
  )
  const nextEpisode = source.episodes[index + 1]
  const nextSeason =
    source.seasons[source.seasons.indexOf(source.season ?? -1) + 1]
  const hasNext =
    source.kind === 'series' &&
    (nextEpisode !== undefined || nextSeason !== undefined)
  function next() {
    if (nextEpisode) select(source.season ?? undefined, nextEpisode.number)
    else if (nextSeason) select(nextSeason)
  }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
      event.preventDefault()
      onClose()
      return
    }
    const target = event.target as HTMLElement
    if (
      error &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
      event.preventDefault()
      const buttons = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      )
      const index = buttons.indexOf(target as HTMLButtonElement)
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
      buttons[
        Math.max(0, Math.min(buttons.length - 1, index < 0 ? 0 : index + step))
      ]?.focus({ preventScroll: true })
      return
    }
    if (
      event.key === 'MediaPlayPause' ||
      event.key === ' ' ||
      ((target === root.current || target.tagName === 'VIDEO') &&
        event.key === 'Enter')
    ) {
      event.preventDefault()
      togglePlay()
      show()
      return
    }
    if (event.key === 'MediaPlay' || event.key === 'MediaPause') {
      event.preventDefault()
      if ((event.key === 'MediaPlay') !== playing) togglePlay()
      show()
      return
    }
    if (event.key === 'MediaFastForward' || event.key === 'MediaRewind') {
      event.preventDefault()
      seek(time + (event.key === 'MediaFastForward' ? 10 : -10))
      show()
      return
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    if (target === root.current || target.tagName === 'VIDEO') {
      event.preventDefault()
      show()
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        seek(time + (event.key === 'ArrowRight' ? 10 : -10))
      else
        window.requestAnimationFrame(() =>
          playButton.current?.focus({ preventScroll: true }),
        )
      return
    }
    if (
      target.tagName === 'SELECT' &&
      ['ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    if (
      target.tagName === 'INPUT' &&
      ['ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return
    event.preventDefault()
    show()
    if (event.key === 'ArrowDown') {
      root.current?.focus({ preventScroll: true })
      return
    }
    const nodes = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), input',
      ) ?? [],
    )
    const position = nodes.indexOf(target)
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    nodes[Math.max(0, Math.min(nodes.length - 1, position + step))]?.focus({
      preventScroll: true,
    })
  }
  return (
    <div
      ref={root}
      tabIndex={-1}
      aria-label={m.screen}
      onKeyDown={keys}
      onPointerMove={show}
      onFocusCapture={show}
      data-player-screen
      className="relative h-dvh overflow-hidden bg-black text-white outline-none"
    >
      <video
        ref={videoRef}
        playsInline
        preload="none"
        onClick={() => {
          togglePlay()
          show()
        }}
        onEnded={() => {
          if (hasNext) next()
        }}
        aria-label={title}
        className="h-full w-full object-contain"
      />
      {buffering && !error && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <Loader color="lime" aria-label={m.buffering} />
        </div>
      )}
      {error ? (
        <Stack
          role="alert"
          align="center"
          justify="center"
          gap="lg"
          className="absolute inset-0 bg-black/90 p-8"
        >
          <Text size="xl">{m.error}</Text>
          <Text c="dimmed" ta="center">
            {m.errorDescription}
          </Text>
          <Group>
            <Button onClick={retry} radius="xl">
              {messages.retry}
            </Button>
            <Button onClick={onClose} radius="xl" variant="default">
              {m.back}
            </Button>
          </Group>
        </Stack>
      ) : (
        <div
          data-player-controls
          aria-hidden={!controls}
          inert={!controls}
          className={`absolute inset-0 flex flex-col justify-between bg-linear-to-t from-black/90 via-transparent to-black/60 p-6 transition-opacity duration-150 motion-reduce:transition-none sm:p-8 ${controls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <Group justify="space-between">
            <Button
              onClick={onClose}
              variant="subtle"
              color="gray"
              radius="xl"
              leftSection={<IconArrowLeft size={22} />}
            >
              {m.back}
            </Button>
            <Text lineClamp={1} maw="65%" size="lg" fw={600}>
              {title}
            </Text>
          </Group>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Text size="sm" className="shrink-0 tabular-nums">
                {clock(time)}
              </Text>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={1}
                value={Math.min(time, duration || 1)}
                onChange={(event) => seek(Number(event.currentTarget.value))}
                aria-label={m.seek}
                className="min-w-0 flex-1 accent-[var(--mantine-primary-color-filled)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              />
              <Text size="sm" className="shrink-0 tabular-nums">
                {clock(duration)}
              </Text>
            </div>
            <Group gap="md" align="flex-end">
              <ActionIcon
                ref={playButton}
                onClick={() => {
                  togglePlay()
                  show()
                }}
                aria-label={playing ? m.pause : m.play}
                size={56}
                radius="xl"
                color="lime"
              >
                {playing ? (
                  <IconPlayerPauseFilled size={24} />
                ) : (
                  <IconPlayerPlayFilled size={24} />
                )}
              </ActionIcon>
              <ActionIcon
                onClick={toggleMute}
                aria-label={muted ? m.unmute : m.mute}
                size={48}
                variant="default"
                radius="xl"
              >
                {muted ? <IconVolumeOff size={24} /> : <IconVolume size={24} />}
              </ActionIcon>
              {hasNext && (
                <ActionIcon
                  onClick={next}
                  aria-label={m.next}
                  size={48}
                  radius="xl"
                  variant="default"
                >
                  <IconPlayerTrackNext size={24} />
                </ActionIcon>
              )}
              {levels.length > 0 && (
                <NativeSelect
                  aria-label={m.quality}
                  label={m.quality}
                  value={quality}
                  onChange={(event) => setLevel(event.currentTarget.value)}
                  data={[{ value: '-1', label: m.auto }, ...levels]}
                />
              )}
              {audios.length > 1 && (
                <NativeSelect
                  aria-label={m.audio}
                  label={m.audio}
                  value={audio}
                  onChange={(event) => setTrack(event.currentTarget.value)}
                  data={audios}
                />
              )}
              {source.kind === 'series' && (
                <>
                  <NativeSelect
                    aria-label={m.season}
                    label={m.season}
                    value={String(source.season)}
                    onChange={(event) =>
                      select(Number(event.currentTarget.value))
                    }
                    data={source.seasons.map((season) => ({
                      value: String(season),
                      label: `${m.season} ${season}`,
                    }))}
                  />
                  <NativeSelect
                    aria-label={m.episode}
                    label={m.episode}
                    value={String(source.episode)}
                    onChange={(event) =>
                      select(
                        source.season ?? undefined,
                        Number(event.currentTarget.value),
                      )
                    }
                    data={source.episodes.map((episode) => ({
                      value: String(episode.number),
                      label: `${m.episode} ${episode.number}`,
                    }))}
                  />
                </>
              )}
            </Group>
          </div>
        </div>
      )}
    </div>
  )
}
export function VideoPlayer({
  id,
  slug,
  title,
  onClose,
}: {
  id: string
  slug: string
  title: string
  onClose: () => void
}) {
  useEffect(() => {
    window.addEventListener('lordfilm:pause', onClose)
    return () => window.removeEventListener('lordfilm:pause', onClose)
  }, [onClose])
  const { state, select, retry } = usePlayback(id, slug)
  const m = messages.player
  const statusRoot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state.status === 'error')
      statusRoot.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus({ preventScroll: true })
  }, [state.status])
  return (
    <Modal
      opened
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      closeOnEscape={false}
      returnFocus={false}
      padding={0}
      aria-label={`${m.title}: ${title}`}
      transitionProps={{ duration: 0 }}
      classNames={{ content: 'bg-black! text-white!', body: 'p-0!' }}
    >
      {state.status === 'ready' ? (
        <VideoScreen
          key={state.source.src}
          source={state.source}
          title={title}
          onClose={onClose}
          select={select}
          retry={retry}
        />
      ) : (
        <Stack
          align="center"
          justify="center"
          gap="lg"
          ref={statusRoot}
          className="h-dvh bg-black p-8 text-white"
          onKeyDown={(event) => {
            event.stopPropagation()
            if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
              event.preventDefault()
              onClose()
            } else if (
              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
                event.key,
              )
            ) {
              event.preventDefault()
              const buttons = Array.from(
                statusRoot.current?.querySelectorAll<HTMLButtonElement>(
                  'button',
                ) ?? [],
              )
              const index = buttons.indexOf(event.target as HTMLButtonElement)
              const step =
                event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
              buttons[
                Math.max(0, Math.min(buttons.length - 1, index + step))
              ]?.focus({ preventScroll: true })
            }
          }}
        >
          {state.status === 'loading' ? (
            <>
              <Loader color="lime" />
              <Text role="status">{m.loading}</Text>
            </>
          ) : (
            <>
              <Text role="alert" ta="center">
                {m.unavailable}
              </Text>
              <Button onClick={retry} radius="xl">
                {messages.retry}
              </Button>
            </>
          )}
          <Button onClick={onClose} variant="default" radius="xl">
            {m.back}
          </Button>
        </Stack>
      )}
    </Modal>
  )
}
