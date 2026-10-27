import { expect, test } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'

test.use({ reducedMotion: 'reduce' })
for (const path of ['/', '/series/']) {
  test(`loaded and unloaded thumbnails stay rectangular without focus on ${path}`, async ({
    page,
  }) => {
    await mockCatalog(page)
    await page.goto(path)
    const cards = page.locator('[data-movie-card]')
    await expect(cards.first()).toBeVisible()
    const frame = cards.first().locator('div').first()
    const before = await frame.boundingBox()
    await expect(cards.first().locator('[data-movie-poster]')).toHaveCount(1)
    await cards
      .first()
      .locator('img')
      .evaluate((image) => (image as HTMLImageElement).decode())
    const loaded = await frame.boundingBox()
    expect((loaded?.width ?? 0) / (loaded?.height ?? 1)).toBeCloseTo(2 / 3, 2)
    expect(loaded?.height).toBeCloseTo(before?.height ?? 0, 1)
    await cards.first().focus()
    await expect(cards.first()).toBeFocused()
    await cards.nth(1).focus()
    await expect(cards.first()).not.toBeFocused()
    const rects = await cards.evaluateAll((nodes) =>
      nodes.slice(0, 3).map((node) => {
        const bounds = node.firstElementChild!.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height }
      }),
    )
    for (const rect of rects)
      expect(rect.width / rect.height).toBeCloseTo(2 / 3, 2)
    await page.screenshot({
      path: `/private/tmp/lordfilm-thumbnails-${path === '/' ? 'home' : 'series'}.png`,
    })
  })
}
