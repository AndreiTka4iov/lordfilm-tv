import { expect, test } from '@playwright/test'
import { mockCatalog, pool } from './fixtures/catalog'

test.beforeEach(async ({ page }) => mockCatalog(page))
for (const path of ['/', '/series/']) {
  test(`transient blur keeps focused state and tray geometry while browsing ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 540 })
    await page.goto(path)
    const cards = page.locator('[data-movie-card]')
    await expect(cards.first()).toBeVisible()
    await cards.first().focus()
    await expect(page.locator('[data-catalog-preview]')).toContainText(
      'Описание фильма 1',
    )
    const expectedHeight =
      (await page.locator('[data-catalog-tray]').boundingBox())?.height ?? 0
    const frames = await cards.evaluateAll(async (nodes) => {
      const samples: {
        height: number
        preview: boolean
        marked: number
        outline: string
      }[] = []
      const record = () => {
        const marked = document.querySelector<HTMLElement>(
          '[data-movie-card][data-focused]',
        )
        samples.push({
          height: document
            .querySelector('[data-catalog-tray]')!
            .getBoundingClientRect().height,
          preview: !!document.querySelector('[data-catalog-preview]'),
          marked: document.querySelectorAll('[data-movie-card][data-focused]')
            .length,
          outline: marked ? getComputedStyle(marked).outlineStyle : '',
        })
      }
      for (let i = 1; i < 5; i++) {
        ;(document.activeElement as HTMLElement).blur()
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        record()
        ;(nodes[i] as HTMLElement).focus({ preventScroll: true })
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        record()
      }
      return samples
    })
    for (const frame of frames) {
      expect(frame.height).toBeCloseTo(expectedHeight, 1)
      expect(frame.preview).toBe(true)
      expect(frame.marked).toBe(1)
      expect(frame.outline).toBe('solid')
    }
    await expect(cards.nth(4)).toBeFocused()
    await expect(cards.nth(4)).toHaveAttribute('data-focused', 'true')
    await expect(page.locator('[data-movie-card][data-focused]')).toHaveCount(1)
    await cards.nth(1).focus()
    await cards.nth(1).evaluate((node) => (node as HTMLElement).blur())
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(2)).toBeFocused()
    await expect(cards.nth(2)).toHaveAttribute('data-focused', 'true')
    expect(
      (await page.locator('[data-catalog-tray]').boundingBox())?.height,
    ).toBeCloseTo(expectedHeight, 1)
    await page.locator('[data-sidebar] a[href="/search/"]').focus()
    await expect(page.locator('[data-catalog-preview]')).toHaveCount(0)
    await expect(page.locator('[data-movie-card][data-focused]')).toHaveCount(0)
  })
}
test('focus state identifies the shelf as well as the movie', async ({
  page,
}) => {
  await page.goto('/')
  const popular = page
    .locator('[data-movie-group="popular"] [data-movie-card]')
    .first()
  const latest = page
    .locator('[data-movie-group="new"] [data-movie-card]')
    .first()
  await popular.focus()
  await expect(popular).toHaveAttribute('data-focused', 'true')
  await popular.press('ArrowDown')
  await expect(latest).toBeFocused()
  await expect(latest).toHaveAttribute('data-focused', 'true')
  await expect(popular).not.toHaveAttribute('data-focused', 'true')
  await expect(page.locator('[data-movie-card][data-focused]')).toHaveCount(1)
})
test('title and description keep their positions when lengths and loading state change', async ({
  page,
}) => {
  await page.route('**/v1/catalog/pools/series', (route) => {
    const data = pool('series')
    data.items[0]!.title = 'Очень длинное название сериала '.repeat(6)
    data.items[1]!.title = 'Кино'
    return route.fulfill({ json: data })
  })
  await page.goto('/series/')
  const cards = page.locator('[data-movie-card]')
  await cards.first().focus()
  await expect(page.locator('[data-catalog-preview]')).toContainText(
    'Описание фильма 1',
  )
  const title = page.locator('[data-catalog-preview] h2')
  const description = page.locator('[data-catalog-description]')
  const before = {
    title: await title.boundingBox(),
    description: await description.boundingBox(),
  }
  await cards.nth(1).focus()
  await expect(title).toHaveText('Кино')
  expect((await title.boundingBox())?.y).toBeCloseTo(before.title?.y ?? 0, 1)
  expect((await description.boundingBox())?.y).toBeCloseTo(
    before.description?.y ?? 0,
    1,
  )
  await expect(description).toContainText('Описание фильма 2')
  expect((await title.boundingBox())?.y).toBeCloseTo(before.title?.y ?? 0, 1)
  expect((await description.boundingBox())?.y).toBeCloseTo(
    before.description?.y ?? 0,
    1,
  )
  await page.screenshot({ path: '/private/tmp/lordfilm-stable-focus-1920.png' })
})

test('focus frame animates between cards and respects reduced motion', async ({
  page,
}) => {
  await page.goto('/series/')
  const cards = page.locator('[data-movie-card]')
  await cards.first().focus()
  await expect(page.locator('[data-catalog-preview]')).toContainText(
    'Описание фильма 1',
  )
  await page.keyboard.press('ArrowRight')
  const frame = cards.nth(1).locator('[data-movie-focus-ring]')
  await expect
    .poll(() => frame.evaluate((node) => node.getAnimations().length))
    .toBe(1)
  await expect
    .poll(() => frame.evaluate((node) => node.getAnimations().length))
    .toBe(0)
  await expect(frame).toHaveCSS('opacity', '1')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.press('ArrowRight')
  await expect(cards.nth(2)).toBeFocused()
  await expect(cards.nth(2).locator('[data-movie-focus-ring]')).toHaveCSS(
    'opacity',
    '1',
  )
  expect(
    await cards
      .nth(2)
      .locator('[data-movie-focus-ring]')
      .evaluate((node) => node.getAnimations().length),
  ).toBe(0)
})
