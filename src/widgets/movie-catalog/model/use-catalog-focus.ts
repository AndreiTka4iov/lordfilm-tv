import { useCallback, useEffect, useRef, useState } from 'react'
import type { MoviePreview } from '@/entities/movie'

interface FocusedCard {
  key: string
  movie: MoviePreview
}
export function useCatalogFocus() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState<FocusedCard | null>(null)
  const pendingBlur = useRef<number | undefined>(undefined)
  const select = useCallback((movie: MoviePreview, key: string) => {
    window.clearTimeout(pendingBlur.current)
    pendingBlur.current = undefined
    setFocused((current) =>
      current?.key === key && current.movie === movie
        ? current
        : { key, movie },
    )
  }, [])
  const release = useCallback(
    (stage: HTMLElement, next: EventTarget | null) => {
      window.clearTimeout(pendingBlur.current)
      if (
        next instanceof HTMLElement &&
        stage.contains(next) &&
        next.closest('[data-movie-card]')
      )
        return
      // A missing relatedTarget can be an intermediate blur between remote focus events.
      pendingBlur.current = window.setTimeout(
        () => {
          pendingBlur.current = undefined
          const active = document.activeElement
          if (
            active instanceof HTMLElement &&
            stage.contains(active) &&
            active.closest('[data-movie-card]')
          )
            return
          setFocused(null)
        },
        next === null ? 120 : 0,
      )
    },
    [],
  )
  useEffect(() => {
    if (!focused) return
    const restore = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      )
        return
      if (
        event.target !== document.body &&
        event.target !== document.documentElement
      )
        return
      const card = stageRef.current?.querySelector<HTMLElement>(
        '[data-movie-card][data-focused="true"]',
      )
      if (!card) return
      event.preventDefault()
      event.stopPropagation()
      card.focus({ preventScroll: true })
      card.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: event.key,
          code: event.code,
          repeat: event.repeat,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
    window.addEventListener('keydown', restore, true)
    return () => window.removeEventListener('keydown', restore, true)
  }, [focused])
  useEffect(() => () => window.clearTimeout(pendingBlur.current), [])
  return { focused, select, release, stageRef }
}
