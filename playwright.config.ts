import { defineConfig, devices } from '@playwright/test'

// Il client dev di QUESTO progetto gira su :5174 (la 5173 è occupata da un altro
// progetto e Vite non fa fallback — vedi CLAUDE.md §Dev server). Gli spec f1-f8
// leggono già E2E_BASE_URL per conto loro: qui si usa la stessa env per gli spec
// generici (auth, home, league-navigation) che si affidano al fixture `page`.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bash scripts/with-env.sh .env.local npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
