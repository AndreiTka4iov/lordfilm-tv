import type { KeyboardEvent } from 'react'
import { focusSidebar } from './tv-focus'
export function focusCatalogSearch() {
  const input =
    document.querySelector<HTMLElement>('[data-catalog-search]') ??
    document.querySelector<HTMLElement>('[data-sidebar] a[href="/search/"]')
  input?.focus({ preventScroll: true })
  input?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
export function navigateMovieGrid(event: KeyboardEvent<HTMLUListElement>) {
  const card = (event.target as HTMLElement).closest<HTMLElement>(
    '[data-movie-card]',
  )
  if (!card) return
  const cards = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-movie-card]'),
  )
  const cells = Array.from(event.currentTarget.children) as HTMLElement[]
  const index = cards.indexOf(card)
  const columns =
    cells.filter((cell) => cell.offsetTop === cells[0]?.offsetTop).length || 1
  const column = index % columns
  let target: HTMLElement | undefined
  if (event.key === 'ArrowLeft') {
    if (column === 0) {
      event.preventDefault()
      event.stopPropagation()
      focusSidebar()
      return
    }
    target = cards[index - 1]
  } else if (event.key === 'ArrowRight') {
    if (column < columns - 1) target = cards[index + 1]
  } else if (event.key === 'ArrowUp') {
    if (index < columns) {
      event.preventDefault()
      event.stopPropagation()
      focusCatalogSearch()
      return
    }
    target = cards[index - columns]
  } else if (event.key === 'ArrowDown') {
    if (Math.floor(index / columns) < Math.floor((cards.length - 1) / columns))
      target = cards[Math.min(cards.length - 1, index + columns)]
  } else if (['Escape', 'GoBack', 'BrowserBack'].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    focusCatalogSearch()
    return
  } else return
  event.preventDefault()
  event.stopPropagation()
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
