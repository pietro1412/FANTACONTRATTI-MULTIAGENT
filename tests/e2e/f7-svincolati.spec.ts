import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PrismaClient } from '@prisma/client'

/**
 * E2E — F7 fase ASTA_SVINCOLATI: setup admin (ordine turni) dalla UI.
 * L'admin apre /svincolati in fase ASTA_SVINCOLATI e conferma l'ordine dei turni.
 * Verifiche DB: svincolatiTurnOrder impostato (8 membri), stato READY_CHECK.
 * L'esecuzione asta (nomination/bid/timer/close→contratto, real-time, bot) resta per il giro manuale.
 *
 * Ambiente atteso (già attivo): Frontend :5174 · API :3003 · DB :5433.
 * Non distruttivo: fase portata a ASTA_SVINCOLATI come test-infra; al termine RESTORE.
 *
 * Run headed: HEADED=1 SLOWMO=350 npx playwright test f7-svincolati --workers=1
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 350 : 0
const ADMIN = { email: 'pietro@test.it', password: 'Pietro2025!' }
const URL = `${BASE}/leagues/${LEAGUE_ID}/svincolati`

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
let snap: Record<string, unknown> = {}

async function setup() {
  await withPrisma(async (prisma) => {
    const { Prisma } = await import('@prisma/client')
    const s = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
    if (!s) throw new Error('Nessuna sessione ACTIVE')
    sessionId = s.id
    snap = {
      currentPhase: s.currentPhase, svincolatiTurnOrder: s.svincolatiTurnOrder,
      svincolatiCurrentTurnIndex: s.svincolatiCurrentTurnIndex, svincolatiState: s.svincolatiState,
      svincolatiReadyMembers: s.svincolatiReadyMembers, svincolatiTimerSeconds: s.svincolatiTimerSeconds,
    }
    await prisma.marketSession.update({ where: { id: s.id }, data: {
      currentPhase: 'ASTA_SVINCOLATI', svincolatiTurnOrder: Prisma.JsonNull,
      svincolatiCurrentTurnIndex: null, svincolatiState: null, svincolatiReadyMembers: Prisma.JsonNull,
    } })
  })
}
async function restore() {
  await withPrisma(async (prisma) => {
    const { Prisma } = await import('@prisma/client')
    await prisma.marketSession.update({ where: { id: sessionId }, data: {
      currentPhase: snap.currentPhase as never,
      svincolatiTurnOrder: (snap.svincolatiTurnOrder ?? Prisma.JsonNull) as never,
      svincolatiCurrentTurnIndex: snap.svincolatiCurrentTurnIndex as never,
      svincolatiState: snap.svincolatiState as never,
      svincolatiReadyMembers: (snap.svincolatiReadyMembers ?? Prisma.JsonNull) as never,
      svincolatiTimerSeconds: snap.svincolatiTimerSeconds as never,
    } })
  })
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

test.describe('F7 fase Svincolati — setup admin (ordine turni) UI', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 })
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

  test('1 — admin conferma l\'ordine turni svincolati → READY_CHECK', async () => {
    await login(admin, ADMIN.email, ADMIN.password)
    await admin.goto(URL)
    const confirmBtn = admin.getByRole('button', { name: /Conferma e Inizia Aste/i })
    await expect(confirmBtn).toBeVisible({ timeout: 20000 })
    await confirmBtn.click()
    // svincolatiTurnOrder (8 membri) + stato READY_CHECK sul DB
    await expect.poll(async () => {
      const s = await withPrisma((p) => p.marketSession.findUnique({ where: { id: sessionId }, select: { svincolatiTurnOrder: true } }))
      return Array.isArray(s?.svincolatiTurnOrder) ? (s.svincolatiTurnOrder as unknown[]).length : 0
    }, { timeout: 12000 }).toBe(8)
    const state = await withPrisma((p) => p.marketSession.findUnique({ where: { id: sessionId }, select: { svincolatiState: true } }))
    expect(state?.svincolatiState).toBe('READY_CHECK')
     
    console.log('[F7] Ordine turni svincolati impostato (8 membri), stato READY_CHECK')
  })
})
