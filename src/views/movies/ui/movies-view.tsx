import { Title } from '@mantine/core'
import { MoviesCatalog } from '@/widgets/movie-catalog'
import { messages } from '@/shared/locales'
export function MoviesView() {
  return (
    <>
      <Title order={1} className="sr-only">
        {messages.navigation.movies}
      </Title>
      <MoviesCatalog />
    </>
  )
}
