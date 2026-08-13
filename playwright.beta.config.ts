import { defineConfig, devices } from '@playwright/test'

/**
 * Config per la smoke suite beta: punta a un'istanza GIÀ attiva
 * (preview Vercel o produzione) tramite E2E_BASE_URL.
 *
 * Differenze rispetto a playwright.config.ts:
 *  - niente `webServer` (il target è già in esecuzione)
 *  - esegue SOLO smoke-beta.spec.ts
 *  - report separato in playwright-report-beta/
 *
 * Lancio (dalla root del progetto):
 *   $env:E2E_BASE_URL="https://<preview>.vercel.app"
 *   $env:E2E_MANAGER_EMAIL="..."
 *   $env:E2E_MANAGER_PASSWORD="..."
 *   $env:E2E_LEAGUE_URL="https://<preview>.vercel.app/leagues/<id>"
 *   npx playwright test --config=playwright.beta.config.ts
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/smoke-beta.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-beta' }]],
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
})
