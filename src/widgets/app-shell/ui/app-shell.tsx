'use client'
import type { ReactNode, KeyboardEvent } from 'react'
import { Container } from '@mantine/core'
import { ToggleColorScheme } from '@/features/toggle-color-scheme'
import { contentFocusTarget, focusSidebar } from '@/shared/lib'
import { messages } from '@/shared/locales'
export function AppShell({
  children,
  sidebar,
  header,
}: {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
}) {
  function returnToMenu(event: KeyboardEvent<HTMLElement>) {
    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowRight') &&
      event.target === event.currentTarget
    ) {
      const first =
        contentFocusTarget() ??
        document.querySelector<HTMLElement>(
          '[data-movie-card][data-catalog-focus]',
        ) ??
        document.querySelector<HTMLElement>('[data-movie-card]')
      if (first) {
        event.preventDefault()
        first.focus()
        first.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      return
    }
    if (event.key === 'ArrowUp' && event.target === event.currentTarget) {
      event.preventDefault()
      document
        .querySelector<HTMLInputElement>('[data-catalog-search]')
        ?.focus({ preventScroll: true })
      return
    }
    if (event.key !== 'ArrowLeft' || event.target !== event.currentTarget)
      return
    event.preventDefault()
    focusSidebar()
  }
  function navigatePreferences(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const target =
        contentFocusTarget() ??
        document.querySelector<HTMLElement>(
          '[data-movie-card][data-catalog-focus]',
        ) ??
        document.getElementById('main-content')
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
      const index = buttons.indexOf(event.target as HTMLButtonElement)
      const next = buttons[index + (event.key === 'ArrowLeft' ? -1 : 1)]
      if (next) next.focus()
      else if (event.key === 'ArrowLeft') focusSidebar()
    }
  }
  return (
    <div className="min-h-screen pl-[108px] transition-[padding-left] duration-200 ease-out has-[[data-sidebar][data-expanded=true]]:pl-[290px] motion-reduce:transition-none sm:pl-[132px] sm:has-[[data-sidebar][data-expanded=true]]:pl-[314px]">
      {sidebar}
      <Container size="xl" px={{ base: 'lg', md: 48 }}>
        {header}
        <main
          id="main-content"
          tabIndex={-1}
          aria-label={messages.navigation.content}
          onKeyDown={returnToMenu}
          className="py-6 outline-none md:py-8"
        >
          {children}
        </main>
        <footer
          onKeyDown={navigatePreferences}
          className="flex items-center justify-end gap-4 py-6"
        >
          <ToggleColorScheme />
        </footer>
      </Container>
    </div>
  )
}
