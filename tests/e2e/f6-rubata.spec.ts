import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PrismaClient } from '@prisma/client'

/**
 * E2E — F6 fase RUBATA: setup admin (ordine + generazione tabellone) dalla UI.
 * L'admin apre /rubata in fase RUBATA, conferma l'ordine dei turni (pre-popolato) e genera
 * il tabellone. Verifiche sul DB: rubataOrder impostato, tabellone generato, stato READY_CHECK.
 * L'asta forzata stateful (offer/bid/ready-check/ack/trasferimenti) resta per il giro manuale.
 *
 * Ambiente atteso (già attivo): Frontend :5174 · API :3003 · DB :5433.
 * Non distruttivo: fase portata a RUBATA come test-infra; al termine RESTORE (campi rubata della
 * sessione + rubataOrder dei membri + fase). Non tocca contratti/budget.
 *
 * Run headed: HEADED=1 SLOWMO=350 npx playwright test f6-rubata --workers=1
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 350 : 0
const ADMIN = { email: 'pietro@test.it', password: 'Pietro2025!' }
const RUBATA_URL = `${BASE}/leagues/${LEAGUE_ID}/rubata`

function readDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1] } catch { return undefined }
}
async function withPrisma<T>(fn: (p: PrismaClient) => Promise<T>): Promise<T> {
  const url = readDatabaseUrl()
  if (!url) throw new Error('DATABASE_URL non trovata')
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try { return await fn(prisma) } finally { await prisma.$disconnect() }
}

let sessionId = ''
let sessSnap: Record<string, unknown> = {}
let memberOrderSnap: { id: string; rubataOrder: number | null }[] = []

async function setup() {
  await withPrisma(async (prisma) => {
    const s = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
    if (!s) throw new Error('Nessuna sessione ACTIVE')
    sessionId = s.id
    sessSnap = {
      currentPhase: s.currentPhase, rubataOrder: s.rubataOrder, rubataBoard: s.rubataBoard,
      rubataBoardIndex: s.rubataBoardIndex, rubataState: s.rubataState, rubataReadyMembers: s.rubataReadyMembers,
    }
    const members = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID }, select: { id: true, rubataOrder: true } })
    memberOrderSnap = members
    // azzera stato rubata pregresso + fase RUBATA
    const { Prisma } = await import('@prisma/client')
    await prisma.marketSession.update({ where: { id: s.id }, data: {
      currentPhase: 'RUBATA', rubataOrder: Prisma.JsonNull, rubataBoard: Prisma.JsonNull,
      rubataBoardIndex: null, rubataState: null, rubataReadyMembers: Prisma.JsonNull,
    } })
  })
}
async function restore() {
  await withPrisma(async (prisma) => {
    const { Prisma } = await import('@prisma/client')
    await prisma.marketSession.update({ where: { id: sessionId }, data: {
      currentPhase: sessSnap.currentPhase as never,
      rubataOrder: (sessSnap.rubataOrder ?? Prisma.JsonNull) as never,
      rubataBoard: (sessSnap.rubataBoard ?? Prisma.JsonNull) as never,
      rubataBoardIndex: sessSnap.rubataBoardIndex as never,
      rubataState: sessSnap.rubataState as never,
      rubataReadyMembers: (sessSnap.rubataReadyMembers ?? Prisma.JsonNull) as never,
    } })
    for (const m of memberOrderSnap) await prisma.leagueMember.update({ where: { id: m.id }, data: { rubataOrder: m.rubataOrder } })
  })
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

test.describe('F6 fase Rubata — setup admin (ordine + tabellone) UI', () => {
  test.describe.configure({ mode: 'serial', timeout: 150000 })
  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctx: BrowserContext
  let admin: Page

  test.beforeAll(async () => {
    await setup()
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    admin = await ctx.newPage()
  })
  test.afterAll(async () => { await ctx?.close(); await browser?.close(); await restore() })

  test('1 — admin conferma l\'ordine rubata dalla UI', async () => {
    await login(admin, ADMIN.email, ADMIN.password)
    await admin.goto(RUBATA_URL)
    const confirmOrder = admin.getByRole('button', { name: /Conferma Ordine/i })
    await expect(confirmOrder).toBeVisible({ timeout: 20000 })
    await confirmOrder.click()
    // rubataOrder persistito sul DB (tutti gli 8 membri)
    await expect.poll(async () => {
      const s = await withPrisma((p) => p.marketSession.findUnique({ where: { id: sessionId }, select: { rubataOrder: true } }))
      return Array.isArray(s?.rubataOrder) ? (s.rubataOrder as unknown[]).length : 0
    }, { timeout: 10000 }).toBe(8)
  })

  test('2 — admin genera il tabellone → READY_CHECK', async () => {
    const genBtn = admin.getByRole('button', { name: /Genera Tabellone/i })
    await expect(genBtn).toBeVisible({ timeout: 15000 })
    await genBtn.click()
    // Tabellone generato sul DB: stato READY_CHECK + board con i contratti attivi
    await expect.poll(async () => {
      const s = await withPrisma((p) => p.marketSession.findUnique({ where: { id: sessionId }, select: { rubataState: true } }))
      return s?.rubataState
    }, { timeout: 12000 }).toBe('READY_CHECK')
    const boardLen = await withPrisma(async (p) => {
      const s = await p.marketSession.findUnique({ where: { id: sessionId }, select: { rubataBoard: true } })
      return Array.isArray(s?.rubataBoard) ? (s.rubataBoard as unknown[]).length : 0
    })
    const activeContracts = await withPrisma((p) => p.playerContract.count({ where: { roster: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' }, duration: { gt: 0 } } }))
    expect(boardLen, 'board con tutti i contratti attivi').toBe(activeContracts)
     
    console.log(`[F6] Tabellone generato: ${boardLen} giocatori, stato READY_CHECK`)
  })
})
