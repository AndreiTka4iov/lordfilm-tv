import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'
test.beforeEach(async ({ page }) => mockCatalog(page))

test('home renders and color preference survives reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(
    page.getByRole('heading', { name: 'Популярные фильмы' }),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Популярные фильмы' }).getByRole('listitem'),
  ).toHaveCount(20)
  const toggle = page.getByRole('button', { name: 'Светлая тема' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute(
    'data-mantine-color-scheme',
    'light',
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Тёмная тема' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute(
    'data-mantine-color-scheme',
    'light',
  )
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
