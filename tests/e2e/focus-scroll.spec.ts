import { expect, test, type Page } from '@playwright/test'
import { mockCatalog } from './fixtures/catalog'

test.use({ reducedMotion: 'reduce' })
async function expectBottomInset(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const focused = document.activeElement as HTMLElement
        const block = focused.closest('[data-movie-card]')
          ? focused.closest('li')
          : focused
        const sidebar = document.querySelector('[data-sidebar]')
        const style = getComputedStyle(focused)
        const ring = Math.max(
          0,
          (parseFloat(style.outlineWidth) || 0) +
            (parseFloat(style.outlineOffset) || 0),
        )
        const bottom = Math.max(
          block?.getBoundingClientRect().bottom ?? 0,
          focused.getBoundingClientRect().bottom + ring,
        )
        const gap = (sidebar?.getBoundingClientRect().bottom ?? 0) - 24 - bottom
        return Math.abs(gap)
      }),
    )
    .toBeLessThan(1)
}
for (const width of [960, 1920]) {
  test(`focused shelves and grid rows align with navbar bottom at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 960 ? 540 : 1080 })
    await mockCatalog(page)
    await page.goto('/')
    const first = page.locator('[data-movie-shelf] [data-movie-card]').first()
    await expect(first).toBeVisible()
    await first.focus()
    await expectBottomInset(page)
    await page.screenshot({
      path: test.info().outputPath(`lordfilm-first-row-${width}.png`),
    })
    await first.press('ArrowDown')
    await expectBottomInset(page)
    await page.keyboard.press('ArrowRight')
    await expectBottomInset(page)
    await page.keyboard.press('ArrowDown')
    await expectBottomInset(page)
    await page.keyboard.press('ArrowUp')
    await expectBottomInset(page)
    await page.goto('/series/')
    const cards = page.locator('[data-series-catalog] [data-movie-card]')
    await expect(cards).toHaveCount(20)
    await cards.first().focus()
    await expectBottomInset(page)
    await cards.last().focus()
    await expectBottomInset(page)
    await page.keyboard.press('ArrowUp')
    await expectBottomInset(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`lordfilm-focus-bottom-${width}.png`),
    })
  })
}

test.describe('animated card focus', () => {
  test.use({ reducedMotion: 'no-preference' })
  test('zoom finishes above navbar without a second scroll', async ({
    page,
  }) => {
    await mockCatalog(page)
    await page.setViewportSize({ width: 960, height: 540 })
    await page.goto('/')
    const card = page
      .locator('[data-movie-shelf]')
      .nth(1)
      .locator('[data-movie-card]')
      .first()
    await expect(card).toBeVisible()
    const initial = await card.boundingBox()
    await card.focus()
    const positions = await page.evaluate(async () => {
      const values: number[] = []
      for (let i = 0; i < 24; i++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        values.push(scrollY)
      }
      return values
    })
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(
      1,
    )
    expect((await card.boundingBox())?.width).toBeCloseTo(
      (initial?.width ?? 0) * 1.04,
      1,
    )
    const gap = await card.evaluate((node) => {
      const style = getComputedStyle(node)
      const ring =
        (parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)) *
        1.04
      return (
        (document.querySelector('[data-sidebar]')?.getBoundingClientRect()
          .bottom ?? 0) -
        node.getBoundingClientRect().bottom -
        ring
      )
    })
    expect(gap).toBeCloseTo(24, 0)
    await page.screenshot({
      path: test.info().outputPath('lordfilm-zoom-inset-960.png'),
    })
  })
})
