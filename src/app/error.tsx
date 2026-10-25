'use client'
import { Button, Container, Stack, Title } from '@mantine/core'
import { messages } from '@/shared/locales'
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Container py="xl">
      <Stack>
        <Title order={1}>{messages.error}</Title>
        <Button onClick={reset}>{messages.retry}</Button>
      </Stack>
    </Container>
  )
}
