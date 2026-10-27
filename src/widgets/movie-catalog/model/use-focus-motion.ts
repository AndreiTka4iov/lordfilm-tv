import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Move the new card's frame from the previous selection without moving either card. */
export function useFocusMotion(
  root: RefObject<HTMLDivElement | null>,
  focusedKey: string | null,
) {
  const interrupted = useRef<DOMRect | null>(null)
  const previous = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const card = root.current?.querySelector<HTMLElement>(
      '[data-movie-card][data-focused="true"]',
    )
    const from = previous.current
    previous.current = card ?? null
    if (!card) interrupted.current = null
    if (
      !card ||
      !from?.isConnected ||
      from === card ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const frame = card.querySelector<HTMLElement>('[data-movie-focus-ring]')
    if (!frame) return
    const start =
      interrupted.current ??
      (
        from.querySelector('[data-movie-focus-ring]') ?? from
      ).getBoundingClientRect()
    interrupted.current = null
    const end = frame.getBoundingClientRect()
    const animation = frame.animate(
      [
        {
          transform: `translate(${start.x - end.x}px, ${start.y - end.y}px) scale(${start.width / end.width}, ${start.height / end.height})`,
        },
        { transform: 'translate(0, 0) scale(1)' },
      ],
      { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
    return () => {
      interrupted.current =
        animation.playState === 'running' ? frame.getBoundingClientRect() : null
      animation.cancel()
    }
  }, [root, focusedKey])
}
