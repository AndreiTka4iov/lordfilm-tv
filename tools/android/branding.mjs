import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = new URL('../../', import.meta.url)
const source = await readFile(
  new URL('android/branding/tv-banner.svg', root),
  'utf8',
)
const font = await readFile(
  new URL(
    'node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2',
    root,
  ),
)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 320, height: 180 },
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<html><head><style>@font-face{font-family:Onest;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}body{margin:0}</style></head><body>${source}</body></html>`,
  )
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    const text = document.querySelector('#name')
    const group = document.querySelector('#brand')
    const label = text.getBBox()
    text.setAttribute('y', String(-label.y - label.height / 2))
    const bounds = group.getBBox()
    group.setAttribute(
      'transform',
      `translate(${160 - bounds.x - bounds.width / 2} ${90 - bounds.y - bounds.height / 2})`,
    )
  })
  await page.screenshot({
    path: fileURLToPath(
      new URL('android/app/src/main/res/drawable-xhdpi/tv_banner.png', root),
    ),
  })
} finally {
  await browser.close()
}
