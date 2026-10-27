/** Resolve current DOM targets on demand; never retain page nodes across routes. */
export function focusSidebar() {
  const target =
    document.querySelector<HTMLElement>(
      '[data-sidebar] [aria-current="page"]',
    ) ??
    document.querySelector<HTMLElement>(
      '[data-sidebar] [data-nav-item][href="/"]',
    ) ??
    document.querySelector<HTMLElement>('[data-sidebar] [data-nav-item]')
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'nearest' })
}
export function contentFocusTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      '[data-movie-detail] [data-detail-last-focus]',
    ) ??
    document.querySelector<HTMLElement>('[data-watch-button]') ??
    document.querySelector<HTMLElement>('[data-movie-detail] a') ??
    document.querySelector<HTMLElement>(
      '[data-series-catalog] [data-catalog-focus]',
    ) ??
    document.querySelector<HTMLElement>(
      '[data-series-catalog] [data-movie-card]',
    ) ??
    document.querySelector<HTMLElement>('[data-series-action]') ??
    document.querySelector<HTMLElement>(
      '[data-search-results] [data-catalog-focus]',
    ) ??
    document.querySelector<HTMLElement>(
      '[data-search-results] [data-movie-card]',
    ) ??
    document.querySelector<HTMLElement>('[data-search-action]') ??
    (document.querySelector('[data-search-results]')
      ? document.querySelector<HTMLElement>('[data-catalog-search]')
      : null)
  )
}
