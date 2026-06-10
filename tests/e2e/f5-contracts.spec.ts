import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * E2E — F5 fase CONTRATTI: consolidamento dalla UI.
 * Un manager senza giocatori usciti (Diego) apre /contracts in fase CONTRATTI e CONSOLIDA
 * (azione definitiva). Verifica: pagina renderizzata, stato "Consolidato", record
 * ContractConsolidation sul DB. Il dettaglio rinnovo/svincolo per-giocatore è coperto dal
 * backend (`verify-f5-contracts.ts`); qui si valida l'azione UI chiave (lock irreversibile).
 *
 * Ambiente atteso (già attivo): Frontend :5174 · API :3003 · DB :5433.
 * Non distruttivo: fase portata a CONTRATTI come test-infra; al termine RESTORE (elimina il
 * record di consolidamento, azzera preConsolidationBudget, ripristina la fase). Il consolidamento
 * è eseguito SENZA modifiche → i contratti non vengono mutati.
 *
 * Run headed: HEADED=1 SLOWMO=350 npx playwright test f5-contracts --workers=1
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 350 : 0
const MANAGER = { email: 'diego@test.it', password: 'Diego2025!', name: 'Diego' }
const CONTRACTS_URL = `${BASE}/leagues/${LEAGUE_ID}/contracts`

function readDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1] } catch { return undefined }
}
async function withPrisma<T>(fn: (p: import('@prisma/client').PrismaClient) => Promise<T>): Promise<T> {
  const url = readDatabaseUrl()
  if (!url) throw new Error('DATABASE_URL non trovata')
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try { return await fn(prisma) } finally { await prisma.$disconnect() }
}

let sessionId = ''
let startPhase = ''
let memberId = ''
let preConsolidationBudgetSnap: number | null = null

async function setup() {
  await withPrisma(async (prisma) => {
    const s = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
    if (!s) throw new Error('Nessuna sessione ACTIVE')
    sessionId = s.id
    startPhase = s.currentPhase ?? 'OFFERTE_PRE_RINNOVO'
    const m = await prisma.leagueMember.findFirst({ where: { leagueId: LEAGUE_ID, user: { username: MANAGER.name } }, select: { id: true, preConsolidationBudget: true } })
    if (!m) throw new Error('Membro Diego non trovato')
    memberId = m.id
    preConsolidationBudgetSnap = m.preConsolidationBudget
    // pulizia eventuale consolidamento pregresso + fase CONTRATTI
    await prisma.contractConsolidation.deleteMany({ where: { sessionId: s.id, memberId: m.id } })
    await prisma.marketSession.update({ where: { id: s.id }, data: { currentPhase: 'CONTRATTI' } })
  })
}

async function restore() {
  await withPrisma(async (prisma) => {
    await prisma.contractConsolidation.deleteMany({ where: { sessionId, memberId } })
    await prisma.leagueMember.update({ where: { id: memberId }, data: { preConsolidationBudget: preConsolidationBudgetSnap } })
    await prisma.marketSession.update({ where: { id: sessionId }, data: { currentPhase: startPhase as never } })
  })
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

test.describe('F5 fase Contratti — consolidamento UI', () => {
  test.describe.configure({ mode: 'serial', timeout: 150000 })
  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctx: BrowserContext
  let mgr: Page

  test.beforeAll(async () => {
    await setup()
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    mgr = await ctx.newPage()
  })
  test.afterAll(async () => { await ctx?.close(); await browser?.close(); await restore() })

  test('1 — Diego apre /contracts in fase CONTRATTI', async () => {
    await login(mgr, MANAGER.email, MANAGER.password)
    await mgr.goto(CONTRACTS_URL)
    // Pagina caricata in fase CONTRATTI: compare il bottone "Consolida" (solo se in fase e non consolidato)
    await expect(mgr.getByRole('button', { name: /^Consolida$/i })).toBeVisible({ timeout: 20000 })
    // Non in stato consolidato all'avvio
    await expect(mgr.getByText(/✓ Consolidato/i)).toHaveCount(0)
  })

  test('2 — consolida → stato consolidato + record DB', async () => {
    const consolidateBtn = mgr.getByRole('button', { name: /^Consolida$/i })
    await expect(consolidateBtn).toBeEnabled({ timeout: 10000 })
    await consolidateBtn.click()
    // Verifica primaria robusta: record ContractConsolidation creato sul DB
    await expect.poll(async () => {
      const rec = await withPrisma((p) => p.contractConsolidation.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } }))
      return !!rec
    }, { timeout: 15000 }).toBe(true)
    // La UI riflette il lock: il bottone "Consolida" sparisce (reso solo se non consolidato)
    await expect(mgr.getByRole('button', { name: /^Consolida$/i })).toHaveCount(0, { timeout: 10000 })
    // eslint-disable-next-line no-console
    console.log('[F5] Consolidamento Diego registrato sul DB + bottone Consolida rimosso dalla UI')
  })
})
