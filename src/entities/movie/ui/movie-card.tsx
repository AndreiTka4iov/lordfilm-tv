'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Badge, Image } from '@mantine/core'
import { IconPhotoOff } from '@tabler/icons-react'
import type { MoviePreview } from '../model/catalog'
import { messages } from '@/shared/locales'

function Poster({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <IconPhotoOff size={32} aria-hidden="true" />
  return (
    <Image
      src={src}
      alt=""
      width={342}
      height={513}
      w="100%"
      h="100%"
      fit="cover"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 object-[center_25%]"
      data-movie-poster
    />
  )
}
export function MovieCard({
  movie,
  showPoster,
  href,
  onFocus,
  focused = false,
}: {
  movie: MoviePreview
  showPoster: boolean
  href: string
  onFocus?: () => void
  focused?: boolean
}) {
  return (
    <Link
      href={href}
      onFocus={onFocus}
      prefetch={false}
      data-movie-id={movie.id}
      aria-label={movie.title}
      data-movie-card
      data-focused={focused || undefined}
      className={`group relative block rounded-xl [--movie-focus-scale:1.04] transition-transform duration-180 ease-out focus:scale-[var(--movie-focus-scale)] motion-reduce:[--movie-focus-scale:1] motion-reduce:transition-none text-inherit no-underline outline-none focus:z-10 focus:outline-solid focus:outline-2 focus:outline-offset-4 focus:outline-transparent ${focused ? 'z-10 scale-[var(--movie-focus-scale)] outline-solid outline-2 outline-offset-4 outline-transparent' : ''}`}
    >
      <span
        aria-hidden="true"
        data-movie-focus-ring
        className={`pointer-events-none absolute -inset-1.5 z-20 origin-top-left rounded-[18px] border-2 border-[var(--mantine-primary-color-filled)] opacity-0 group-focus:opacity-100 ${focused ? 'opacity-100' : ''}`}
      />
      <div className="relative flex aspect-[2/3] w-full min-h-0 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]">
        {showPoster && movie.poster ? (
          <Poster key={movie.poster} src={movie.poster} />
        ) : !movie.poster ? (
          <IconPhotoOff size={32} aria-hidden="true" />
        ) : null}
        {movie.rating !== null && (
          <Badge
            color={movie.rating >= 7 ? 'green' : 'dark'}
            variant="filled"
            radius="sm"
            size="lg"
            aria-label={`${messages.catalog.rating} ${movie.rating.toFixed(1)}`}
            className="absolute! top-3 left-3 tabular-nums"
          >
            {movie.rating.toFixed(1)}
          </Badge>
        )}
      </div>
    </Link>
  )
}
