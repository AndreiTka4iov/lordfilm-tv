import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/android',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
  },
})
