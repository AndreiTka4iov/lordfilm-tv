import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
test.beforeEach(async ({ page }) => mockCatalog(page))

test('home renders without a theme switch', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1',
  )
  await expect(
    page.getByRole('heading', { name: 'Популярные фильмы' }),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Популярные фильмы' }).getByRole('listitem'),
  ).toHaveCount(20)
  await expect(
    page.getByRole('button', { name: /Светлая тема|Тёмная тема/ }),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

test('unknown route returns 404 and provides a way home', async ({ page }) => {
  const response = await page.goto('/missing-page/')
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', { name: 'Страница не найдена' }),
  ).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Главная' }).click()
  await expect(
    page.getByRole('heading', { name: 'Популярные фильмы' }),
  ).toBeVisible()
})
