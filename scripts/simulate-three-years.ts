/**
 * Simulazione realistica di 3 anni di gioco per la lega "Fantacontratti Test".
 *
 * Driver via API (business logic reale). Prisma diretto SOLO per:
 *  - letture di supporto (membri, rose, contratti, free agent)
 *  - season rollover (league.currentSeason: nessun endpoint esistente)
 *  - patch del campo semester (createAuctionSession usa sessionCount+1)
 *  - backdating dei timestamp post-sessione
 *
 * Sessioni giocate:
 *  0) PRIMO_MERCATO  S1/sem1  -> 2023-09  (gia' attiva)
 *  1) MERCATO_RICORRENTE S1/2 -> 2024-02
 *  2) MERCATO_RICORRENTE S2/1 -> 2024-09
 *  3) MERCATO_RICORRENTE S2/2 -> 2025-02
 *  4) MERCATO_RICORRENTE S3/1 -> 2025-09
 *  5) MERCATO_RICORRENTE S3/2 -> 2026-02
 *
 * Usage:
 *   bash scripts/with-env.sh .env.local npx tsx scripts/simulate-three-years.ts [--from-session N]
 */
import { PrismaClient } from '@prisma/client'

const API_URL = process.env.API_URL || 'http://localhost:3003'
const LEAGUE_ID = 'cmq1a61zj000938rrglhxl7u2'

const prisma = new PrismaClient()

// ==================== TYPES ====================

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

interface Profile {
  /** propensione a rilanciare in asta (0..1) */
  aggressiveness: number
  /** quota contratti in scadenza rinnovati al consolidamento (0..1) */
  renewRate: number
  /** propensione agli scambi */
  tradeAffinity: number
  /** propensione agli acquisti svincolati */
  svincolatiAffinity: number
  /** propensione alle rubate */
  rubataAffinity: number
  /** descrizione narrativa */
  label: string
}

interface Actor {
  email: string
  username: string
  userId: string
  memberId: string
  token: string
  profile: Profile
}

interface RubataBoardEntry {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: string
  ownerUsername: string
  rubataPrice: number
  contractSalary: number
}

interface SessionPlanEntry {
  index: number
  season: number
  semester: number
  /** anno/mese di backdating */
  year: number
  month: number
  label: string
}

// ==================== CONFIG ====================

const USERS: Array<{ email: string; password: string; profile: Profile }> = [
  { email: 'pietro@test.it', password: 'Pietro2025!', profile: { aggressiveness: 0.5, renewRate: 0.85, tradeAffinity: 0.4, svincolatiAffinity: 0.5, rubataAffinity: 0.4, label: 'equilibrato (admin)' } },
  { email: 'michele@test.it', password: 'Michele2025!', profile: { aggressiveness: 0.9, renewRate: 0.8, tradeAffinity: 0.3, svincolatiAffinity: 0.8, rubataAffinity: 0.7, label: 'spendaccione' } },
  { email: 'mirko@test.it', password: 'Mirko2025!', profile: { aggressiveness: 0.2, renewRate: 0.95, tradeAffinity: 0.2, svincolatiAffinity: 0.2, rubataAffinity: 0.15, label: 'risparmiatore' } },
  { email: 'emmanuele@test.it', password: 'Emmanuele2025!', profile: { aggressiveness: 0.5, renewRate: 0.8, tradeAffinity: 0.95, svincolatiAffinity: 0.4, rubataAffinity: 0.3, label: 'mercante (molti scambi)' } },
  { email: 'diego@test.it', password: 'Diego2025!', profile: { aggressiveness: 0.6, renewRate: 0.85, tradeAffinity: 0.5, svincolatiAffinity: 0.6, rubataAffinity: 0.5, label: 'equilibrato' } },
  { email: 'marco@test.it', password: 'Marco2025!', profile: { aggressiveness: 0.8, renewRate: 0.75, tradeAffinity: 0.4, svincolatiAffinity: 0.5, rubataAffinity: 0.9, label: 'predatore (rubate)' } },
  { email: 'marcolino@test.it', password: 'Marcolino2025!', profile: { aggressiveness: 0.6, renewRate: 0.8, tradeAffinity: 0.6, svincolatiAffinity: 0.9, rubataAffinity: 0.4, label: 'cacciatore di svincolati' } },
  { email: 'emiliano@test.it', password: 'Emiliano2025!', profile: { aggressiveness: 0.35, renewRate: 0.9, tradeAffinity: 0.5, svincolatiAffinity: 0.4, rubataAffinity: 0.3, label: 'prudente' } },
]

const SESSION_PLAN: SessionPlanEntry[] = [
  { index: 0, season: 1, semester: 1, year: 2023, month: 9, label: 'PRIMO_MERCATO S1/1' },
  { index: 1, season: 1, semester: 2, year: 2024, month: 2, label: 'MERCATO_RICORRENTE S1/2' },
  { index: 2, season: 2, semester: 1, year: 2024, month: 9, label: 'MERCATO_RICORRENTE S2/1' },
  { index: 3, season: 2, semester: 2, year: 2025, month: 2, label: 'MERCATO_RICORRENTE S2/2' },
  { index: 4, season: 3, semester: 1, year: 2025, month: 9, label: 'MERCATO_RICORRENTE S3/1' },
  { index: 5, season: 3, semester: 2, year: 2026, month: 2, label: 'MERCATO_RICORRENTE S3/2' },
]

const PROPHECY_TEMPLATES: string[] = [
  '{p} fara\' almeno 10 gol entro fine stagione, segnatevelo.',
  'Con {p} ho chiuso il mercato: titolare fisso per tre anni.',
  '{p} si rivelera\' un bidone clamoroso, ci risentiamo a giugno.',
  'Affare del secolo: {p} varra\' il triplo tra un anno.',
  '{p} mi fara\' vincere la lega, parola mia.',
  'Avete dormito tutti: {p} a questo prezzo era un regalo.',
  '{p} restera\' in panchina tutto l\'anno, soldi buttati.',
  'La clausola di {p} e\' troppo bassa, me lo ruberanno subito.',
  'Vendere {p} oggi e\' la mossa piu\' intelligente che potessi fare.',
  '{p} e\' il nuovo capitano della mia squadra, fidatevi.',
  'Mi pentiro\' di aver ceduto {p}? Vedremo, ma ne dubito.',
  'Quotazione di {p} in salita verticale entro Natale.',
]

// ==================== UTILS ====================

let rngState = 20260611
function rnd(): number {
  // mulberry32 deterministico
  rngState |= 0
  rngState = (rngState + 0x6D2B79F5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function rndInt(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1))
}
function pick<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('pick su array vuoto')
  return arr[Math.floor(rnd() * arr.length)] as T
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = a[i] as T
    a[i] = a[j] as T
    a[j] = tmp
  }
  return a
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function fatal(msg: string, context?: unknown): never {
  console.error(`\nFATAL: ${msg}`)
  if (context !== undefined) console.error('Contesto:', JSON.stringify(context, null, 2))
  process.exit(1)
}

async function api<T = unknown>(token: string, method: string, path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await res.json()) as ApiResponse<T>
}

/** Chiamata che DEVE riuscire: in caso contrario stampa lo stato e si ferma. */
async function apiMust<T = unknown>(token: string, method: string, path: string, body?: Record<string, unknown>, what?: string): Promise<ApiResponse<T>> {
  const res = await api<T>(token, method, path, body)
  if (!res.success) {
    fatal(`${what || `${method} ${path}`} fallita: ${res.message}`, { method, path, body })
  }
  return res
}

async function login(email: string, password: string): Promise<{ token: string; userId: string; username: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: email, password }),
  })
  const data = (await res.json()) as ApiResponse<{ accessToken: string; user: { id: string; username: string } }>
  if (!data.success || !data.data) fatal(`Login fallito per ${email}: ${data.message}`)
  return { token: data.data.accessToken, userId: data.data.user.id, username: data.data.user.username }
}

// ==================== STATE HELPERS (Prisma, sola lettura) ====================

async function getBilancio(memberId: string): Promise<{ budget: number; monte: number; bilancio: number }> {
  const member = await prisma.leagueMember.findUnique({ where: { id: memberId }, select: { currentBudget: true } })
  const monte = await prisma.playerContract.aggregate({ where: { leagueMemberId: memberId }, _sum: { salary: true } })
  const budget = member?.currentBudget ?? 0
  const m = monte._sum.salary || 0
  return { budget, monte: m, bilancio: budget - m }
}

async function assertNoNegativeBudgets(stepLabel: string): Promise<void> {
  const negative = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, currentBudget: { lt: 0 } },
    include: { user: { select: { email: true } } },
  })
  if (negative.length > 0) {
    fatal(`Budget negativi dopo "${stepLabel}"`, negative.map(m => ({ email: m.user.email, budget: m.currentBudget })))
  }
}

async function getActiveSession(): Promise<{ id: string; type: string; currentPhase: string | null; status: string } | null> {
  return prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    select: { id: true, type: true, currentPhase: true, status: true },
  })
}

async function freeSlotCount(memberId: string, position: 'P' | 'D' | 'C' | 'A', slots: Record<string, number>): Promise<number> {
  const count = await prisma.playerRoster.count({
    where: { leagueMemberId: memberId, status: 'ACTIVE', player: { position } },
  })
  return (slots[position] ?? 0) - count
}

async function getFreeAgents(position?: 'P' | 'D' | 'C' | 'A', limit = 60): Promise<Array<{ id: string; name: string; position: string; quotation: number }>> {
  const taken = await prisma.playerRoster.findMany({
    where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' },
    select: { playerId: true },
  })
  const takenIds = taken.map(t => t.playerId)
  return prisma.serieAPlayer.findMany({
    where: {
      isActive: true,
      listStatus: 'IN_LIST',
      id: { notIn: takenIds },
      ...(position ? { position } : {}),
    },
    select: { id: true, name: true, position: true, quotation: true },
    orderBy: { quotation: 'desc' },
    take: limit,
  })
}

// ==================== PRIMO MERCATO ====================

async function runPrimoMercato(admin: Actor, actors: Actor[], plan: SessionPlanEntry): Promise<void> {
  log(`\n========== ${plan.label} ==========`)

  const existing = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'PRIMO_MERCATO' },
  })
  if (!existing) fatal('Nessuna sessione PRIMO_MERCATO trovata')
  if (existing.status === 'COMPLETED') {
    log('Primo mercato gia\' COMPLETED: skip (resume)')
    return
  }
  const sessionId = existing.id

  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  if (!league) fatal('Lega non trovata')
  const slots: Record<string, number> = { P: league.goalkeeperSlots, D: league.defenderSlots, C: league.midfielderSlots, A: league.forwardSlots }

  // Timer asta a 5s come richiesto
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/timer`, { timerSeconds: 5 }, 'set timer 5s')
  log('Timer asta impostato a 5s')

  // Eventuali acknowledgment pendenti da run precedenti
  await api(admin.token, 'POST', `/auctions/sessions/${sessionId}/force-acknowledge-all`)

  // Aste reali: 10-12 aste con nomination admin + rilanci multipli
  const targetAuctions = rndInt(10, 12)
  let done = 0
  for (let i = 0; i < targetAuctions; i++) {
    const sess = await prisma.marketSession.findUnique({ where: { id: sessionId }, select: { currentRole: true } })
    const role = (sess?.currentRole ?? 'P') as 'P' | 'D' | 'C' | 'A'

    // Manager con slot libero per questo ruolo
    const eligible: Actor[] = []
    for (const a of actors) {
      if ((await freeSlotCount(a.memberId, role, slots)) > 0) eligible.push(a)
    }
    if (eligible.length < 2) {
      log(`  Ruolo ${role}: meno di 2 manager con slot libero, stop aste reali`)
      break
    }

    const candidates = await getFreeAgents(role, 40)
    if (candidates.length === 0) { log(`  Nessun free agent per ruolo ${role}`); break }
    const player = candidates[rndInt(0, Math.min(14, candidates.length - 1))]
    if (!player) break

    const nomRes = await api<{ id: string }>(admin.token, 'POST', `/auctions/sessions/${sessionId}/nominate`, { playerId: player.id })
    if (!nomRes.success) {
      // messaggio atteso quando un ruolo si completa: ritenta col ruolo successivo
      log(`  Nomination ${player.name} rifiutata: ${nomRes.message} (riprovo)`)
      continue
    }
    const auctionId = nomRes.data?.id
    if (!auctionId) fatal('Nomination senza auctionId', nomRes)

    // Rilanci: 2-4 bidder, prezzo finale ~ quotazione +/- 30%
    const bidders = shuffle(eligible).slice(0, rndInt(2, Math.min(4, eligible.length)))
    const finalTarget = Math.max(2, Math.round(player.quotation * (0.7 + rnd() * 0.6)))
    let current = 1
    let lastBidder: Actor | null = null
    while (current < finalTarget) {
      const bidder = pick(bidders.filter(b => b !== lastBidder)) || bidders[0]
      if (!bidder) break
      const step = Math.max(1, Math.round((finalTarget - current) * (0.3 + rnd() * 0.5)))
      const amount = Math.min(finalTarget, current + step)
      const { bilancio } = await getBilancio(bidder.memberId)
      const filled = await prisma.playerRoster.count({ where: { leagueMemberId: bidder.memberId, status: 'ACTIVE' } })
      const totalSlots = slots.P + slots.D + slots.C + slots.A
      const reserve = Math.max(0, totalSlots - filled - 1) * 2
      const salary = Math.max(1, Math.round(amount / 10))
      if (amount + salary > bilancio - reserve) break
      const bidRes = await api(bidder.token, 'POST', `/auctions/${auctionId}/bid`, { amount })
      if (!bidRes.success) { log(`    bid ${amount} di ${bidder.username} rifiutata: ${bidRes.message}`); break }
      current = amount
      lastBidder = bidder
    }

    const closeRes = await apiMust<{ winner: { username: string; amount: number } | null }>(
      admin.token, 'PUT', `/auctions/${auctionId}/close`, undefined, `chiusura asta ${player.name}`)
    const w = closeRes.data?.winner
    log(`  Asta ${role} ${player.name}: ${w ? `assegnato (${w.amount})` : 'invenduto'}`)
    await apiMust(admin.token, 'POST', `/auctions/sessions/${sessionId}/force-acknowledge-all`, undefined, 'force-acknowledge-all')
    done++
  }
  log(`Aste reali completate: ${done}`)

  // Completa tutte le rose
  const completeRes = await apiMust<{ totalPlayersAdded?: number }>(admin.token, 'POST', `/auctions/sessions/${sessionId}/complete-all-slots`, undefined, 'complete-all-slots')
  log(`complete-all-slots: ${completeRes.message}`)

  // Chiusura sessione: crea i contratti automatici (flusso reale primo mercato)
  const closeSess = await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/close`, undefined, 'chiusura primo mercato')
  log(`Sessione chiusa: ${closeSess.message}`)

  await assertNoNegativeBudgets('primo mercato')
  await createPropheciesForSession(sessionId, actors)
  await backdateSession(sessionId, plan)
  log(`${plan.label} OK`)
}

// ==================== TRADES ====================

const acceptedPairsBySession = new Map<string, Set<string>>()

async function doTrades(sessionId: string, actors: Actor[], acceptedTarget: number, phaseLabel: string): Promise<number> {
  let accepted = 0
  const pairs = acceptedPairsBySession.get(sessionId) ?? new Set<string>()
  acceptedPairsBySession.set(sessionId, pairs)

  let attempts = 0
  while (accepted < acceptedTarget && attempts < acceptedTarget * 6) {
    attempts++
    // Mittente pescato per affinita' agli scambi
    const weighted = actors.flatMap(a => Array(Math.ceil(a.profile.tradeAffinity * 10)).fill(a) as Actor[])
    const sender = pick(weighted)
    const receiver = pick(actors.filter(a => a.memberId !== sender.memberId))
    const pairKey = `${receiver.memberId}->${sender.memberId}`
    if (pairs.has(pairKey)) continue // regola anti-reverse

    const senderRoster = await prisma.playerRoster.findMany({
      where: { leagueMemberId: sender.memberId, status: 'ACTIVE', contract: { isNot: null } },
      include: { player: { select: { name: true, quotation: true } } },
    })
    const receiverRoster = await prisma.playerRoster.findMany({
      where: { leagueMemberId: receiver.memberId, status: 'ACTIVE', contract: { isNot: null } },
      include: { player: { select: { name: true, quotation: true } } },
    })
    if (senderRoster.length < 2 || receiverRoster.length < 2) continue

    const offeredCount = rndInt(1, 2)
    const requestedCount = rndInt(1, 2)
    const offered = shuffle(senderRoster).slice(0, offeredCount)
    const requested = shuffle(receiverRoster).slice(0, requestedCount)

    // Conguaglio in una sola direzione
    const senderBudget = (await getBilancio(sender.memberId)).budget
    const direction = rnd()
    const offeredBudget = direction < 0.4 ? Math.min(rndInt(5, 25), Math.max(0, senderBudget - 10)) : 0
    const requestedBudget = direction >= 0.7 ? rndInt(5, 20) : 0

    const createRes = await api<{ id: string }>(sender.token, 'POST', `/leagues/${LEAGUE_ID}/trades`, {
      toMemberId: receiver.memberId,
      offeredPlayerIds: offered.map(r => r.id),
      requestedPlayerIds: requested.map(r => r.id),
      offeredBudget,
      requestedBudget,
      message: pick([
        'Che ne dici? Affare pulito.',
        'Ti serve, fidati di me.',
        'Ultima offerta, prendere o lasciare.',
        'Scambio alla pari, ci guadagniamo entrambi.',
      ]),
    })
    if (!createRes.success || !createRes.data?.id) {
      log(`  [${phaseLabel}] trade ${sender.username}->${receiver.username} rifiutata in creazione: ${createRes.message}`)
      continue
    }
    const tradeId = createRes.data.id

    // Il 20% delle offerte viene rifiutato (storia realistica), il resto accettato
    if (rnd() < 0.2) {
      await api(receiver.token, 'PUT', `/trades/${tradeId}/reject`)
      log(`  [${phaseLabel}] trade ${sender.username}->${receiver.username} RIFIUTATA (realismo)`)
      continue
    }

    const acceptRes = await api(receiver.token, 'PUT', `/trades/${tradeId}/accept`)
    if (!acceptRes.success) {
      log(`  [${phaseLabel}] accept fallita (${acceptRes.message}), annullo offerta`)
      await api(sender.token, 'PUT', `/trades/${tradeId}/cancel`)
      continue
    }
    pairs.add(`${sender.memberId}->${receiver.memberId}`)
    accepted++
    log(`  [${phaseLabel}] TRADE: ${sender.username} da' [${offered.map(o => o.player.name).join(', ')}]${offeredBudget ? ` +${offeredBudget}M` : ''} a ${receiver.username} per [${requested.map(o => o.player.name).join(', ')}]${requestedBudget ? ` +${requestedBudget}M` : ''}`)
  }
  return accepted
}

// ==================== PREMI ====================

async function runPremi(admin: Actor, actors: Actor[], sessionId: string, season: number): Promise<void> {
  await apiMust(admin.token, 'POST', `/sessions/${sessionId}/prizes/init`, undefined, 'init premi')
  const base = rndInt(80, 120)
  await apiMust(admin.token, 'PATCH', `/sessions/${sessionId}/prizes/base-reincrement`, { amount: base }, 'base reincrement')

  const catRes = await apiMust<{ id: string }>(admin.token, 'POST', `/sessions/${sessionId}/prizes/categories`, { name: `Premio Classifica S${season}` }, 'crea categoria premi')
  const categoryId = catRes.data?.id
  if (!categoryId) fatal('Categoria premi senza id', catRes)
  const amounts = shuffle([40, 30, 25, 20, 15, 10, 5, 0])
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i]
    if (!a) continue
    await apiMust(admin.token, 'PUT', `/prizes/categories/${categoryId}/members/${a.memberId}`, { amount: amounts[i] ?? 0 }, 'premio membro')
  }

  // Categoria extra in alcune sessioni
  if (rnd() < 0.5) {
    const cat2 = await apiMust<{ id: string }>(admin.token, 'POST', `/sessions/${sessionId}/prizes/categories`, { name: 'Fair Play' }, 'crea categoria fair play')
    const fpWinner = pick(actors)
    if (cat2.data?.id) {
      await apiMust(admin.token, 'PUT', `/prizes/categories/${cat2.data.id}/members/${fpWinner.memberId}`, { amount: rndInt(5, 15) }, 'premio fair play')
    }
  }

  await apiMust(admin.token, 'POST', `/sessions/${sessionId}/prizes/finalize`, undefined, 'finalize premi')
  log(`  PREMI: base ${base}M + Premio Classifica assegnati e finalizzati`)
}

// ==================== CONTRATTI ====================

let spalmaDoneGlobal = false

async function runContratti(actors: Actor[], sessionId: string): Promise<void> {
  const renewTarget = rndInt(2, 4)
  const taglioTarget = rndInt(1, 2)
  let renews = 0
  let tagli = 0

  // Rinnovi "visibili" (endpoint standalone -> movimento CONTRACT_RENEW)
  for (const a of shuffle(actors)) {
    if (renews >= renewTarget) break
    const contracts = await prisma.playerContract.findMany({
      where: { leagueMemberId: a.memberId, roster: { status: 'ACTIVE' } },
      include: { roster: { select: { acquisitionType: true, player: { select: { name: true } } } } },
    })
    const renewable = contracts.filter(c => c.duration >= 1 && c.duration < 4 && c.roster.acquisitionType !== 'TRADE')
    if (renewable.length === 0) continue
    const c = pick(renewable)
    let newSalary: number
    let newDuration: number
    if (c.duration === 1 && !spalmaDoneGlobal && rnd() < 0.7) {
      // SPALMA: ridistribuisce l'ingaggio su piu' semestri
      newDuration = rndInt(2, 3)
      newSalary = Math.max(1, Math.ceil(c.initialSalary / newDuration))
      if (newSalary * newDuration < c.initialSalary) newSalary++
    } else {
      newSalary = c.salary + rndInt(1, 3)
      newDuration = Math.min(4, c.duration + rndInt(0, 1))
      if (newDuration === c.duration && c.duration > 1) newDuration = c.duration // solo aumento ingaggio
    }
    const res = await api(a.token, 'POST', `/contracts/${c.id}/renew`, { newSalary, newDuration })
    if (res.success) {
      const isSpalma = c.duration === 1 && newDuration > 1 && newSalary < c.salary
      if (isSpalma) spalmaDoneGlobal = true
      log(`  CONTRATTI: ${a.username} ${isSpalma ? 'SPALMA' : 'rinnova'} ${c.roster.player.name} ${c.salary}/${c.duration} -> ${newSalary}/${newDuration}`)
      renews++
    } else {
      log(`  CONTRATTI: rinnovo ${c.roster.player.name} di ${a.username} rifiutato: ${res.message}`)
    }
  }

  // Tagli
  for (const a of shuffle(actors)) {
    if (tagli >= taglioTarget) break
    const contracts = await prisma.playerContract.findMany({
      where: { leagueMemberId: a.memberId, roster: { status: 'ACTIVE' } },
      include: { roster: { select: { player: { select: { name: true, quotation: true } } } } },
      orderBy: { salary: 'asc' },
    })
    if (contracts.length < 18) continue // non svuotare rose gia' corte
    const cheap = contracts.slice(0, 6)
    const c = pick(cheap)
    const cost = Math.ceil((c.salary * c.duration) / 2)
    const { budget } = await getBilancio(a.memberId)
    if (cost > budget - 30) continue
    const res = await api(a.token, 'POST', `/contracts/${c.id}/release`)
    if (res.success) {
      log(`  CONTRATTI: ${a.username} TAGLIA ${c.roster.player.name} (costo ${cost}M)`)
      tagli++
    } else {
      log(`  CONTRATTI: taglio ${c.roster.player.name} rifiutato: ${res.message}`)
    }
  }

  // Consolidamento per ogni manager, con rinnovo bulk dei contratti in scadenza (durata 1)
  for (const a of actors) {
    const expiring = await prisma.playerContract.findMany({
      where: { leagueMemberId: a.memberId, duration: 1, roster: { status: 'ACTIVE' } },
    })
    const renewals: Array<{ contractId: string; salary: number; duration: number }> = []
    for (const c of expiring) {
      if (rnd() < a.profile.renewRate) {
        // estensione semplice a 2 semestri mantenendo l'ingaggio (spalma tecnica ammessa)
        const dur = rndInt(2, 3)
        let sal = c.salary
        if (sal * dur < c.initialSalary) sal = Math.ceil(c.initialSalary / dur)
        renewals.push({ contractId: c.id, salary: sal, duration: dur })
      }
      // i non rinnovati scadranno (durata 0) all'apertura del prossimo mercato
    }

    // Eventuali giocatori usciti (ESTERO/RETROCESSO) senza decisione: KEEP di default
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
    if (!res.success) {
      fatal(`Consolidamento di ${a.username} fallito: ${res.message}`, { sessionId, renewals: renewals.length })
    }
    log(`  CONTRATTI: ${a.username} consolidato (${renewals.length} rinnovi bulk su ${expiring.length} in scadenza)`)
  }
}

// ==================== RUBATA ====================

async function runRubata(admin: Actor, actors: Actor[], sessionId: string): Promise<number> {
  await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/rubata/timers`, { offerTimerSeconds: 120, auctionTimerSeconds: 120 }, 'timer rubata')

  // Ordine: classifica inversa simulata = budget crescente
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    orderBy: { currentBudget: 'asc' },
    select: { id: true },
  })
  await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/rubata/order`, { memberOrder: members.map(m => m.id) }, 'ordine rubata')

  const genRes = await apiMust<{ board: RubataBoardEntry[] }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/board/generate`, undefined, 'genera tabellone')
  const board = genRes.data?.board ?? []
  log(`  RUBATA: tabellone con ${board.length} giocatori`)
  if (board.length === 0) {
    fatal('Tabellone rubata vuoto', { sessionId })
  }

  // Pianifica 3-5 rubate
  const stealTarget = rndInt(3, 5)
  const plans = new Map<number, Actor>() // boardIndex -> ladro
  const candidateIdx = shuffle(board.map((_, i) => i).filter(i => i < board.length - 1))
  for (const idx of candidateIdx) {
    if (plans.size >= stealTarget) break
    const entry = board[idx]
    if (!entry) continue
    if (entry.rubataPrice > 120) continue // evita prezzi fuori scala
    const thieves = shuffle(actors.filter(a => a.memberId !== entry.memberId && rnd() < a.profile.rubataAffinity + 0.3))
    for (const thief of thieves) {
      const { bilancio } = await getBilancio(thief.memberId)
      if (bilancio >= entry.rubataPrice + 20) {
        plans.set(idx, thief)
        break
      }
    }
  }
  log(`  RUBATA: pianificate ${plans.size} rubate su ${stealTarget} desiderate`)

  await apiMust(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/force-ready`, undefined, 'force-ready avvio rubata')

  let stolen = 0
  let idx = 0
  let guard = 0
  while (idx < board.length && guard < board.length + 50) {
    guard++
    const thief = plans.get(idx)
    const entry = board[idx]
    if (thief && entry) {
      const offerRes = await api<{ auctionId: string }>(thief.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/offer`)
      if (!offerRes.success) {
        log(`  RUBATA: offerta di ${thief.username} su ${entry.playerName} rifiutata (${offerRes.message}), avanzo`)
        const adv = await apiMust<{ completed?: boolean }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/advance`, undefined, 'advance rubata')
        idx++
        if (adv.data?.completed) break
        continue
      }
      // Tutti pronti -> asta
      await apiMust(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/force-ready`, undefined, 'force-ready asta rubata')

      // Eventuali rilanci di altri manager
      let current = entry.rubataPrice
      if (rnd() < 0.5) {
        const rivals = shuffle(actors.filter(a => a.memberId !== entry.memberId && a.memberId !== thief.memberId))
        const numBids = rndInt(1, 3)
        let lastBidder: Actor = thief
        for (let b = 0; b < numBids; b++) {
          const rival = rivals[b]
          if (!rival) break
          const amount = current + rndInt(1, 6)
          const { bilancio } = await getBilancio(rival.memberId)
          if (amount > bilancio) continue
          const bidRes = await api(rival.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/auction/bid`, { amount })
          if (bidRes.success) { current = amount; lastBidder = rival }
          // il ladro originale risponde in base all'aggressivita'
          if (lastBidder !== thief && rnd() < thief.profile.aggressiveness) {
            const counter = current + rndInt(1, 4)
            const tb = await getBilancio(thief.memberId)
            if (counter <= tb.bilancio) {
              const cRes = await api(thief.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/auction/bid`, { amount: counter })
              if (cRes.success) { current = counter; lastBidder = thief }
            }
          }
        }
      }

      const closeRes = await apiMust<{ winnerUsername?: string; finalPrice?: number; isCompleted?: boolean }>(
        admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/close-auction`, undefined, 'chiusura asta rubata')
      log(`  RUBATA: ${entry.playerName} rubato da ${closeRes.data?.winnerUsername} per ${closeRes.data?.finalPrice}M`)
      stolen++
      idx++ // close-auction avanza gia' l'indice
      await apiMust(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/force-acknowledge`, undefined, 'force-acknowledge rubata')
      if (closeRes.data?.isCompleted) break
    } else {
      const adv = await apiMust<{ completed?: boolean }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/rubata/advance`, undefined, 'advance rubata')
      idx++
      if (adv.data?.completed) break
    }
  }
  log(`  RUBATA: completata con ${stolen} rubate`)
  return stolen
}

// ==================== ASTA SVINCOLATI ====================

async function runSvincolati(admin: Actor, actors: Actor[], sessionId: string): Promise<number> {
  await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/svincolati/timer`, { timerSeconds: 120 }, 'timer svincolati')
  // Ordine: inverso della rubata (auto)
  await apiMust(admin.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/turn-order`, { memberIds: [] }, 'ordine svincolati')

  const purchaseTarget = rndInt(4, 8)
  // Pianifica acquisti pesati sull'affinita'
  const planned = new Map<string, number>()
  let totalPlanned = 0
  const weighted = shuffle(actors.flatMap(a => Array(Math.ceil(a.profile.svincolatiAffinity * 10)).fill(a) as Actor[]))
  for (const a of weighted) {
    if (totalPlanned >= purchaseTarget) break
    planned.set(a.memberId, (planned.get(a.memberId) ?? 0) + 1)
    totalPlanned++
  }

  let purchases = 0
  let guard = 0
  while (guard < 120) {
    guard++
    const sess = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { svincolatiState: true, svincolatiTurnOrder: true, svincolatiCurrentTurnIndex: true },
    })
    if (!sess) fatal('Sessione svincolati scomparsa', { sessionId })
    const state = sess.svincolatiState
    if (state === 'COMPLETED') break
    if (state !== 'READY_CHECK') {
      fatal(`Stato svincolati inatteso: ${state}`, { sessionId })
    }
    const turnOrder = (sess.svincolatiTurnOrder as string[] | null) ?? []
    const turnIdx = sess.svincolatiCurrentTurnIndex ?? 0
    const currentMemberId = turnOrder[turnIdx]
    const current = actors.find(a => a.memberId === currentMemberId)
    if (!current) fatal('Manager di turno non trovato', { currentMemberId })

    const wants = (planned.get(current.memberId) ?? 0) > 0 && purchases < purchaseTarget
    const { bilancio } = await getBilancio(current.memberId)

    if (wants && bilancio >= 4) {
      const freeAgents = await getFreeAgents(undefined, 80)
      if (freeAgents.length === 0) { log('  SVINCOLATI: nessun free agent'); break }
      // preferisce giocatori di fascia media
      const pool = freeAgents.slice(Math.min(10, freeAgents.length - 1), Math.min(60, freeAgents.length))
      const player = pick(pool.length > 0 ? pool : freeAgents)

      const nomRes = await api(current.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/nominate`, { playerId: player.id })
      if (!nomRes.success) {
        log(`  SVINCOLATI: nomination ${player.name} di ${current.username} rifiutata (${nomRes.message}), passa`)
        await apiMust(current.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/pass`, undefined, 'pass svincolati')
        continue
      }
      await apiMust(current.token, 'PUT', `/leagues/${LEAGUE_ID}/svincolati/confirm`, undefined, 'conferma nomination')
      const startRes = await apiMust<{ auctionId: string }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/force-ready`, undefined, 'force-ready svincolati')
      const auctionId = startRes.data?.auctionId
      if (!auctionId) fatal('Asta svincolati senza auctionId', startRes)

      // Rilanci: il nominatore parte da 1, altri possono rilanciare
      let currentPrice = 1
      const numRivalBids = rndInt(0, 3)
      const rivals = shuffle(actors.filter(a => a.memberId !== current.memberId))
      let lastBidder: Actor = current
      for (let b = 0; b < numRivalBids; b++) {
        const rival = rivals[b]
        if (!rival) break
        const amount = currentPrice + rndInt(1, Math.max(2, Math.round(player.quotation / 4)))
        const rb = await getBilancio(rival.memberId)
        const sal = Math.max(1, Math.round(amount / 10))
        if (amount + sal > rb.bilancio) continue
        const bidRes = await api(rival.token, 'POST', `/svincolati/${auctionId}/bid`, { amount })
        if (bidRes.success) { currentPrice = amount; lastBidder = rival }
        // il nominatore risponde
        if (lastBidder !== current && rnd() < current.profile.aggressiveness + 0.2) {
          const counter = currentPrice + rndInt(1, 3)
          const cb = await getBilancio(current.memberId)
          const cSal = Math.max(1, Math.round(counter / 10))
          if (counter + cSal <= cb.bilancio) {
            const cRes = await api(current.token, 'POST', `/svincolati/${auctionId}/bid`, { amount: counter })
            if (cRes.success) { currentPrice = counter; lastBidder = current }
          }
        }
      }

      const closeRes = await apiMust<{ winnerUsername?: string; finalPrice?: number }>(
        admin.token, 'PUT', `/svincolati/${auctionId}/close-turn`, undefined, 'chiusura turno svincolati')
      log(`  SVINCOLATI: ${player.name} a ${closeRes.data?.winnerUsername} per ${closeRes.data?.finalPrice}M`)
      purchases++
      planned.set(current.memberId, (planned.get(current.memberId) ?? 1) - 1)
      const ackRes = await apiMust<{ completed?: boolean }>(admin.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/force-ack`, undefined, 'force-ack svincolati')
      if (ackRes.data?.completed) break
    } else {
      const passRes = await api<{ completed?: boolean }>(current.token, 'POST', `/leagues/${LEAGUE_ID}/svincolati/pass`)
      if (!passRes.success) {
        fatal(`Pass di ${current.username} fallito: ${passRes.message}`, { sessionId })
      }
      if (passRes.data?.completed) break
    }
  }

  // Se non gia' completata, chiusura admin
  const sess = await prisma.marketSession.findUnique({ where: { id: sessionId }, select: { svincolatiState: true } })
  if (sess?.svincolatiState !== 'COMPLETED') {
    await apiMust(admin.token, 'PUT', `/leagues/${LEAGUE_ID}/svincolati/complete`, undefined, 'completa fase svincolati')
  }
  log(`  SVINCOLATI: completata con ${purchases} acquisti`)
  return purchases
}

// ==================== PROFEZIE ====================

async function createPropheciesForSession(sessionId: string, actors: Actor[]): Promise<number> {
  const movements = await prisma.playerMovement.findMany({
    where: {
      marketSessionId: sessionId,
      leagueId: LEAGUE_ID,
      movementType: { in: ['FIRST_MARKET', 'TRADE', 'RUBATA', 'SVINCOLATI', 'RELEASE', 'CONTRACT_RENEW'] },
    },
    include: { player: { select: { name: true } } },
  })
  const sample = shuffle(movements).slice(0, Math.ceil(movements.length / 3))
  let created = 0
  for (const m of sample) {
    const authorMemberId = rnd() < 0.7 ? m.toMemberId : m.fromMemberId
    const author = actors.find(a => a.memberId === (authorMemberId ?? m.toMemberId ?? m.fromMemberId))
    if (!author) continue
    const content = pick(PROPHECY_TEMPLATES).replace('{p}', m.player.name)
    const res = await api(author.token, 'POST', `/movements/${m.id}/prophecy`, { content })
    if (res.success) created++
  }
  log(`  PROFEZIE: ${created} create su ${movements.length} movimenti`)
  return created
}

// ==================== BACKDATING ====================

async function backdateSession(sessionId: string, plan: SessionPlanEntry): Promise<void> {
  const { year, month } = plan
  const d = (day: number, hour = 21, minute = 0): Date => new Date(year, month - 1, day, hour, minute, rndInt(0, 59))

  // MarketSession
  await prisma.marketSession.update({
    where: { id: sessionId },
    data: {
      createdAt: d(1, 18, 30),
      startsAt: d(1, 19, 0),
      phaseStartedAt: d(24, 21, 0),
      endsAt: d(26, 23, 0),
    },
  })

  // Movements (ordine relativo preservato, giorni 2-24, orari serali)
  const movements = await prisma.playerMovement.findMany({
    where: { marketSessionId: sessionId, leagueId: LEAGUE_ID },
    orderBy: { createdAt: 'asc' },
    select: { id: true, movementType: true, playerId: true, toMemberId: true },
  })
  const movementDates = new Map<string, Date>()
  const n = Math.max(1, movements.length)
  for (let i = 0; i < movements.length; i++) {
    const mv = movements[i]
    if (!mv) continue
    const day = 2 + Math.floor((i / n) * 22)
    const hour = 19 + (i % 4)
    const minute = (i * 7) % 60
    const date = new Date(year, month - 1, day, hour, minute, i % 60)
    movementDates.set(mv.id, date)
    await prisma.playerMovement.update({ where: { id: mv.id }, data: { createdAt: date } })
  }

  // Profezie: poco dopo il movimento associato
  const prophecies = await prisma.prophecy.findMany({
    where: { leagueId: LEAGUE_ID, movementId: { in: movements.map(m => m.id) } },
    select: { id: true, movementId: true },
  })
  for (const p of prophecies) {
    const base = movementDates.get(p.movementId) ?? d(20)
    await prisma.prophecy.update({
      where: { id: p.id },
      data: { createdAt: new Date(base.getTime() + (2 + rndInt(0, 10)) * 3600 * 1000) },
    })
  }

  // Aste e offerte
  const auctions = await prisma.auction.findMany({
    where: { marketSessionId: sessionId, leagueId: LEAGUE_ID },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const an = Math.max(1, auctions.length)
  for (let i = 0; i < auctions.length; i++) {
    const a = auctions[i]
    if (!a) continue
    const day = 2 + Math.floor((i / an) * 18)
    const start = new Date(year, month - 1, day, 21, (i * 5) % 60, 0)
    const end = new Date(start.getTime() + rndInt(60, 240) * 1000)
    await prisma.auction.update({
      where: { id: a.id },
      data: { createdAt: start, startsAt: start, endsAt: end },
    })
    const bids = await prisma.auctionBid.findMany({ where: { auctionId: a.id }, orderBy: { placedAt: 'asc' }, select: { id: true } })
    for (let b = 0; b < bids.length; b++) {
      const bid = bids[b]
      if (!bid) continue
      await prisma.auctionBid.update({
        where: { id: bid.id },
        data: { placedAt: new Date(start.getTime() + (b + 1) * rndInt(8, 25) * 1000) },
      })
    }
  }

  // Snapshot finanziari
  await prisma.managerSessionSnapshot.updateMany({
    where: { marketSessionId: sessionId, snapshotType: 'SESSION_START' },
    data: { createdAt: d(1, 19, 5) },
  })
  await prisma.managerSessionSnapshot.updateMany({
    where: { marketSessionId: sessionId, snapshotType: { not: 'SESSION_START' } },
    data: { createdAt: d(14, 22, 0) },
  })

  // Storico contratti
  const histories = await prisma.contractHistory.findMany({
    where: { marketSessionId: sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  for (let i = 0; i < histories.length; i++) {
    const h = histories[i]
    if (!h) continue
    await prisma.contractHistory.update({
      where: { id: h.id },
      data: { createdAt: new Date(year, month - 1, 13, 20, (i * 3) % 60, i % 60) },
    })
  }

  // Trade offers
  const trades = await prisma.tradeOffer.findMany({
    where: { marketSessionId: sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    if (!t) continue
    const created = d(3 + (i % 20), 20, (i * 11) % 60)
    await prisma.tradeOffer.update({
      where: { id: t.id },
      data: {
        createdAt: created,
        respondedAt: new Date(created.getTime() + rndInt(1, 5) * 3600 * 1000),
        expiresAt: new Date(created.getTime() + 24 * 3600 * 1000),
      },
    })
  }

  // Consolidamenti e premi
  await prisma.contractConsolidation.updateMany({
    where: { sessionId },
    data: { consolidatedAt: d(14, 21, 30) },
  })
  const prizeConfig = await prisma.prizePhaseConfig.findUnique({ where: { marketSessionId: sessionId }, select: { id: true, isFinalized: true } })
  if (prizeConfig) {
    await prisma.prizePhaseConfig.update({
      where: { id: prizeConfig.id },
      data: { ...(prizeConfig.isFinalized ? { finalizedAt: d(8, 21, 0) } : {}) },
    })
  }

  // Roster: acquiredAt / releasedAt coerenti con i movimenti
  for (const mv of movements) {
    const date = movementDates.get(mv.id)
    if (!date) continue
    if (['FIRST_MARKET', 'SVINCOLATI'].includes(mv.movementType) && mv.toMemberId) {
      await prisma.playerRoster.updateMany({
        where: { playerId: mv.playerId, leagueMemberId: mv.toMemberId },
        data: { acquiredAt: date },
      })
    }
    if (['RELEASE', 'RELEGATION_RELEASE', 'ABROAD_COMPENSATION', 'RETIREMENT'].includes(mv.movementType)) {
      await prisma.playerRoster.updateMany({
        where: { playerId: mv.playerId, leagueMember: { leagueId: LEAGUE_ID }, status: 'RELEASED' },
        data: { releasedAt: date },
      })
    }
  }

  log(`  BACKDATE: sessione retrodatata a ${year}-${String(month).padStart(2, '0')}`)
}

// ==================== MERCATO RICORRENTE ====================

async function runMercatoRicorrente(admin: Actor, actors: Actor[], plan: SessionPlanEntry): Promise<void> {
  log(`\n========== ${plan.label} ==========`)

  // Resume: se esiste gia' COMPLETED con stesso season/semester, skip
  const existing = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'MERCATO_RICORRENTE', season: plan.season, semester: plan.semester },
  })
  if (existing?.status === 'COMPLETED') {
    log('Sessione gia\' COMPLETED: skip (resume)')
    return
  }
  const active = await getActiveSession()
  if (active) {
    fatal(`Esiste gia' una sessione ACTIVE (${active.id}, fase ${active.currentPhase}): risolvere manualmente o riprendere con --from-session corretto`, active)
  }

  // Season rollover (nessun endpoint: Prisma diretto, documentato)
  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID }, select: { currentSeason: true } })
  if (league && league.currentSeason !== plan.season) {
    await prisma.league.update({ where: { id: LEAGUE_ID }, data: { currentSeason: plan.season } })
    log(`  Season rollover: currentSeason ${league.currentSeason} -> ${plan.season}`)
  }

  // Apertura sessione: decremento durate + svincoli automatici + snapshot SESSION_START
  const createRes = await apiMust<{ session: { id: string }; contractsDecremented?: number; playersReleased?: string[] }>(
    admin.token, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: true }, 'apertura mercato ricorrente')
  const sessionId = createRes.data?.session.id
  if (!sessionId) fatal('Sessione creata senza id', createRes)
  log(`  Sessione ${sessionId}: ${createRes.message}`)

  // Patch semester (createAuctionSession usa sessionCount+1, non il semestre 1/2)
  await prisma.marketSession.update({ where: { id: sessionId }, data: { semester: plan.semester } })

  await assertNoNegativeBudgets('apertura mercato')

  // FASE 1: OFFERTE_PRE_RINNOVO
  log('  --- FASE 1: OFFERTE_PRE_RINNOVO ---')
  await doTrades(sessionId, actors, rndInt(1, 2), 'pre-rinnovo')

  // FASE 2: PREMI
  log('  --- FASE 2: PREMI ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'PREMI' }, 'fase PREMI')
  await runPremi(admin, actors, sessionId, plan.season)
  await assertNoNegativeBudgets('premi')

  // FASE 3: CONTRATTI
  log('  --- FASE 3: CONTRATTI ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'CONTRATTI' }, 'fase CONTRATTI')
  await runContratti(actors, sessionId)
  await assertNoNegativeBudgets('contratti')

  // FASE 4: RUBATA
  log('  --- FASE 4: RUBATA ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'RUBATA' }, 'fase RUBATA')
  await runRubata(admin, actors, sessionId)
  await assertNoNegativeBudgets('rubata')

  // FASE 5: ASTA_SVINCOLATI
  log('  --- FASE 5: ASTA_SVINCOLATI ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'ASTA_SVINCOLATI' }, 'fase ASTA_SVINCOLATI')
  await runSvincolati(admin, actors, sessionId)
  await assertNoNegativeBudgets('svincolati')

  // FASE 6: OFFERTE_POST_ASTA_SVINCOLATI
  log('  --- FASE 6: OFFERTE_POST_ASTA_SVINCOLATI ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/phase`, { phase: 'OFFERTE_POST_ASTA_SVINCOLATI' }, 'fase OFFERTE_POST')
  await doTrades(sessionId, actors, rndInt(1, 2), 'post-svincolati')

  // FASE 7: chiusura
  log('  --- FASE 7: CHIUSURA ---')
  await apiMust(admin.token, 'PUT', `/auctions/sessions/${sessionId}/close`, undefined, 'chiusura sessione')

  await createPropheciesForSession(sessionId, actors)
  await assertNoNegativeBudgets('chiusura sessione')
  await backdateSession(sessionId, plan)
  log(`${plan.label} OK`)
}

// ==================== REPORT FINALE ====================

async function finalReport(admin: Actor): Promise<void> {
  log('\n========== REPORT FINALE ==========')
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: { user: { select: { username: true } } },
  })
  for (const m of members) {
    const rosterCount = await prisma.playerRoster.count({ where: { leagueMemberId: m.id, status: 'ACTIVE' } })
    const monte = await prisma.playerContract.aggregate({ where: { leagueMemberId: m.id }, _sum: { salary: true } })
    const movs = await prisma.playerMovement.count({
      where: { leagueId: LEAGUE_ID, OR: [{ toMemberId: m.id }, { fromMemberId: m.id }] },
    })
    log(`  ${m.user.username.padEnd(12)} budget=${String(m.currentBudget).padStart(4)} monte=${String(monte._sum.salary || 0).padStart(3)} rosa=${String(rosterCount).padStart(2)} movimenti=${movs}`)
  }

  const byType = await prisma.playerMovement.groupBy({
    by: ['movementType'],
    where: { leagueId: LEAGUE_ID },
    _count: true,
  })
  log('  Movimenti per tipo: ' + byType.map(t => `${t.movementType}=${t._count}`).join(', '))

  const closedSessions = await prisma.marketSession.count({ where: { leagueId: LEAGUE_ID, status: 'COMPLETED' } })
  const snapshots = await prisma.managerSessionSnapshot.count({ where: { marketSession: { leagueId: LEAGUE_ID } } })
  const prophecies = await prisma.prophecy.count({ where: { leagueId: LEAGUE_ID } })
  const totalMovs = await prisma.playerMovement.count({ where: { leagueId: LEAGUE_ID } })
  log(`  Sessioni COMPLETED=${closedSessions}, snapshot=${snapshots}, profezie=${prophecies}, movimenti totali=${totalMovs}`)

  // Verifica endpoint financials
  const fin = await api<{ teams?: Array<{ teamName: string | null; budget: number }>; availableSessions?: unknown[] }>(
    admin.token, 'GET', `/leagues/${LEAGUE_ID}/financials`)
  log(`  GET /financials: success=${fin.success}${fin.success ? '' : ` (${fin.message})`}`)
}

// ==================== MAIN ====================

async function main(): Promise<void> {
  const fromArg = process.argv.indexOf('--from-session')
  const fromSession = fromArg >= 0 ? Number(process.argv[fromArg + 1] ?? '0') : 0

  log('=== SIMULAZIONE 3 ANNI — Fantacontratti Test ===')
  log(`API: ${API_URL} — lega: ${LEAGUE_ID} — from-session: ${fromSession}`)

  // Login e mapping membri a runtime
  const actors: Actor[] = []
  for (const u of USERS) {
    const auth = await login(u.email, u.password)
    const member = await prisma.leagueMember.findFirst({
      where: { leagueId: LEAGUE_ID, userId: auth.userId, status: 'ACTIVE' },
    })
    if (!member) fatal(`Membro non trovato per ${u.email}`)
    actors.push({ email: u.email, username: auth.username, userId: auth.userId, memberId: member.id, token: auth.token, profile: u.profile })
  }
  const admin = actors[0]
  if (!admin) fatal('Admin non trovato')
  log(`${actors.length} manager autenticati. Profili: ${actors.map(a => `${a.username}=${a.profile.label}`).join(' | ')}`)

  for (const plan of SESSION_PLAN) {
    if (plan.index < fromSession) {
      log(`Skip ${plan.label} (--from-session ${fromSession})`)
      continue
    }
    if (plan.index === 0) {
      await runPrimoMercato(admin, actors, plan)
    } else {
      await runMercatoRicorrente(admin, actors, plan)
    }
  }

  await finalReport(admin)
  log('\n=== SIMULAZIONE COMPLETATA ===')
}

main()
  .catch((e) => {
    console.error('FATAL (eccezione non gestita):', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
