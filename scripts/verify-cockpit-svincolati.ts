/**
 * Verifica visiva one-shot del cockpit svincolati (Fase 3.2).
 * Prerequisito: lega in fase SVINCOLATI. Uso: npx tsx scripts/verify-cockpit-svincolati.ts
 */
import { chromium } from '@playwright/test'
import * as fs from 'fs'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'
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

  await page.goto(`${BASE}/leagues/${LEAGUE_ID}/svincolati`)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${OUT}/sv-01-arrivo.png` })

  // SETUP ordine turni → conferma
  const confirm = page.getByRole('button', { name: /conferma e inizia aste/i })
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click()
    await page.waitForTimeout(4000)
  }
  await page.screenshot({ path: `${OUT}/sv-02-dopo-setup.png` })

  const scroll = async (label: string) => {
    const s = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }))
    console.log(label, JSON.stringify(s), s.sh <= s.ch + 1 ? '→ ZERO SCROLL ✓' : '→ SCROLL ✗')
  }
  await scroll('dopo-setup')

  // Apri il FAB test per pilotare il flusso
  const openFab = page.getByRole('button', { name: /apri controlli admin di test/i })
  if (await openFab.isVisible().catch(() => false)) {
    await openFab.click()
    await page.waitForTimeout(500)
    // Simula scelta giocatore (bot nominate) — richiede READY_CHECK
    const botNom = page.getByRole('button', { name: /simula scelta giocatore/i })
    if (await botNom.isEnabled().catch(() => false)) {
      await botNom.click()
      await page.waitForTimeout(3000)
    }
    // Simula conferma scelta
    const botConf = page.getByRole('button', { name: /simula conferma scelta/i })
    if (await botConf.isEnabled().catch(() => false)) {
      await botConf.click()
      await page.waitForTimeout(2500)
    }
    // Forza tutti pronti → parte l'asta
    const forceReady = page.getByRole('button', { name: /forza tutti pronti/i })
    if (await forceReady.isEnabled().catch(() => false)) {
      await forceReady.click()
      await page.waitForTimeout(3500)
    }
    // chiudi il FAB
    const closeFab = page.getByRole('button', { name: /chiudi controlli admin di test/i })
    if (await closeFab.isVisible().catch(() => false)) await closeFab.click()
  }
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/sv-03-cockpit.png` })
  await scroll('cockpit')

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
