import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'

test('regular website does not expose Android settings', async ({ page }) => {
  await mockCatalog(page)
  await page.goto('/')
  await expect(page.locator('[data-movie-card]')).toHaveCount(60)
  await expect(
    page.getByRole('button', { name: 'Подключение', exact: true }),
  ).toHaveCount(0)
})
