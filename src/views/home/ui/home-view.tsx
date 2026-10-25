import { Paper, Stack, Text, Title } from '@mantine/core'
import { MovieCatalog } from '@/widgets/movie-catalog'
import type { SectionPath } from '@/shared/config'
import { messages } from '@/shared/locales'
export function HomeView({ section }: { section?: SectionPath }) {
  if (!section)
    return (
      <>
        <Title order={1} className="sr-only">
          {messages.home}
        </Title>
        <MovieCatalog />
      </>
    )
  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Title order={1} className="max-w-3xl text-4xl md:text-6xl">
          {messages.navigation[section]}
        </Title>
        <Text size="lg" c="dimmed" maw={680}>
          {messages.sectionDescription}
        </Text>
      </Stack>
      <Paper withBorder p="xl" mt="xl">
        <Stack gap="xs">
          <Title order={2} size="h3">
            {messages.empty}
          </Title>
          <Text c="dimmed">{messages.emptyDescription}</Text>
        </Stack>
      </Paper>
    </Stack>
  )
}
