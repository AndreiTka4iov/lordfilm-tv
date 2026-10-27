'use client'
import { useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react'
import { Container } from '@mantine/core'
import {
  contentFocusTarget,
  focusSidebar,
  focusCatalogSearch,
  scrollFocusedBlock,
} from '@/shared/lib'
import { usePageFocus } from '../model/use-page-focus'
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
  const mainRef = usePageFocus()
  const focusScroll = useRef<number | undefined>(undefined)
  const cancelFocusScroll = () => {
    if (focusScroll.current !== undefined)
      window.cancelAnimationFrame(focusScroll.current)
    focusScroll.current = undefined
  }
  useEffect(
    () => () => {
      if (focusScroll.current !== undefined)
        window.cancelAnimationFrame(focusScroll.current)
    },
    [],
  )
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
      focusCatalogSearch()
      return
    }
    if (event.key !== 'ArrowLeft' || event.target !== event.currentTarget)
      return
    event.preventDefault()
    focusSidebar()
  }
  return (
    <div className="min-h-screen pl-[108px] sm:pl-[132px]">
      {sidebar}
      <Container size="xl" px={{ base: 'lg', md: 48 }}>
        {header}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          aria-label={messages.navigation.content}
          onKeyDown={returnToMenu}
          onKeyDownCapture={cancelFocusScroll}
          onWheelCapture={cancelFocusScroll}
          onFocusCapture={(event) => {
            const main = event.currentTarget
            const target = event.target as HTMLElement
            if (target === main || !main.contains(target)) return
            cancelFocusScroll()
            focusScroll.current = window.requestAnimationFrame(() => {
              focusScroll.current = undefined
              if (target === document.activeElement && main.contains(target))
                scrollFocusedBlock(target)
            })
          }}
          className="py-6 outline-none md:py-8"
        >
          {children}
        </main>
      </Container>
    </div>
  )
}
