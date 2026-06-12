/**
 * Verifica one-shot: fix route pausa asta + FAB controlli admin TEST.
 * Uso: npx tsx scripts/verify-pause-fab.ts
 */
import { chromium } from '@playwright/test'
import * as fs from 'fs'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
const SESSION_ID = 'cmq3g2qvz07saxt0cfywwjfdv'
const OUT = 'tmp-cockpit-verify'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill('pietro@test.it')
  await page.getByLabel(/password/i).fill('Pietro2025!')
  await page.getByRole('button', { name: /accedi/i }).click()
  await page.waitForURL(/\/(dashboard|leagues)/, { timeout: 20000 })

  await page.goto(`${BASE}/leagues/${LEAGUE_ID}/auction/${SESSION_ID}`)
  await page.waitForTimeout(4000)

  // 1) Pausa asta: la risposta non deve più essere 404
  const [pauseRes] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/auctions/pause'), { timeout: 10000 }),
    page.getByTitle('Pausa Asta').click(),
  ])
  console.log('POST /auctions/pause →', pauseRes.status(), await pauseRes.text())

  // 2) FAB controlli test: chiuso di default, si apre on demand
  const fab = page.getByRole('button', { name: /apri controlli admin di test/i })
  console.log('FAB visibile:', await fab.isVisible().catch(() => false))
  console.log('Pannello test nel flusso pagina:', await page.getByText('Controlli Admin (TEST)').isVisible().catch(() => false))
  await fab.click()
  await page.waitForTimeout(500)
  console.log('Pannello aperto dopo click:', await page.getByText('Controlli Admin (TEST)').isVisible().catch(() => false))
  await page.screenshot({ path: `${OUT}/10-fab-aperto.png` })
  await page.getByRole('button', { name: /chiudi controlli admin di test/i }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/11-fab-chiuso.png` })

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
