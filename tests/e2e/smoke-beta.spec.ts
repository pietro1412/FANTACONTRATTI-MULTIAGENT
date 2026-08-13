import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke suite beta — verifiche di base riproducibili su preview/prod.
 *
 * READ-ONLY: non crea dati. Tutte le credenziali/URL arrivano da env:
 *   E2E_BASE_URL         (es. https://<preview>.vercel.app)  [default localhost:5174]
 *   E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD
 *   E2E_LEAGUE_URL       (es. https://<app>/leagues/<id>)     [opzionale, serve per i test 4-5]
 *
 * Lancio:
 *   npx playwright test smoke-beta --config=playwright.beta.config.ts
 */

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:5174').replace(/\/+$/, '')
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || ''
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || ''
const LEAGUE_URL = (process.env.E2E_LEAGUE_URL || '').replace(/\/+$/, '')

// Login SEMPRE esplicito: l'url può restare sulla route target per un istante
// prima che il guard di auth faccia redirect a /login, quindi non ci si può
// affidare a `page.url()` per decidere se loggare o no.
async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(MANAGER_EMAIL)
  await page.getByLabel(/password/i).fill(MANAGER_PASSWORD)
  await page.getByRole('button', { name: /accedi/i }).click()
  // La landing post-login dipende dal ruolo (manager → dashboard/lega,
  // superadmin → pannello admin): conta solo uscire da /login autenticati.
  await expect(page).toHaveURL((url) => url.pathname !== '/login', { timeout: 20000 })
}

test.beforeEach(() => {
  test.skip(!MANAGER_EMAIL || !MANAGER_PASSWORD, 'Imposta E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD')
})

test('1. Health API risponde ok', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json() as { status: string }
  expect(body.status).toBe('ok')
})

test('2. Pagina di login raggiungibile', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await expect(page.getByLabel(/email o username/i)).toBeVisible({ timeout: 15000 })
})

test('3. Login e accesso autenticato', async ({ page }) => {
  await login(page)
  await expect(page.locator('body')).not.toContainText('errore imprevisto', { timeout: 5000 })
})

test('4. Pagina Contratti carica dentro la lega', async ({ page }) => {
  test.skip(!LEAGUE_URL, 'Imposta E2E_LEAGUE_URL per il test 4')
  await login(page)
  await page.goto(`${LEAGUE_URL}/contracts`)
  await expect(page.getByRole('heading', { name: 'Gestione Contratti' })).toBeVisible({ timeout: 20000 })
  await expect(page.locator('body')).not.toContainText('errore imprevisto')
})

test('5. FeedbackHub carica e permette di aprire il form', async ({ page }) => {
  test.skip(!LEAGUE_URL, 'Imposta E2E_LEAGUE_URL per il test 5')
  await login(page)
  await page.goto(`${LEAGUE_URL}/feedback`)
  await expect(page.getByRole('button', { name: /nuova segnalazione|segnala/i }).first()).toBeVisible({ timeout: 20000 })
  await expect(page.locator('body')).not.toContainText('errore imprevisto')
})

test('6. Logout dal menu profilo', async ({ page }) => {
  await login(page)
  await page.getByTestId('profile-button').click()
  await page.getByTestId('logout-button-dropdown').click({ force: true })
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
})
