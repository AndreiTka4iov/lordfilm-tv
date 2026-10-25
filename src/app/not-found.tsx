'use client'

import Link from 'next/link'
import { Button, Container, Stack, Title } from '@mantine/core'
import { messages } from '@/shared/locales'
export default function NotFound() {
  return (
    <Container py="xl">
      <Stack>
        <Title order={1}>{messages.notFound}</Title>
        <Button component={Link} href="/">
          {messages.home}
        </Button>
      </Stack>
    </Container>
  )
}
