import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  hasPageFocusBookmark,
  rememberPageFocus,
  savedPageFocus,
} from '@/shared/lib'

export function usePageFocus() {
  const root = useRef<HTMLElement>(null)
  const pathname = usePathname()
  useLayoutEffect(() => {
    const main = root.current
    if (!main) return
    let pending =
      hasPageFocusBookmark() || !!main.querySelector('[data-catalog-stage]')
    let url = location.href
    const restore = () => {
      if (url !== location.href) {
        url = location.href
        pending =
          hasPageFocusBookmark() || !!main.querySelector('[data-catalog-stage]')
      }
      if (
        !pending ||
        document.activeElement?.closest('[data-sidebar], [role=search]')
      )
        return
      const hasBookmark = hasPageFocusBookmark()
      const loading = hasBookmark
        ? main.querySelector('[data-catalog-stage] [aria-busy="true"]') !== null
        : main
            .querySelector('[data-movie-shelf]')
            ?.getAttribute('aria-busy') === 'true'
      const target =
        savedPageFocus(main) ??
        (!loading ? main.querySelector<HTMLElement>('[data-movie-card]') : null)
      if (!target) return
      pending = false
      target.focus({ preventScroll: true })
    }
    const remember = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return
      if (pending && !hasPageFocusBookmark()) pending = false
      if (!pending) rememberPageFocus(event.target)
    }
    const cancel = () => {
      pending = false
    }
    const observer = new MutationObserver(restore)
    observer.observe(main, { childList: true, subtree: true })
    main.addEventListener('focusin', remember)
    document.addEventListener('keydown', cancel, true)
    document.addEventListener('pointerdown', cancel, true)
    restore()
    return () => {
      observer.disconnect()
      main.removeEventListener('focusin', remember)
      document.removeEventListener('keydown', cancel, true)
      document.removeEventListener('pointerdown', cancel, true)
    }
  }, [pathname])
  return root
}
