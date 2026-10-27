/** Align once using final focus geometry, independently of the zoom animation. */
export function scrollFocusedBlock(target: HTMLElement) {
  const block = target.closest<HTMLElement>('[data-movie-card]')
    ? (target.closest<HTMLElement>('li') ?? target)
    : target
  const sidebar = document.querySelector<HTMLElement>('[data-sidebar]')
  const inset =
    (sidebar
      ? window.innerHeight - sidebar.getBoundingClientRect().bottom
      : 16) + 24
  const tray = target.closest<HTMLElement>('[data-catalog-tray]')
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth'
  if (!tray)
    block.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant',
    })
  const bounds = block.getBoundingClientRect()
  const focusBounds = target.getBoundingClientRect()
  const style = window.getComputedStyle(target)
  const ring = Math.max(
    0,
    (Number.parseFloat(style.outlineWidth) || 0) +
      (Number.parseFloat(style.outlineOffset) || 0),
  )
  const scale =
    Number.parseFloat(style.getPropertyValue('--movie-focus-scale')) || 1
  const center = (focusBounds.top + focusBounds.bottom) / 2
  const focusTop = center - (target.offsetHeight * scale) / 2 - ring * scale
  const focusBottom = center + (target.offsetHeight * scale) / 2 + ring * scale
  const rect = {
    top: Math.min(bounds.top, focusTop),
    bottom: Math.max(bounds.bottom, focusBottom),
    height:
      Math.max(bounds.bottom, focusBottom) - Math.min(bounds.top, focusTop),
  }
  if (tray) {
    const trayBounds = tray.getBoundingClientRect()
    const bottom = Math.min(window.innerHeight - inset, trayBounds.bottom - 8)
    const offset =
      rect.height > bottom - trayBounds.top - 8
        ? rect.top - trayBounds.top - 8
        : rect.bottom - bottom
    tray.scrollBy({ top: offset, behavior })
    const shelf = target.closest<HTMLElement>('ul')
    if (shelf && shelf.scrollWidth > shelf.clientWidth) {
      const shelfBounds = shelf.getBoundingClientRect()
      const centerX = (focusBounds.left + focusBounds.right) / 2
      const halfWidth = (target.offsetWidth / 2 + ring) * scale
      const left = centerX - halfWidth
      const right = centerX + halfWidth
      shelf.scrollBy({
        left:
          left < shelfBounds.left + 20
            ? left - shelfBounds.left - 20
            : Math.max(0, right - shelfBounds.right + 20),
        behavior,
      })
    }
  } else {
    const offset =
      rect.height > window.innerHeight - inset * 2
        ? rect.top - inset
        : rect.bottom - (window.innerHeight - inset)
    window.scrollBy({ top: offset, behavior: 'instant' })
  }
}
