import { expect, test } from '@playwright/test'
import { mockCatalog, mockSearch } from './fixtures/catalog'

test.beforeEach(async ({ page }) => {
  await mockCatalog(page)
  await mockSearch(page)
})
for (const width of [960, 1920]) {
  test(`search uses a single row and catalog preview at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 960 ? 540 : 1080 })
    await page.goto('/search/?q=Тест')
    const cards = page.locator('[data-search-results] [data-movie-card]')
    await expect(cards).toHaveCount(20)
    const rows = await cards.evaluateAll((nodes) =>
      nodes.map((node) => (node.parentElement as HTMLElement).offsetTop),
    )
    expect(new Set(rows).size).toBe(1)
    const heading = page.getByRole('heading', { name: 'Поиск', exact: true })
    expect((await heading.boundingBox())?.height).toBeLessThanOrEqual(1)
    await cards.first().focus()
    const preview = page.locator('[data-catalog-preview]')
    await expect(preview.getByRole('heading')).toHaveText('search фильм 1')
    await expect(preview).toContainText('Описание фильма 1')
    await expect(cards.first()).toBeInViewport({ ratio: 0.99 })
    await page.screenshot({
      path: test.info().outputPath(`search-preview-${width}.png`),
    })
    await cards.last().focus()
    await expect(cards.last()).toBeInViewport({ ratio: 0.99 })
    expect(await page.evaluate(() => scrollY)).toBe(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('searchbox')).toBeFocused()
  })
}
