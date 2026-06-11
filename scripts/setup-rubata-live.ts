/**
 * Porta la lega "Fantacontratti Test" a una fase RUBATA pronta da giocare LIVE:
 * crea una nuova sessione di mercato ricorrente (stagione successiva), passa per
 * PREMI e CONTRATTI (consolidamento di tutti), poi imposta ordine + tabellone
 * rubata e SI FERMA prima dell'avvio: l'admin (Pietro) avvia dalla UI.
 *
 * Derivato da simulate-three-years.ts (stessi endpoint, operatività minima).
 *
 * Usage: bash scripts/with-env.sh .env.local npx tsx scripts/setup-rubata-live.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const API_URL = process.env.API_URL || 'http://localhost:3003'
const LEAGUE_ID = 'cmq1a61zj000938rrglhxl7u2'

const USERS = [
  { email: 'pietro@test.it', password: 'Pietro2025!' },
  { email: 'michele@test.it', password: 'Michele2025!' },
  { email: 'mirko@test.it', password: 'Mirko2025!' },
  { email: 'emmanuele@test.it', password: 'Emmanuele2025!' },
  { email: 'diego@test.it', password: 'Diego2025!' },
  { email: 'marco@test.it', password: 'Marco2025!' },
  { email: 'marcolino@test.it', password: 'Marcolino2025!' },
  { email: 'emiliano@test.it', password: 'Emiliano2025!' },
]

interface Actor { token: string; username: string; memberId: string; isAdmin: boolean }
interface ApiResponse<T> { success: boolean; message?: string; data?: T }

function log(msg: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`) }
function fatal(msg: string, ctx?: unknown): never {
  console.error(`FATAL: ${msg}`, ctx ?? '')
  process.exit(1)
}

async function api<T = unknown>(token: string, method: string, path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<ApiResponse<T>>
}

async function apiMust<T = unknown>(token: string, method: string, path: string, body?: Record<string, unknown>, what?: string): Promise<ApiResponse<T>> {
  const res = await api<T>(token, method, path, body)
  if (!res.success) fatal(`${what ?? path} fallita: ${res.message}`, res)
  return res
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: email, password }),
  })
  const data = await res.json() as { success: boolean; data?: { accessToken: string } }
  if (!data.success || !data.data) fatal(`Login fallito: ${email}`)
  return data.data.accessToken
}

async function main(): Promise<void> {
  log('=== SETUP RUBATA LIVE — Fantacontratti Test ===')

  // Guard: nessuna sessione attiva
  const active = await prisma.marketSession.findFirst({ where: { leagueId: LEAGUE_ID, status: 'ACTIVE' } })
  if (active) fatal(`Esiste gia' una sessione ACTIVE (${active.id}, fase ${active.currentPhase})`)

  // Login di tutti
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID },
    include: { user: { select: { username: true, email: true } } },
  })
  const actors: Actor[] = []
  for (const u of USERS) {
    const m = members.find(mm => mm.user.email === u.email)
    if (!m) fatal(`Membro non trovato per ${u.email}`)
    const token = await login(u.email, u.password)
    actors.push({ token, username: m.user.username, memberId: m.id, isAdmin: m.role === 'ADMIN' })
  }
  const admin = actors.find(a => a.isAdmin)
  if (!admin) fatal('Nessun admin tra gli attori')
  log(`Login ok: ${actors.length} manager (admin: ${admin.username})`)

  // Season rollover
  const league = await prisma.league.findUniqueOrThrow({ where: { id: LEAGUE_ID }, select: { currentSeason: true } })
  const newSeason = (league.currentSeason ?? 3) + 1
  await prisma.league.update({ where: { id: LEAGUE_ID }, data: { currentSeason: newSeason } })
  log(`Season rollover: ${league.currentSeason} -> ${newSeason}`)

  // Apertura mercato ricorrente (decrementa durate, svincola scaduti)
  const createRes = await apiMust<{ session: { id: string } }>(
    admin.token, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: true }, 'apertura mercato ricorrente')
  const sessionId = createRes.data?.session.id
  if (!sessionId) fatal('Sessione creata senza id', createRes)
  await prisma.marketSession.update({ where: { id: sessionId }, data: { semester: 1 } })
  log(`Sessione ${sessionId} creata (stagione ${newSeason}, semestre 1): ${createRes.message ?? 'ok'}`)

  // FASE PREMI (minimale)
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'PREMI' }, 'fase PREMI')
  await apiMust(admin.token, 'POST', `/sessions/${sessionId}/prizes/init`, undefined, 'init premi')
  await apiMust(admin.token, 'PATCH', `/sessions/${sessionId}/prizes/base-reincrement`, { amount: 100 }, 'base reincrement')
  const catRes = await apiMust<{ id: string }>(admin.token, 'POST', `/sessions/${sessionId}/prizes/categories`, { name: `Premio Classifica S${newSeason}` }, 'categoria premi')
  const categoryId = catRes.data?.id
  if (!categoryId) fatal('Categoria premi senza id')
  const amounts = [40, 30, 25, 20, 15, 10, 5, 0]
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]
    if (!a) continue
    await apiMust(admin.token, 'PUT', `/prizes/categories/${categoryId}/members/${a.memberId}`, { amount: amounts[i] ?? 0 }, 'premio membro')
  }
  await apiMust(admin.token, 'POST', `/sessions/${sessionId}/prizes/finalize`, undefined, 'finalize premi')
  log('PREMI: assegnati e finalizzati (base 100M + classifica)')

  // FASE CONTRATTI: consolidamento di tutti, con rinnovo bulk dei contratti in scadenza
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'CONTRATTI' }, 'fase CONTRATTI')
  for (const a of actors) {
    const expiring = await prisma.playerContract.findMany({
      where: { leagueMemberId: a.memberId, duration: 1, roster: { status: 'ACTIVE' } },
    })
    const renewals: Array<{ contractId: string; salary: number; duration: number }> = []
    for (const c of expiring) {
      // rinnovo del 70% circa: estensione 2 semestri mantenendo l'ingaggio
      if (Math.random() < 0.7) {
        const dur = 2
        let sal = c.salary
        if (sal * dur < c.initialSalary) sal = Math.ceil(c.initialSalary / dur)
        renewals.push({ contractId: c.id, salary: sal, duration: dur })
      }
    }
    const undecided = await prisma.playerContract.findMany({
      where: {
        leagueMemberId: a.memberId,
        draftExitDecision: null,
        roster: { status: 'ACTIVE', player: { listStatus: 'NOT_IN_LIST', exitReason: { in: ['RETROCESSO', 'ESTERO'] } } },
      },
    })
    if (undecided.length > 0) {
      await apiMust(a.token, 'POST', `/leagues/${LEAGUE_ID}/contracts/save-drafts`, {
        exitDecisions: undecided.map(c => ({ contractId: c.id, decision: 'KEEP' })),
      }, `exit decisions ${a.username}`)
    }
    const res = await api(a.token, 'POST', `/leagues/${LEAGUE_ID}/contracts/consolidate`, { renewals })
    if (!res.success) fatal(`Consolidamento di ${a.username} fallito: ${res.message}`)
    log(`CONTRATTI: ${a.username} consolidato (${renewals.length} rinnovi su ${expiring.length} in scadenza)`)
  }

  // FASE RUBATA: timer umani, ordine per budget crescente, tabellone generato. STOP prima dell'avvio.
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'RUBATA' }, 'fase RUBATA')
  await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/rubata/timers`, { offerTimerSeconds: 60, auctionTimerSeconds: 30 }, 'timer rubata')
  const budgets = await prisma.leagueMember.findMany({ where: { leagueId: LEAGUE_ID }, select: { id: true, currentBudget: true } })
  const order = [...budgets].sort((a, b) => a.currentBudget - b.currentBudget).map(b => b.id)
  await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/rubata/order`, { memberOrder: order }, 'ordine rubata')
  const genRes = await apiMust<{ board: unknown[] }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/board/generate`, undefined, 'genera tabellone')
  log(`RUBATA: tabellone generato con ${genRes.data?.board?.length ?? '?'} giocatori`)

  const session = await prisma.marketSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { currentPhase: true, rubataState: true, status: true },
  })
  log('=== PRONTO ===')
  log(`Sessione ${sessionId}: status=${session.status} fase=${session.currentPhase} rubataState=${session.rubataState ?? 'null'}`)
  log('La rubata NON e\' avviata: Pietro (admin) puo\' avviarla dalla UI (Conduzione -> Avvia).')
}

main()
  .catch(e => { fatal('Errore non gestito', e) })
  .finally(() => { void prisma.$disconnect() })
