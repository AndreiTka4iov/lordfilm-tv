import { defineConfig, devices } from '@playwright/test'
const externalUrl = process.env.TEST_BASE_URL
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: externalUrl ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  ...(externalUrl
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --port 3100',
          url: 'http://127.0.0.1:3100',
          reuseExistingServer: false,
          timeout: 120000,
        },
      }),
})
