/**
 * Verifica visiva one-shot del cockpit rubata (piano cockpit P1-P7, Fase D).
 * Login admin → setup ordine → genera tabellone → avvia → screenshot 1440×860.
 * Uso: npx tsx scripts/verify-cockpit-rubata.ts
 * Artefatti in tmp-cockpit-verify/ (non versionati).
 */
import { chromium } from '@playwright/test'
import * as fs from 'fs'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq1a61zj000938rrglhxl7u2'
const OUT = 'tmp-cockpit-verify'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
  const page = await ctx.newPage()

  // Login admin lega
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill('pietro@test.it')
  await page.getByLabel(/password/i).fill('Pietro2025!')
  await page.getByRole('button', { name: /accedi/i }).click()
  await page.waitForURL(/\/(dashboard|leagues)/, { timeout: 20000 })

  await page.goto(`${BASE}/leagues/${LEAGUE_ID}/rubata`)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/01-stato-iniziale.png` })

  // Se siamo nel setup ordine: conferma ordine e genera tabellone
  const confirmOrder = page.getByRole('button', { name: /conferma ordine/i })
  if (await confirmOrder.isVisible().catch(() => false)) {
    await confirmOrder.click()
    await page.waitForTimeout(1500)
    const genBoard = page.getByRole('button', { name: /genera tabellone/i })
    if (await genBoard.isVisible().catch(() => false)) {
      await genBoard.click()
      await page.waitForTimeout(2500)
    }
    await page.screenshot({ path: `${OUT}/02-dopo-setup.png` })
  }

  // Avvia rubata dalla barra admin del cockpit
  const start = page.getByRole('button', { name: /avvia rubata/i }).first()
  if (await start.isVisible().catch(() => false)) {
    await start.click()
    await page.waitForTimeout(3000)
  }

  // READY_CHECK: forza tutti pronti (admin) per arrivare a OFFERING
  for (const label of [/^forza tutti$/i, /\[TEST\] forza tutti pronti/i]) {
    const force = page.getByRole('button', { name: label }).first()
    if (await force.isVisible().catch(() => false)) {
      await force.click()
      await page.waitForTimeout(3000)
      break
    }
  }
  await page.screenshot({ path: `${OUT}/03-cockpit-offering.png` })

  // Simula un'offerta bot per arrivare all'asta al rilancio
  const botToggle = page.getByRole('button', { name: /simula bot/i }).first()
  if (await botToggle.isVisible().catch(() => false)) {
    await botToggle.click()
    await page.waitForTimeout(500)
    const select = page.locator('select').first()
    if (await select.isVisible().catch(() => false)) {
      const options = await select.locator('option').allTextContents()
      console.log('Opzioni bot:', options.join(', '))
      await select.selectOption({ index: 1 }).catch(() => {})
      const simOffer = page.getByRole('button', { name: /simula offerta/i })
      if (await simOffer.isVisible().catch(() => false)) {
        await simOffer.click()
        await page.waitForTimeout(3000)
      }
    }
    // chiudi overlay bot se ancora aperto
    if (await botToggle.isVisible().catch(() => false)) {
      await botToggle.click().catch(() => {})
    }
  }

  // AUCTION_READY_CHECK: forza tutti pronti per far partire l'asta al rilancio
  const forceAuction = page.getByRole('button', { name: /\[TEST\] forza tutti pronti/i }).first()
  if (await forceAuction.isVisible().catch(() => false)) {
    await forceAuction.click()
    await page.waitForTimeout(3500)
  }
  await page.screenshot({ path: `${OUT}/04-cockpit-auction.png` })

  // Tab Attività e Strategie
  const tabAttivita = page.getByRole('tab', { name: /attività/i })
  if (await tabAttivita.isVisible().catch(() => false)) {
    await tabAttivita.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/05-tab-attivita.png` })
  }
  const tabStrategie = page.getByRole('tab', { name: /strategie/i })
  if (await tabStrategie.isVisible().catch(() => false)) {
    await tabStrategie.click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/06-tab-strategie.png` })
  }

  // Verifica zero scroll di pagina (cockpit a viewport bloccata)
  const scrollInfo = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
  console.log('Scroll pagina:', JSON.stringify(scrollInfo),
    scrollInfo.scrollHeight <= scrollInfo.clientHeight + 1 ? '→ ZERO SCROLL ✓' : '→ PAGINA SCROLLA ✗')

  // Asta PM: layout (la fase potrebbe non essere attiva)
  await page.goto(`${BASE}/leagues/${LEAGUE_ID}/auction`)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/07-asta-pm.png` })

  await browser.close()
  console.log(`Screenshot in ${OUT}/`)
}

main().catch(err => { console.error(err); process.exit(1) })
