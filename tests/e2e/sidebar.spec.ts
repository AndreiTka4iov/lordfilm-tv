import { expect, test } from '@playwright/test'

test('remote focus expands the menu, arrows navigate and content restores focus', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const menu = page.getByRole('complementary', { name: 'Главное меню' })
  const home = menu.getByRole('link', { name: 'Главная', exact: true })
  const movies = menu.getByRole('link', { name: 'Фильмы', exact: true })
  const main = page.getByRole('main')
  await expect(menu).toHaveAttribute('data-expanded', 'false')
  const before = await main.boundingBox()
  await main.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(home).toBeFocused()
  await expect(menu).toHaveAttribute('data-expanded', 'true')
  const frames = await main.evaluate(async (node) => {
    const sizes: { x: number; width: number }[] = []
    for (let i = 0; i < 16; i++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      )
      const bounds = node.getBoundingClientRect()
      sizes.push({ x: bounds.x, width: bounds.width })
    }
    return sizes
  })
  for (const bounds of frames) {
    expect(bounds.x).toBeCloseTo(before?.x ?? 0, 1)
    expect(bounds.width).toBeCloseTo(before?.width ?? 0, 1)
  }
  const sidebar = await menu.boundingBox()
  expect((sidebar?.x ?? 0) + (sidebar?.width ?? 0)).toBeGreaterThan(
    before?.x ?? 0,
  )
  await page.keyboard.press('ArrowDown')
  await expect(movies).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/movies\/$/)
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Фильмы')
  await expect(movies).toHaveAttribute('aria-current', 'page')
  await expect(movies).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(main).toBeFocused()
  await expect(menu).toHaveAttribute('data-expanded', 'false')
  await page.keyboard.press('ArrowLeft')
  await expect(movies).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(main).toBeFocused()
  await expect.poll(async () => (await main.boundingBox())?.x).toBe(before?.x)
  await expect
    .poll(async () => (await main.boundingBox())?.width)
    .toBe(before?.width)
})

test('all LordFilm menu items remain reachable on a small TV viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 })
  await page.goto('/', { waitUntil: 'networkidle' })
  const menu = page.getByRole('navigation', { name: 'Главное меню' })
  const items = menu.getByRole('link')
  await expect(items).toHaveCount(12)
  await items.first().focus()
  await page.keyboard.press('ArrowUp')
  await expect(items.first()).toBeFocused()
  for (let index = 1; index < 12; index++)
    await page.keyboard.press('ArrowDown')
  const registration = menu.getByRole('link', { name: 'Регистрация' })
  await expect(registration).toBeFocused()
  await expect(registration).toBeInViewport()
  await page.keyboard.press('ArrowDown')
  await expect(registration).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary')).toHaveAttribute(
    'data-expanded',
    'false',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
