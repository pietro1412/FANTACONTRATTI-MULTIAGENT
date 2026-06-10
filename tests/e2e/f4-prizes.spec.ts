import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * E2E — F4 fase PREMI dalla UI admin.
 * Flusso reale dell'admin sulla pagina /prizes: auto-init, modifica re-incremento base,
 * creazione categoria, finalizzazione → accredito budget. Verifiche incrociate sul DB.
 *
 * Ambiente atteso (già attivo): Frontend :5174 · API :3003 · DB :5433.
 * Non distruttivo: la fase viene portata a PREMI come test-infra (DB), e al termine si
 * RIPRISTINA (config/categorie/premi cancellati, budget e fase ripristinati).
 *
 * Run headed: HEADED=1 SLOWMO=350 npx playwright test f4-prizes --workers=1
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 350 : 0
const ADMIN = { email: 'pietro@test.it', password: 'Pietro2025!' }
const PRIZES_URL = `${BASE}/leagues/${LEAGUE_ID}/prizes`

function readDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    return raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]
  } catch { return undefined }
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
let budgetSnap: { id: string; currentBudget: number }[] = []

async function setupPremiPhase() {
  await withPrisma(async (prisma) => {
    const s = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
    if (!s) throw new Error('Nessuna sessione ACTIVE')
    sessionId = s.id
    startPhase = s.currentPhase ?? 'OFFERTE_PRE_RINNOVO'
    const members = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' }, select: { id: true, currentBudget: true } })
    budgetSnap = members
    // pulizia eventuale stato premi pregresso + fase PREMI
    const cats = await prisma.prizeCategory.findMany({ where: { marketSessionId: s.id }, select: { id: true } })
    await prisma.sessionPrize.deleteMany({ where: { prizeCategoryId: { in: cats.map((c) => c.id) } } })
    await prisma.prizeCategory.deleteMany({ where: { marketSessionId: s.id } })
    await prisma.prizePhaseConfig.deleteMany({ where: { marketSessionId: s.id } })
    await prisma.marketSession.update({ where: { id: s.id }, data: { currentPhase: 'PREMI' } })
    // NB: NON pre-inizializziamo la fase premi: il test 1 verifica proprio l'auto-init
    // dall'apertura della pagina (fix oss. #34 — niente 500 sotto StrictMode).
  })
}

async function restoreState() {
  await withPrisma(async (prisma) => {
    const cats = await prisma.prizeCategory.findMany({ where: { marketSessionId: sessionId }, select: { id: true } })
    await prisma.sessionPrize.deleteMany({ where: { prizeCategoryId: { in: cats.map((c) => c.id) } } })
    await prisma.prizeCategory.deleteMany({ where: { marketSessionId: sessionId } })
    await prisma.prizePhaseConfig.deleteMany({ where: { marketSessionId: sessionId } })
    for (const b of budgetSnap) {
      await prisma.leagueMember.updateMany({ where: { id: b.id, NOT: { currentBudget: b.currentBudget } }, data: { currentBudget: b.currentBudget } })
    }
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

test.describe('F4 fase Premi — UI admin', () => {
  test.describe.configure({ mode: 'serial', timeout: 150000 })
  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctx: BrowserContext
  let admin: Page

  test.beforeAll(async () => {
    await setupPremiPhase()
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    admin = await ctx.newPage()
  })
  test.afterAll(async () => {
    await ctx?.close(); await browser?.close()
    await restoreState()
  })

  test('1 — admin apre /prizes → auto-init senza errori (fix #34)', async () => {
    await login(admin, ADMIN.email, ADMIN.password)
    await admin.goto(PRIZES_URL)
    await expect(admin.getByText(/Caricamento fase premi/i)).toHaveCount(0, { timeout: 20000 })
    // Fix #34: l'auto-init NON deve mostrare "Errore interno del server" (race StrictMode)
    await expect(admin.getByText(/Errore interno del server/i)).toHaveCount(0)
    await expect(admin.getByRole('heading', { name: /Re-incremento Budget Base/i })).toBeVisible({ timeout: 15000 })
    // Auto-init avvenuta UNA sola volta: config presente con base 100
    const cfg = await withPrisma((p) => p.prizePhaseConfig.findUnique({ where: { marketSessionId: sessionId } }))
    expect(cfg?.baseReincrement).toBe(100)
  })

  test('2 — modifica re-incremento base a 110 e salva', async () => {
    await admin.getByRole('button', { name: /^Modifica$/i }).first().click()
    const input = admin.locator('input[type="number"]').first()
    await expect(input).toBeVisible({ timeout: 5000 })
    await input.fill('110')
    await admin.getByRole('button', { name: /^Salva$/i }).click()
    // Persistito sul DB
    await expect.poll(async () => {
      const cfg = await withPrisma((p) => p.prizePhaseConfig.findUnique({ where: { marketSessionId: sessionId } }))
      return cfg?.baseReincrement
    }, { timeout: 10000 }).toBe(110)
  })

  test('3 — crea una categoria premio custom', async () => {
    await admin.getByPlaceholder(/Nome nuova categoria/i).fill('Premio E2E')
    await admin.getByRole('button', { name: /Aggiungi Categoria/i }).click()
    await expect(admin.getByText('Premio E2E').first()).toBeVisible({ timeout: 10000 })
    const cat = await withPrisma((p) => p.prizeCategory.findFirst({ where: { marketSessionId: sessionId, name: 'Premio E2E' } }))
    expect(cat?.isSystemPrize).toBe(false)
  })

  test('4 — finalizza i premi → budget accreditati (+110)', async () => {
    const pre = await withPrisma((p) => p.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' }, select: { id: true, currentBudget: true } }))
    const preMap = new Map(pre.map((m) => [m.id, m.currentBudget]))

    await admin.getByRole('button', { name: /^Finalizza Premi$/i }).click()
    await expect(admin.getByText(/Confermi la finalizzazione/i)).toBeVisible({ timeout: 5000 })
    await admin.getByRole('button', { name: /^Conferma$/i }).click()

    // Config finalizzato + ogni budget +110 (nessun premio non-sistema assegnato)
    await expect.poll(async () => {
      const cfg = await withPrisma((p) => p.prizePhaseConfig.findUnique({ where: { marketSessionId: sessionId } }))
      return cfg?.isFinalized
    }, { timeout: 10000 }).toBe(true)

    const post = await withPrisma((p) => p.leagueMember.findMany({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' }, select: { id: true, currentBudget: true } }))
    let errors = 0
    for (const m of post) if (m.currentBudget - (preMap.get(m.id) ?? 0) !== 110) errors++
    expect(errors, 'tutti i budget accreditati di +110 (base)').toBe(0)
    // eslint-disable-next-line no-console
    console.log(`[F4] Finalize: ${post.length} budget accreditati +110. config.isFinalized=true`)
  })
})
