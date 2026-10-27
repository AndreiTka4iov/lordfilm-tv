import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
import { mockPlayback } from './fixtures/playback'
const movie = {
  id: '1',
  slug: 'movie-1',
  title: 'Название фильма',
  kind: 'movie',
  year: 2026,
  rating: 8.2,
  poster: 'https://image.tmdb.org/t/p/w500/test.jpg',
  backdrop: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
  description: 'Настоящее описание фильма.',
  originalTitle: 'Original title',
  duration: '2 ч',
  genres: ['Драма'],
  countries: ['США'],
  directors: ['Режиссёр'],
  actors: ['Актёр'],
}
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await mockPlayback(page)
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ json: movie }),
  )
})
test('OK opens movie details and Back restores the selected card', async ({
  page,
}) => {
  await page.goto('/')
  const card = page
    .getByRole('list', { name: 'Популярные фильмы' })
    .locator('[data-movie-card]')
    .first()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/movie\/\?id=1/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(movie.title)
  await expect(page.getByText(movie.description).first()).toBeVisible()
  await expect(page.locator('[data-movie-card]')).toHaveCount(0)
  await expect(page.locator('[data-movie-detail] img')).toHaveCount(1)
  await expect(page.locator('[data-watch-button]')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-detail-copy]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()
  await page.keyboard.press('Enter')
  await page.goBack()
  await expect(card).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const second = page
    .getByRole('list', { name: 'Популярные фильмы' })
    .locator('[data-movie-card]')
    .nth(1)
  await expect(second).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/id=2/)
  await page.goBack()
  await expect(second).toBeFocused()
})
test('direct series page and reload work on a small TV viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({
      json: {
        ...movie,
        kind: 'series',
        title: 'Название сериала',
        poster: null,
      },
    }),
  )
  await page.goto('/movie/?id=1&slug=movie-1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Название сериала',
  )
  await expect(page.getByText('Сериал', { exact: true })).toBeVisible()
  await expect(page.locator('[data-watch-button]')).toBeFocused()
  await expect(page.locator('[data-watch-button]')).toBeInViewport()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Название сериала',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
test('detail errors support retry and unknown or invalid ids show not found', async ({
  page,
}) => {
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ status: 502, json: {} }),
  )
  await page.goto('/movie/?id=1&slug=movie-1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Не удалось загрузить фильм',
  )
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ json: movie }),
  )
  await page.getByRole('button', { name: 'Попробовать снова' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(movie.title)
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({ status: 404, json: {} }),
  )
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Фильм не найден',
  )
  await page.goto('/movie/?id=invalid&slug=../bad')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Фильм не найден',
  )
})

test('watch has initial focus and remote arrows reach details and back', async ({
  page,
}) => {
  await page.goto('/movie/?id=1&slug=movie-1')
  const watch = page.locator('[data-watch-button]')
  await expect(watch).toBeFocused()
  await expect(page.locator('[data-movie-artwork]')).toHaveAttribute(
    'src',
    /\/w780\//,
  )
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(watch).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('button', { name: 'О фильме', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(watch).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(
    page.getByRole('link', { name: 'Назад к каталогу' }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(watch).toBeFocused()
})

test('detail remote opens sidebar and restores the exact content focus', async ({
  page,
}) => {
  await page.goto('/movie/?id=1&slug=movie-1')
  const watch = page.locator('[data-watch-button]')
  const menu = page.getByRole('complementary', { name: 'Главное меню' })
  const home = menu.getByRole('link', { name: 'Главная', exact: true })
  await expect(watch).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(home).toBeFocused()
  await expect(menu).toHaveAttribute('data-expanded', 'true')
  await page.keyboard.press('ArrowRight')
  await expect(watch).toBeFocused()
  await expect(menu).toHaveAttribute('data-expanded', 'false')
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('button', { name: 'О фильме', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const copy = page.locator('[data-detail-copy]')
  await expect(copy).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(home).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(copy).toBeFocused()
  await expect(page).toHaveURL(/\/movie\//)
  await page.getByRole('link', { name: 'Назад к каталогу' }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(home).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('link', { name: 'Назад к каталогу' }),
  ).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-sidebar] a[href="/search/"]')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(home).toBeFocused()
})

test('description scrolls with remote and returns up to watch without a trap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({
      json: { ...movie, description: 'Длинное описание фильма. '.repeat(150) },
    }),
  )
  await page.goto('/movie/?id=1&slug=movie-1')
  const watch = page.locator('[data-watch-button]')
  await expect(watch).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const copy = page.locator('[data-detail-copy]')
  await expect(copy).toBeFocused()
  const before = await page.evaluate(() => scrollY)
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  for (let i = 0; i < 20; i++) {
    if (await watch.evaluate((node) => node === document.activeElement)) break
    await page.keyboard.press('ArrowUp')
  }
  await expect(watch).toBeFocused()
  await expect(watch).toBeInViewport()
})

test('late detail response does not steal focus from the sidebar', async ({
  page,
}) => {
  await page.route('**/v1/movies/*/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({ json: movie })
  })
  await page.goto('/movie/?id=1&slug=movie-1')
  const main = page.getByRole('main')
  await main.focus()
  await page.keyboard.press('ArrowLeft')
  const menu = page.getByRole('complementary', { name: 'Главное меню' })
  await expect(
    menu.getByRole('link', { name: 'Главная', exact: true }),
  ).toBeFocused()
  await expect(page.locator('[data-watch-button]')).toBeAttached()
  await expect(menu).toHaveAttribute('data-expanded', 'true')
  await expect(
    menu.getByRole('link', { name: 'Главная', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-watch-button]')).toBeFocused()
})
