import { contentFocusTarget } from '@/shared/lib'
import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

export function useSidebar() {
  const [expanded, setExpanded] = useState(false)
  const [hint, setHint] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  function leaveMenu() {
    setHint('')
    const target =
      contentFocusTarget() ?? document.getElementById('main-content')
    target?.focus({ preventScroll: true })
  }
  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setExpanded(false)
      setHint('')
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const links = Array.from(
      rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-nav-item]') ??
        [],
    )
    const index = links.findIndex((link) => link === document.activeElement)
    if (
      event.key === 'ArrowRight' ||
      event.key === 'Escape' ||
      event.key === 'GoBack' ||
      event.key === 'BrowserBack'
    ) {
      event.preventDefault()
      leaveMenu()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next =
        index < 0 ? 0 : Math.max(0, Math.min(links.length - 1, index + step))
      links[next]?.focus()
      links[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
    }
  }
  return {
    expanded,
    hint,
    setHint,
    rootRef,
    onBlur,
    onKeyDown,
    onFocus: () => setExpanded(true),
  }
}
