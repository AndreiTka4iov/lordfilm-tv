'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Image, Text } from '@mantine/core'
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
      data-movie-poster
    />
  )
}
export function MovieCard({
  movie,
  showPoster,
  href,
}: {
  movie: MoviePreview
  showPoster: boolean
  href: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-movie-id={movie.id}
      aria-label={movie.title}
      data-movie-card
      className="relative block rounded-xl text-inherit no-underline outline-none transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:z-10 focus:scale-[1.04] focus:outline-solid focus:outline-2 focus:outline-offset-4 focus:outline-[var(--mantine-primary-color-filled)] motion-reduce:transition-none motion-reduce:focus:scale-100"
    >
      <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-xl bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]">
        {showPoster && movie.poster ? (
          <Poster key={movie.poster} src={movie.poster} />
        ) : !movie.poster ? (
          <IconPhotoOff size={32} aria-hidden="true" />
        ) : null}
      </div>
      <Text mt="sm" fw={600} lineClamp={2} className="min-h-[3em]">
        {movie.title}
      </Text>
      <Text mt={4} size="sm" c="dimmed">
        {movie.year ?? messages.catalog.yearUnknown}
        {movie.rating !== null
          ? ` · ${messages.catalog.rating} ${movie.rating.toFixed(1)}`
          : ''}
      </Text>
    </Link>
  )
}
