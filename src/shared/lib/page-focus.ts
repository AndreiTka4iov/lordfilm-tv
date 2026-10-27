interface FocusBookmark {
  tag: string
  id: string
  href: string | null
  group: string | null
  label: string
}
const memory = new Map<string, FocusBookmark>()
function pageKey() {
  const params = new URLSearchParams(location.search)
  return `lordfilm:focus:${location.pathname}:${params.get('id') ?? ''}:${params.get('q') ?? ''}`
}
function readBookmark(): FocusBookmark | null {
  const key = pageKey()
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (
        value &&
        typeof value === 'object' &&
        'tag' in value &&
        'id' in value &&
        'href' in value &&
        'group' in value &&
        'label' in value &&
        typeof value.tag === 'string' &&
        typeof value.id === 'string' &&
        (value.href === null || typeof value.href === 'string') &&
        (value.group === null || typeof value.group === 'string') &&
        typeof value.label === 'string'
      )
        return value as FocusBookmark
    }
  } catch {
    /* Storage may be unavailable in the embedded browser. */
  }
  return memory.get(key) ?? null
}
export function rememberPageFocus(target: HTMLElement) {
  if (
    !target.matches('a[href],button,input,select,textarea,[tabindex]') ||
    target.id === 'main-content'
  )
    return
  const bookmark: FocusBookmark = {
    tag: target.tagName,
    id: target.id,
    href: target.getAttribute('href'),
    group:
      target.closest('[data-movie-group]')?.getAttribute('data-movie-group') ??
      null,
    label:
      target.getAttribute('aria-label') ?? target.textContent?.trim() ?? '',
  }
  memory.set(pageKey(), bookmark)
  try {
    sessionStorage.setItem(pageKey(), JSON.stringify(bookmark))
  } catch {
    /* Keep the in-memory bookmark. */
  }
}
export function savedPageFocus(
  root = document.getElementById('main-content'),
): HTMLElement | null {
  const bookmark = readBookmark()
  if (!root || !bookmark) return null
  return (
    Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,textarea,[tabindex]',
      ),
    ).find(
      (node) =>
        !node.matches(':disabled,[hidden]') &&
        node.getClientRects().length > 0 &&
        node.tagName === bookmark.tag &&
        (bookmark.id
          ? node.id === bookmark.id
          : node.getAttribute('href') === bookmark.href &&
            (node
              .closest('[data-movie-group]')
              ?.getAttribute('data-movie-group') ?? null) === bookmark.group &&
            (node.getAttribute('aria-label') ??
              node.textContent?.trim() ??
              '') === bookmark.label),
    ) ?? null
  )
}
export function hasPageFocusBookmark() {
  return readBookmark() !== null
}
