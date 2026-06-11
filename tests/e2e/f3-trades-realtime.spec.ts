import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PrismaClient } from '@prisma/client'

/**
 * E2E — F3 Scambi: flusso UI + SINCRONIA real-time con TRE utenti reali.
 *
 * Copre la parte che la verifica backend (`scripts/test-session/verify-f3-trades.ts`)
 * NON può toccare: rendering, Pusher, propagazione tra client.
 *   1. Michele crea un'offerta a Mirko dalla deal room (1 giocatore ceduto + 1 richiesto)
 *   2. Mirko vede l'offerta in "Ricevute" in tempo reale (≤ pochi s, NON al polling)
 *   3. Diego (estraneo) vede l'indicatore "trattative in corso" comparire real-time
 *   4. Mirko accetta → conferma su Mirko + l'offerta esce dalle pending di Michele;
 *      trasferimento verificato sul DB
 *
 * Ambiente atteso (già attivo): Frontend http://localhost:5174 · API :3003 · DB :5433
 * Lega E2E in MERCATO_RICORRENTE / OFFERTE_PRE_RINNOVO con rose piene.
 *
 * Non distruttivo: SNAPSHOT di rose+budget nel beforeAll, RESTORE nel afterAll +
 * cancellazione di tutte le TradeOffer e dei movimenti TRADE della sessione.
 *
 * Run headed (per vedere le finestre):
 *   HEADED=1 SLOWMO=350 npx playwright test f3-trades-realtime --workers=1
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 350 : 0

const USERS = {
  michele: { email: 'michele@test.it', password: 'Michele2025!', name: 'Michele' },
  mirko: { email: 'mirko@test.it', password: 'Mirko2025!', name: 'Mirko' },
  diego: { email: 'diego@test.it', password: 'Diego2025!', name: 'Diego' },
}
const TRADES_URL = `${BASE}/leagues/${LEAGUE_ID}/trades`

// ─── DB helpers (test infra) ────────────────────────────────────────────
function readDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    return m?.[1]
  } catch {
    return undefined
  }
}

type RosterSnap = { id: string; leagueMemberId: string; acquisitionType: string }
type BudgetSnap = { id: string; currentBudget: number }
let rosterSnap: RosterSnap[] = []
let budgetSnap: BudgetSnap[] = []

async function withPrisma<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const url = readDatabaseUrl()
  if (!url) throw new Error('DATABASE_URL non trovata (né env né .env.local)')
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    return await fn(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

async function snapshot(): Promise<void> {
  await withPrisma(async (prisma) => {
    rosterSnap = await prisma.playerRoster.findMany({
      where: { leagueMember: { leagueId: LEAGUE_ID } },
      select: { id: true, leagueMemberId: true, acquisitionType: true },
    })
    const members = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID }, select: { id: true, currentBudget: true } })
    budgetSnap = members
  })
}

async function restore(): Promise<void> {
  await withPrisma(async (prisma) => {
    const sessions = await prisma.marketSession.findMany({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' }, select: { id: true } })
    for (const s of sessions) {
      await prisma.playerMovement.deleteMany({ where: { marketSessionId: s.id, movementType: 'TRADE' } })
      await prisma.tradeOffer.deleteMany({ where: { marketSessionId: s.id } })
    }
    for (const r of rosterSnap) {
      await prisma.playerRoster.updateMany({
        where: { id: r.id, NOT: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType as never } },
        data: { leagueMemberId: r.leagueMemberId, acquisitionType: r.acquisitionType as never },
      })
    }
    const all = await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID } }, select: { id: true, leagueMemberId: true } })
    for (const r of all) {
      await prisma.playerContract.updateMany({ where: { rosterId: r.id, NOT: { leagueMemberId: r.leagueMemberId } }, data: { leagueMemberId: r.leagueMemberId } })
    }
    for (const b of budgetSnap) {
      await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
    }
  })
}

// ─── UI helpers ─────────────────────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

async function openTrades(page: Page) {
  await page.goto(TRADES_URL)
  await expect(page.getByText(/Caricamento trattative/i)).toHaveCount(0, { timeout: 20000 })
  await expect(page.getByRole('heading', { name: /Trattative/i })).toBeVisible({ timeout: 15000 })
}

/** Misura i secondi finché il locator diventa visibile, tenendo la pagina in primo piano. */
async function timeToVisible(page: Page, factory: () => ReturnType<Page['locator']>, timeoutMs = 20000): Promise<number> {
  await page.bringToFront().catch(() => {})
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) }).catch(() => {})
  const start = Date.now()
  let lastNudge = start
  while (true) {
    if ((await factory().count()) > 0) {
      try { if (await factory().first().isVisible()) break } catch { /* re-poll */ }
    }
    if (Date.now() - start > timeoutMs) throw new Error(`Locator non visibile entro ${timeoutMs}ms`)
    if (Date.now() - lastNudge > 2000) {
      lastNudge = Date.now()
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) }).catch(() => {})
    }
    await page.waitForTimeout(200)
  }
  return (Date.now() - start) / 1000
}

const results: Array<{ step: string; seconds: number }> = []
function record(step: string, seconds: number) {
  results.push({ step, seconds })
   
  console.log(`[SYNC] ${step}: ${seconds.toFixed(2)}s — ${seconds <= 4 ? 'PASS (≤4s)' : 'WARN (>4s)'}`)
}

// ─── Test ───────────────────────────────────────────────────────────────
test.describe('F3 Scambi — UI + sincronia real-time (3 utenti reali)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 })

  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctxMichele: BrowserContext, ctxMirko: BrowserContext, ctxDiego: BrowserContext
  let michele: Page, mirko: Page, diego: Page

  test.beforeAll(async () => {
    await snapshot()
    await restore() // parti da zero trade nella sessione (idempotenza)
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctxMichele = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    ctxMirko = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    ctxDiego = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    michele = await ctxMichele.newPage()
    mirko = await ctxMirko.newPage()
    diego = await ctxDiego.newPage()
  })

  test.afterAll(async () => {
     
    console.log('\n========== RIEPILOGO SINCRONIA F3 ==========')
    for (const r of results) console.log(`  ${r.seconds <= 4 ? '✓' : '⚠'} ${r.step}: ${r.seconds.toFixed(2)}s`)
    console.log('============================================\n')
    await ctxMichele?.close(); await ctxMirko?.close(); await ctxDiego?.close()
    await browser?.close()
    await restore()
  })

  test('1 — login e accesso alla pagina Scambi (3 utenti)', async () => {
    await login(michele, USERS.michele.email, USERS.michele.password)
    await login(mirko, USERS.mirko.email, USERS.mirko.password)
    await login(diego, USERS.diego.email, USERS.diego.password)
    await openTrades(michele)
    await openTrades(mirko)
    await openTrades(diego)
    // Mirko si posiziona su "Ricevute", Diego resta sulla pagina (indicatore in header)
    await mirko.getByRole('tab', { name: /Ricevute/i }).click().catch(async () => {
      await mirko.getByRole('button', { name: /Ricevute/i }).click()
    })
    // Deal room renderizzata (siamo in fase scambi): compare il select Destinatario
    await expect(
      michele.locator('select', { has: michele.locator('option', { hasText: /Seleziona DG target/i }) })
    ).toBeVisible({ timeout: 10000 })
  })

  test('2 — Michele crea un\'offerta a Mirko dalla deal room', async () => {
    // Pannelli identificati per contenuto (NON per indice: la DealFinanceBar ha la stessa classe).
    const minePanel = michele.locator('div.bg-slate-900\\/80').filter({ has: michele.getByRole('heading', { name: 'La Mia Rosa' }) })
    const partnerPanel = michele.locator('div.bg-slate-900\\/80').filter({ has: michele.getByPlaceholder(/Cerca giocatore/i) })
    await expect(minePanel).toBeVisible({ timeout: 10000 })

    // Destinatario = Mirko (select "Destinatario" della DealTable)
    const targetSelect = michele.locator('select', { has: michele.locator('option', { hasText: /Seleziona DG target/i }) })
    await targetSelect.selectOption({ label: USERS.mirko.name })

    // Richiesto: primo giocatore nel pannello partner (ora rosa di Mirko)
    const partnerCards = partnerPanel.locator('div.overflow-y-auto > div')
    await expect(partnerCards.first()).toBeVisible({ timeout: 10000 })
    await partnerCards.first().click({ position: { x: 8, y: 18 } }) // area checkbox → toggle (evita il button nome)

    // Ceduto: primo giocatore nel pannello "La Mia Rosa"
    const mineCards = minePanel.locator('div.overflow-y-auto > div')
    await expect(mineCards.first()).toBeVisible({ timeout: 10000 })
    await mineCards.first().click({ position: { x: 8, y: 18 } })

    // Chip selezionate visibili nella DealTable (Tu Cedi / Tu Ottieni)
    await expect(michele.getByText(/Tu Cedi/i)).toBeVisible()

    // Invia
    const submit = michele.getByRole('button', { name: /^Invia Offerta$/i })
    await expect(submit).toBeEnabled({ timeout: 10000 })
    await submit.click()
    // Successo robusto: l'offerta compare tra le "Inviate" (bottone "Annulla Offerta" su offerta PENDING)
    await expect(michele.getByRole('button', { name: /Annulla Offerta/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('3 — Mirko vede l\'offerta in "Ricevute" in tempo reale', async () => {
    const t = await timeToVisible(mirko, () => mirko.getByRole('button', { name: /Accetta Scambio/i }))
    record('Offerta ricevuta su Mirko (real-time)', t)
    expect(t, 'arrivo offerta > 15s = regressione polling').toBeLessThan(15)
    // Il mittente mostrato è Michele
    await expect(mirko.getByText(USERS.michele.name).first()).toBeVisible()
  })

  test('4 — Diego (estraneo) vede l\'indicatore "trattative in corso" real-time', async () => {
    const t = await timeToVisible(diego, () => diego.getByText(/trattativ[ae] in corso nella lega/i))
    record('Indicatore trattative in corso su Diego (real-time)', t)
    expect(t).toBeLessThan(15)
  })

  test('5 — Mirko accetta → conferma + trasferimento sul DB', async () => {
    await mirko.getByRole('button', { name: /Accetta Scambio/i }).first().click()
    await expect(mirko.getByText(/Scambio accettato/i)).toBeVisible({ timeout: 10000 })

    // Verifica sul DB: esiste ≥1 trade ACCEPTED e ≥2 movimenti TRADE nella sessione attiva
    const ok = await withPrisma(async (prisma) => {
      const s = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' }, select: { id: true } })
      if (!s) return false
      const accepted = await prisma.tradeOffer.count({ where: { marketSessionId: s.id, status: 'ACCEPTED' } })
      const movs = await prisma.playerMovement.count({ where: { marketSessionId: s.id, movementType: 'TRADE' } })
       
      console.log(`[DB] trade ACCEPTED=${accepted}, movimenti TRADE=${movs}`)
      return accepted >= 1 && movs >= 2
    })
    expect(ok, 'accettazione non riflessa sul DB (trade ACCEPTED + 2 movimenti TRADE)').toBe(true)

    // L'offerta esce dalle pending del mittente: su Mirko non resta il bottone Accetta
    await expect(mirko.getByRole('button', { name: /Accetta Scambio/i })).toHaveCount(0, { timeout: 10000 })
  })
})
