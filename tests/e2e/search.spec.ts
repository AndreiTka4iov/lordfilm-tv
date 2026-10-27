import { expect, test } from '@playwright/test'
import { mockCatalog, mockSearch } from './fixtures/catalog'
test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await mockSearch(page)
})

test('header search opens the query and keeps the brand on the right', async ({
  page,
}) => {
  await page.goto('/search/', { waitUntil: 'networkidle' })
  const search = page.getByRole('searchbox', {
    name: 'Поиск фильмов и сериалов',
  })
  await search.fill('Интерстеллар')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/search\/\?q=/)
  expect(new URL(page.url()).searchParams.get('q')).toBe('Интерстеллар')
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1 }),
  ).toHaveText('Поиск')
  await expect(search).toHaveValue('Интерстеллар')
  const header = page.getByRole('banner')
  const brand = await header
    .getByText('LordFilm TV', { exact: true })
    .boundingBox()
  const field = await search.boundingBox()
  expect(brand?.x).toBeGreaterThan((field?.x ?? 0) + (field?.width ?? 0))
})

test('voice input gives a useful fallback when the browser does not support it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      configurable: true,
    })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      configurable: true,
    })
  })
  await page.goto('/search/', { waitUntil: 'networkidle' })
  await page
    .getByRole('button', { name: 'Голосовой поиск', exact: true })
    .click()
  await expect(page.getByRole('banner').getByRole('status')).toContainText(
    'Голосовой ввод недоступен',
  )
  await expect(page.getByRole('searchbox')).toBeEditable()
})

test('a recognised voice query fills the search field', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult:
        ((event: { results: { transcript: string }[][] }) => void) | null = null
      onerror: ((event: { error: string }) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'Интерстеллар' }]] })
          this.onend?.()
        }, 0)
      }
      stop() {
        this.onend?.()
      }
      abort() {
        this.onend?.()
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      value: Recognition,
      configurable: true,
    })
  })
  await page.goto('/search/', { waitUntil: 'networkidle' })
  await page
    .getByRole('button', { name: 'Голосовой поиск', exact: true })
    .click()
  await expect(page.getByRole('searchbox')).toHaveValue('Интерстеллар')
  await expect(page.getByRole('searchbox')).toBeFocused()
  await expect(page.getByRole('banner').getByRole('status')).toContainText(
    'Запрос распознан',
  )
  await page.getByRole('searchbox').press('Enter')
  await expect(
    page.getByRole('list', { name: 'Результаты поиска' }).getByRole('listitem'),
  ).toHaveCount(20)
})
