/**
 * Verifica visiva one-shot del cockpit asta primo mercato (piano cockpit, Fase D).
 * Uso: npx tsx scripts/verify-cockpit-asta.ts
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
  await page.waitForTimeout(5000)

  // Setup ordine di chiamata (pre-cockpit): conferma e inizia
  const confirmOrder = page.getByRole('button', { name: /conferma e inizia aste/i })
  if (await confirmOrder.isVisible().catch(() => false)) {
    await confirmOrder.click()
    await page.waitForTimeout(5000)
  }
  await page.screenshot({ path: `${OUT}/08-asta-cockpit.png` })

  // Nomina dalla tabella desktop (vista table): prima riga → PORTA IN ASTA
  const firstRow = page.locator('table tbody tr').first()
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    const porta = page.getByRole('button', { name: /porta in asta/i }).first()
    if (await porta.isVisible().catch(() => false)) {
      await porta.click()
      await page.waitForTimeout(2500)
      const conferma = page.getByRole('button', { name: /^conferma$/i }).first()
      if (await conferma.isVisible().catch(() => false)) {
        await conferma.click()
        await page.waitForTimeout(2000)
      }
      const force = page.getByRole('button', { name: /forza tutti pronti/i }).first()
      if (await force.isVisible().catch(() => false)) {
        await force.click()
        await page.waitForTimeout(3500)
      }
    }
  }
  await page.screenshot({ path: `${OUT}/09-asta-bidding.png` })

  const scrollInfo = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
  console.log('Scroll pagina asta:', JSON.stringify(scrollInfo),
    scrollInfo.scrollHeight <= scrollInfo.clientHeight + 1 ? '→ ZERO SCROLL ✓' : '→ PAGINA SCROLLA ✗')

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
