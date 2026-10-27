import { expect, test } from '@playwright/test'
import { mockCatalog, mockSearch } from './fixtures/catalog'
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await mockSearch(page)
  await page.goto('/search/')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await page.clock.install({ time: new Date('2026-10-25T09:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-25T10:00:00Z'))
})
test('only the final query runs after 500 ms of idle input', async ({
  page,
}) => {
  const queries: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/catalog/search?'))
      queries.push(new URL(r.url()).searchParams.get('q') ?? '')
  })
  const input = page.getByRole('searchbox')
  await input.fill('Ин')
  await page.clock.runFor(300)
  await input.fill('Интерстеллар')
  await page.clock.runFor(499)
  expect(queries).toEqual([])
  await page.clock.runFor(1)
  await expect(
    page.getByRole('list', { name: 'Результаты поиска' }).getByRole('listitem'),
  ).toHaveCount(20)
  expect([...new Set(queries)]).toEqual(['Интерстеллар'])
  await expect(input).toHaveValue('Интерстеллар')
  await expect(input).toBeFocused()
})
test('Enter cancels the pending timer and automatic updates replace search history', async ({
  page,
}) => {
  const queries: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/catalog/search?'))
      queries.push(new URL(r.url()).searchParams.get('q') ?? '')
  })
  const input = page.getByRole('searchbox')
  await input.fill('Люпен')
  await page.clock.runFor(200)
  await input.press('Enter')
  await expect(
    page.locator('[data-search-results] [data-movie-card]'),
  ).toHaveCount(20)
  const count = queries.length
  await page.clock.runFor(800)
  expect(queries.length).toBe(count)
  await input.fill('Люпен сериал')
  await page.clock.runFor(500)
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe('Люпен сериал')
  await expect(input).toHaveValue('Люпен сериал')
  await input.fill('Гослинг')
  await page.clock.runFor(500)
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe('Гослинг')
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(input).toHaveValue('')
})
test('short input and leaving the page cancel delayed search', async ({
  page,
}) => {
  const queries: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/catalog/search?'))
      queries.push(new URL(r.url()).searchParams.get('q') ?? '')
  })
  const input = page.getByRole('searchbox')
  await input.fill('Люпен')
  await page.clock.runFor(250)
  await input.fill('я')
  await page.clock.runFor(800)
  expect(queries).toEqual([])
  await input.fill('Отложенный запрос')
  await page.clock.runFor(200)
  await page
    .getByRole('complementary')
    .getByRole('link', { name: 'Фильмы', exact: true })
    .click()
  await expect(page).toHaveURL(/\/movies\/$/)
  await page.clock.runFor(1000)
  expect(queries).toEqual([])
  await expect(input).toHaveCount(0)
})
test('IME composition waits until the text is committed', async ({ page }) => {
  const queries: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/catalog/search?'))
      queries.push(new URL(r.url()).searchParams.get('q') ?? '')
  })
  const input = page.getByRole('searchbox')
  await input.dispatchEvent('compositionstart')
  await input.fill('東京')
  await page.clock.runFor(1000)
  expect(queries).toEqual([])
  await input.dispatchEvent('compositionend')
  await page.clock.runFor(500)
  await expect.poll(() => [...new Set(queries)]).toEqual(['東京'])
  await expect(input).toHaveValue('東京')
})
