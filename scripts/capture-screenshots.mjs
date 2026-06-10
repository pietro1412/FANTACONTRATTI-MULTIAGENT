import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5174'
const OUT = process.env.SHOT_DIR || 'C:/Users/39349/AppData/Local/Temp/fanta-shots'
mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log('[shot]', ...a)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => log('PAGEERROR:', e.message))

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  log('saved', name)
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)

  // Login: first text/email input + password
  const userField = page.locator('input').filter({ hasNot: page.locator('[type="password"]') }).first()
  await userField.fill('pietro@test.it')
  await page.locator('input[type="password"]').first().fill('Pietro2025!')
  await page.getByRole('button', { name: /Accedi/i }).first().click()
  await page.waitForTimeout(3500)
  await shot('01-dashboard')

  // Enter the test league
  const league = page.getByText(/Fantacontratti Test/i).first()
  if (await league.count()) {
    await league.click()
    await page.waitForTimeout(3000)
    await shot('02-league')
  } else {
    log('league card not found')
  }

  // Go to Scambi (Trades) — the migrated Tabs live here
  const scambi = page.getByText(/^Scambi$/i).first()
  if (await scambi.count()) {
    await scambi.click({ timeout: 5000 }).catch((e) => log('scambi click fail', e.message))
    await page.waitForTimeout(3000)
    await shot('03-trades-tabs')
  } else {
    log('Scambi nav not found; trying menu')
    const menu = page.getByRole('button', { name: /menu/i }).first()
    if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(800); await shot('03b-menu') }
  }

  log('final url:', page.url())
} catch (e) {
  log('ERROR:', e.message)
  await shot('99-error')
} finally {
  await browser.close()
}
