import type { Page } from '@playwright/test'
export function pool(group: string) {
  return {
    group,
    generatedAt: '2026-10-25T12:00:00.000Z',
    items: Array.from({ length: 20 }, (_, index) => ({
      id: String(index + 1),
      slug: `movie-${index + 1}`,
      title: `${group} фильм ${index + 1}`,
      year: 2026,
      poster: `https://image.tmdb.org/t/p/w500/test-${group}-${index + 1}.jpg`,
      rating: 8.2,
      kind: group === 'series' ? 'series' : 'movie',
      sourceUrl: `https://example.com/movie/${index + 1}`,
    })),
  }
}
export async function mockCatalog(page: Page) {
  await page.route('**/v1/movies/*/*', (route) => {
    const path = new URL(route.request().url()).pathname.split('/')
    return route.fulfill({
      json: {
        id: path[3],
        slug: path[4],
        title: 'Название фильма',
        kind: 'movie',
        year: 2026,
        rating: 8.2,
        poster: null,
        backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
        description: `Описание фильма ${path[3]}`,
        originalTitle: null,
        duration: null,
        genres: [],
        countries: [],
        directors: [],
        actors: [],
      },
    })
  })
  await page.route('**/v1/catalog/pools/*', (route) =>
    route.fulfill({
      json: pool(
        new URL(route.request().url()).pathname.split('/').at(-1) ?? '',
      ),
    }),
  )
  await page.route('https://image.tmdb.org/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#394637"/></svg>',
    }),
  )
}

export async function mockSearch(page: Page) {
  await page.route('**/v1/catalog/search?*', (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    return route.fulfill({
      json: { query, items: pool('search').items, limited: false },
    })
  })
}
