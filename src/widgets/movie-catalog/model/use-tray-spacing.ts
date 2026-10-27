import { useLayoutEffect, useRef, useState } from 'react'

/** Leave enough space above the first row to align its focus frame at the bottom. */
export function useTraySpacing(active: boolean) {
  const trayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [spacing, setSpacing] = useState(0)
  useLayoutEffect(() => {
    const tray = trayRef.current
    const content = contentRef.current
    if (!active || !tray || !content) return
    const measure = () => {
      const card = content.querySelector<HTMLElement>('[data-movie-card]')
      const cell = card?.closest('li')
      if (!card || !cell) return
      const trayBounds = tray.getBoundingClientRect()
      const cardBounds = card.getBoundingClientRect()
      const scale =
        Number.parseFloat(
          getComputedStyle(card).getPropertyValue('--movie-focus-scale'),
        ) || 1
      const center = (cardBounds.top + cardBounds.bottom) / 2
      const bottom = Math.max(
        cell.getBoundingClientRect().bottom,
        center + (card.offsetHeight * scale) / 2 + 6 * scale,
      )
      const sidebar = document.querySelector('[data-sidebar]')
      const screenBottom =
        (sidebar?.getBoundingClientRect().bottom ?? window.innerHeight - 16) -
        24
      const target = Math.min(screenBottom, trayBounds.bottom - 8)
      setSpacing(
        Math.max(
          0,
          Math.round(
            target -
              trayBounds.top -
              (bottom - content.getBoundingClientRect().top),
          ),
        ),
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(tray)
    observer.observe(content)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [active])
  return { trayRef, contentRef, spacing: active ? spacing : 0 }
}
