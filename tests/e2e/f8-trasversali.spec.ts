import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'

/**
 * E2E — F8 trasversali: pagina Storico Movimenti (read-only).
 * Un manager apre /movements e verifica che lo storico mostri i movimenti reali (gli eventi
 * dell'apertura F2 sono presenti → niente empty state). Conferma che la vista trasversale
 * read-only renderizza con dati. Nessuna mutazione → nessun restore.
 *
 * Ambiente atteso (già attivo): Frontend :5174 · API :3003 · DB :5433.
 * Run headed: HEADED=1 SLOWMO=300 npx playwright test f8-trasversali --workers=1
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 300 : 0
const MGR = { email: 'diego@test.it', password: 'Diego2025!' }
const MOVEMENTS_URL = `${BASE}/leagues/${LEAGUE_ID}/movements`

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

test.describe('F8 trasversali — Storico Movimenti (read-only)', () => {
  test.describe.configure({ mode: 'serial', timeout: 90000 })
  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctx: BrowserContext
  let mgr: Page

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    mgr = await ctx.newPage()
  })
  test.afterAll(async () => { await ctx?.close(); await browser?.close() })

  test('1 — la pagina Movimenti mostra lo storico con dati reali', async () => {
    await login(mgr, MGR.email, MGR.password)
    await mgr.goto(MOVEMENTS_URL)
    await expect(mgr.getByRole('heading', { name: /Storico Movimenti/i })).toBeVisible({ timeout: 20000 })
    // Ci sono movimenti reali (apertura F2) → NON deve comparire l'empty state
    await expect(mgr.getByText(/Nessun movimento registrato/i)).toHaveCount(0, { timeout: 10000 })
     
    console.log('[F8] Pagina Storico Movimenti renderizzata con dati (no empty state)')
  })
})
