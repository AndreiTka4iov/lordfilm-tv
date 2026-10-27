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
  const tray = target.closest<HTMLElement>('[data-catalog-tray]')
  if (tray) {
    const trayBounds = tray.getBoundingClientRect()
    const bottom = Math.min(window.innerHeight - inset, trayBounds.bottom - 8)
    const offset =
      rect.height > bottom - trayBounds.top - 8
        ? rect.top - trayBounds.top - 8
        : rect.bottom - bottom
    tray.scrollBy({ top: offset, behavior: 'instant' })
  } else {
    const offset =
      rect.height > window.innerHeight - inset * 2
        ? rect.top - inset
        : rect.bottom - (window.innerHeight - inset)
    window.scrollBy({ top: offset, behavior: 'instant' })
  }
}
