import { expect, test } from '@playwright/test'
import { mockCatalog, mockSearch, pool } from './fixtures/catalog'
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await mockSearch(page)
})
test('main search submits real API query and D-pad navigates the grid and sidebar', async ({
  page,
}) => {
  const calls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/catalog/search?')) calls.push(r.url())
  })
  await page.goto('/')
  const input = page.getByRole('searchbox')
  await input.fill(' Люпен ')
  expect(calls.length).toBe(0)
  await input.press('Enter')
  await expect(page).toHaveURL(/\/search\/\?q=/)
  await expect(
    page.getByRole('list', { name: 'Результаты поиска' }).getByRole('listitem'),
  ).toHaveCount(20)
  expect(new URL(calls.at(-1)!).searchParams.get('q')).toBe('Люпен')
  await expect(input).toHaveValue('Люпен')
  await expect(input).toBeFocused()
  await input.press('ArrowDown')
  const cards = page.locator('[data-movie-card]')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  expect(
    await cards.nth(1).evaluate((node) => node === document.activeElement),
  ).toBe(false)
  await page.keyboard.press('ArrowUp')
  await expect(cards.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('complementary')).toHaveAttribute(
    'data-expanded',
    'true',
  )
  await page.keyboard.press('ArrowRight')
  await expect(cards.first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(input).toBeFocused()
})
test('search card returns to the same query and selected result', async ({
  page,
}) => {
  await page.route('**/v1/movies/*/*', (route) =>
    route.fulfill({
      json: {
        ...pool('search').items[1],
        description: 'Описание',
        originalTitle: null,
        duration: null,
        genres: [],
        countries: [],
        directors: [],
        actors: [],
      },
    }),
  )
  await page.goto('/search/?q=Люпен')
  const card = page.locator('[data-movie-card]').nth(1)
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Назад к поиску' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Смотреть', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(card).toBeFocused()
  await expect(page.getByRole('searchbox')).toHaveValue('Люпен')
  await page.keyboard.press('Enter')
  await page.goBack()
  await expect(card).toBeFocused()
})
test('empty, invalid and unavailable search show correct states and retry', async ({
  page,
}) => {
  await page.goto('/search/')
  await expect(
    page.getByText('Введите название фильма или сериала в поле поиска.'),
  ).toBeVisible()
  await page.getByRole('searchbox').fill('я')
  await page.getByRole('searchbox').press('Enter')
  await expect(page.getByRole('banner').getByRole('alert')).toHaveText(
    'Введите от 2 до 200 символов.',
  )
  await page.route('**/v1/catalog/search?*', (route) =>
    route.fulfill({ json: { query: 'empty', items: [], limited: false } }),
  )
  await page.goto('/search/?q=empty')
  await expect(
    page.getByRole('heading', { name: 'Ничего не найдено' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Изменить запрос' }).click()
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.route('**/v1/catalog/search?*', (route) =>
    route.fulfill({ status: 502, json: {} }),
  )
  await page.goto('/search/?q=error')
  await expect(
    page.getByRole('button', { name: 'Попробовать снова' }),
  ).toBeVisible()
  await mockSearch(page)
  await page.getByRole('button', { name: 'Попробовать снова' }).click()
  await expect(page.locator('[data-movie-card]')).toHaveCount(20)
})
test('changing query aborts stale results and images remain bounded', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  const failures: string[] = []
  page.on('requestfailed', (r) => {
    if (r.url().includes('q=slow')) failures.push(r.url())
  })
  await page.route('**/v1/catalog/search?*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    if (query === 'slow')
      await new Promise((resolve) => setTimeout(resolve, 1200))
    await route
      .fulfill({ json: { query, items: pool(query).items, limited: false } })
      .catch(() => {})
  })
  await page.goto('/search/?q=slow')
  const input = page.getByRole('searchbox')
  await input.fill('fast')
  await input.press('Enter')
  await expect(page.locator('[data-movie-card]')).toHaveCount(20)
  await expect(page.locator('[data-movie-card]').first()).toContainText(
    'fast фильм',
  )
  await expect.poll(() => failures.length).toBeGreaterThan(0)
  expect(await page.locator('[data-movie-poster]').count()).toBeLessThan(20)
  await input.press('ArrowDown')
  await expect(page.locator('[data-movie-card]').first()).toBeInViewport()
  await page.keyboard.press('ArrowUp')
  await expect(input).toBeFocused()
  await expect(input).toBeInViewport()
})
