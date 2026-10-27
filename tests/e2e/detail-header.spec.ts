import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
const movie = {
  id: '1',
  slug: 'movie-1',
  title: 'Название фильма',
  kind: 'movie',
  year: 2026,
  rating: 8.2,
  poster: null,
  backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
  description: 'Краткое описание для просмотра.',
  originalTitle: null,
  duration: null,
  genres: [],
  countries: [],
  directors: [],
  actors: [],
}
for (const kind of ['movie', 'series']) {
  test(`${kind} detail has artwork, title, description and rating without global search`, async ({
    page,
  }) => {
    await mockCatalog(page)
    await page.route('**/v1/movies/*/*', (route) =>
      route.fulfill({ json: { ...movie, kind } }),
    )
    await page.goto('/movie/?id=1&slug=movie-1')
    const hero = page.locator('[data-movie-hero]')
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText(
      movie.title,
    )
    await expect(hero).toContainText(movie.description)
    await expect(hero).toContainText('8.2')
    await expect(hero.locator('[data-movie-artwork]')).toHaveCount(1)
    await expect(page.getByRole('banner')).toHaveCount(0)
    await expect(page.getByRole('searchbox')).toHaveCount(0)
    await page.setViewportSize({ width: 960, height: 540 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`lordfilm-detail-hero-${kind}-960.png`),
    })
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.screenshot({
      path: test.info().outputPath(`lordfilm-detail-hero-${kind}-1920.png`),
    })
  })
}
test('search is available only on its own route', async ({ page }) => {
  await mockCatalog(page)
  for (const route of ['/', '/series/', '/movies/']) {
    await page.goto(route)
    await expect(page.getByRole('searchbox')).toHaveCount(0)
    await expect(page.getByRole('banner')).toHaveCount(0)
  }
  await page.locator('[data-sidebar] a[href="/search/"]').click()
  await expect(page.getByRole('searchbox')).toBeVisible()
})
