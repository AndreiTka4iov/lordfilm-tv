import { Title } from '@mantine/core'
import { SeriesCatalog } from '@/widgets/movie-catalog'
import { messages } from '@/shared/locales'

export function SeriesView() {
  return (
    <>
      <Title order={1} className="sr-only">
        {messages.navigation.series}
      </Title>
      <SeriesCatalog />
    </>
  )
}
