import { Title } from '@mantine/core'
import { MovieCardSkeleton } from '@/entities/movie'
import { messages } from '@/shared/locales'

const shelves = [
  { id: 'popular', title: messages.catalog.popular },
  { id: 'new', title: messages.catalog.new },
  { id: 'series', title: messages.catalog.series },
] as const
const placeholders = Array.from({ length: 6 }, (_, index) => index)

export function MovieCatalogSkeleton() {
  return (
    <div
      aria-label={messages.catalog.preview}
      className="flex min-w-0 flex-col gap-12"
    >
      {shelves.map((shelf) => (
        <section
          key={shelf.id}
          aria-labelledby={`shelf-${shelf.id}`}
          className="min-w-0"
        >
          <Title id={`shelf-${shelf.id}`} order={2} size="h3" mb="lg" fw={650}>
            {shelf.title}
          </Title>
          <ul
            aria-label={shelf.title}
            className="m-0 flex list-none gap-5 overflow-x-auto overscroll-x-contain p-0 pb-2 [scrollbar-width:none]"
          >
            {placeholders.map((index) => (
              <li key={index} className="w-[clamp(112px,16svh,200px)] shrink-0">
                <MovieCardSkeleton />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
