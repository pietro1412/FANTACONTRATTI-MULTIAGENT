/**
 * STRESS TEST concorrenza — 8 utenti, asta primo mercato, in PRODUZIONE.
 * Misura latenza/errori/race sotto carico per verificare i limiti del Free tier
 * (Vercel serverless + Neon 0.25 CU / scale-to-zero).
 * Uso: bash scripts/with-env.sh .env.vercel node scripts/_stress-test.mjs
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const BASE = 'https://fantacontratti-multiagent.vercel.app'
const LEAGUE_ID = 'cmrhiriba0008x3t07twekh9d'
const LOTS = 5              // numero di lotti (aste) da giocare
const TIMER_SECONDS = 300   // alto: non voglio che scada da solo, chiudo io

const USERS = [
  { key: 'admin',  email: 'pietro1412@gmail.com',            pass: 'TestAdmin2026!', memberId: 'cmrhirid0000bx3t09jk70b6c', isAdmin: true },
  { key: 'sim01',  email: 'sim01@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirier000dx3t0gljgi6yl' },
  { key: 'sim02',  email: 'sim02@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirifh000fx3t0ypzkjj9d' },
  { key: 'sim03',  email: 'sim03@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirig8000hx3t0pozidljz' },
  { key: 'sim04',  email: 'sim04@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirih9000jx3t0s20u8n0g' },
  { key: 'sim05',  email: 'sim05@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirihz000lx3t0kq8gqrsh' },
  { key: 'sim06',  email: 'sim06@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhiriip000nx3t05ugpvl22' },
  { key: 'sim07',  email: 'sim07@sim.fantacontratti.it',     pass: 'SimBeta2026!',   memberId: 'cmrhirijf000px3t055z5zz5n' },
]
const GK_POOL = [
  'cmkjwkaah000113tftbcyjn1j','cmkjwkaah000213tf3qvay0gt','cmkjwkaah000313tfrmzbhutb',
  'cmkjwkaah000413tfdnka5lc6','cmkjwkaah000513tfpkh1rhm7','cmkjwkaah000613tfh39rvjt8',
  'cmkjwkaah000713tfbsiuzoro','cmkjwkaah000813tf0gy1imb2',
]

const metrics = []  // { label, ms, status, ok }
function record(label, ms, status, ok) { metrics.push({ label, ms, status, ok }) }

async function call(label, method, path, token, body) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 30000)
  const t0 = performance.now()
  let status = 0, ok = false, json = null
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    status = res.status
    try { json = await res.json() } catch { json = null }
    ok = res.ok && (json?.success !== false)
  } catch (e) {
    status = e.name === 'AbortError' ? 'TIMEOUT' : 'NETERR'
  } finally {
    clearTimeout(to)
  }
  const ms = Math.round(performance.now() - t0)
  record(label, ms, status, ok)
  return { status, ok, json, ms }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log(`\n🔥 STRESS TEST — ${USERS.length} utenti, ${LOTS} lotti, su ${BASE}\n`)

  // 1) LOGIN (una volta sola per non sbattere sul rate-limit 20/15min)
  console.log('1) Login 8 utenti (la prima req include eventuale cold-start Neon/Vercel)...')
  for (const u of USERS) {
    const r = await call(`login:${u.key}`, 'POST', '/api/auth/login', null, { emailOrUsername: u.email, password: u.pass })
    if (!r.ok) { console.error(`  ❌ login ${u.key} fallito: ${r.status} ${JSON.stringify(r.json)}`); process.exit(1) }
    u.token = r.json.data.accessToken
    console.log(`  ✅ ${u.key} (${r.ms}ms)`)
  }
  const admin = USERS[0]

  // 2) Sessione: riuso l'ACTIVE esistente (o creo se assente) e la sblocco
  console.log('\n2) Preparo sessione asta...')
  const list = await call('sessions:list', 'GET', `/api/leagues/${LEAGUE_ID}/auctions`, admin.token)
  const arr = Array.isArray(list.json?.data) ? list.json.data : (Array.isArray(list.json) ? list.json : (list.json?.data?.sessions || []))
  const active = arr.find(s => s.status === 'ACTIVE')
  let sessionId
  if (active) {
    sessionId = active.id
    console.log(`  Riuso sessione ACTIVE ${sessionId} (fase ${active.currentPhase})`)
  } else {
    const created = await call('session:create', 'POST', `/api/leagues/${LEAGUE_ID}/auctions`, admin.token, { isRegularMarket: false })
    if (!created.ok) { console.error(`  ❌ create session: ${created.status} ${JSON.stringify(created.json)}`); process.exit(1) }
    sessionId = created.json.data?.id || created.json.data?.session?.id || created.json.id
    console.log(`  ✅ creata sessione ${sessionId}`)
  }
  // sblocco stato: chiudi eventuale asta corrente ancora aperta, poi force-ack
  const cur0 = await call('current:init', 'GET', `/api/auctions/sessions/${sessionId}/current`, admin.token)
  const openA = cur0.json?.data?.auction?.id || cur0.json?.data?.currentAuction?.id
  const openStatus = cur0.json?.data?.auction?.status
  if (openA && openStatus === 'ACTIVE') {
    console.log(`  Chiudo asta corrente ancora aperta ${openA}...`)
    await call('close:init', 'PUT', `/api/auctions/${openA}/close`, admin.token)
  }
  await call('ack:init', 'POST', `/api/auctions/sessions/${sessionId}/force-acknowledge-all`, admin.token)
  await call('session:timer', 'PUT', `/api/auctions/sessions/${sessionId}/timer`, admin.token, { timerSeconds: TIMER_SECONDS })

  // 3) Loop lotti: nomina (admin) -> giro realistico -> BURST -> close -> ack
  const lotResults = []
  for (let i = 0; i < LOTS; i++) {
    const playerId = GK_POOL[i % GK_POOL.length]
    console.log(`\n3.${i + 1}) Lotto ${i + 1} — nomino portiere ${playerId}`)
    const nom = await call('nominate', 'POST', `/api/auctions/sessions/${sessionId}/nominate`, admin.token, { playerId, basePrice: 1 })
    if (!nom.ok) { console.error(`  ⚠️ nominate fallito: ${nom.status} ${JSON.stringify(nom.json)} — stop lotti`); break }

    const cur = await call('current', 'GET', `/api/auctions/sessions/${sessionId}/current`, admin.token)
    const auctionId = cur.json?.data?.auction?.id || cur.json?.data?.currentAuction?.id || cur.json?.data?.id
    let price = cur.json?.data?.auction?.currentPrice ?? cur.json?.data?.currentPrice ?? 1
    if (!auctionId) { console.error(`  ⚠️ no auctionId in current: ${JSON.stringify(cur.json)?.slice(0,200)} — stop`); break }
    console.log(`  asta ${auctionId}, prezzo base ${price}`)

    // giro REALISTICO: 3 rilanci sequenziali con pause umane
    for (let k = 0; k < 3; k++) {
      const bidder = USERS[1 + (k % (USERS.length - 1))]
      price += 1
      const r = await call('bid:realistic', 'POST', `/api/auctions/${auctionId}/bid`, bidder.token, { amount: price })
      await sleep(400 + Math.floor((k + 1) * 150))
    }

    // BURST: tutti gli 8 offrono NELLO STESSO ISTANTE (Promise.all) — race massima
    console.log('  💥 BURST: 8 offerte simultanee...')
    const burstBase = price
    const burst = await Promise.all(USERS.map((u, idx) =>
      call('bid:burst', 'POST', `/api/auctions/${auctionId}/bid`, u.token, { amount: burstBase + 1 + idx })
    ))
    const okCount = burst.filter(b => b.ok).length
    const badLogic = burst.filter(b => b.status === 400).length
    const errCount = burst.filter(b => [500, 502, 503, 429, 'TIMEOUT', 'NETERR'].includes(b.status)).length
    console.log(`     ok:${okCount}  scarti-logici(400):${badLogic}  ERRORI(5xx/429/timeout):${errCount}`)

    // chiusura + acknowledge
    const close = await call('close', 'PUT', `/api/auctions/${auctionId}/close`, admin.token)
    await call('ack:force', 'POST', `/api/auctions/sessions/${sessionId}/force-acknowledge-all`, admin.token)

    // verifica vincitore via DB
    const auc = await prisma.auction.findUnique({ where: { id: auctionId }, select: { status: true, currentPrice: true, winnerId: true } })
    lotResults.push({ lot: i + 1, auctionId, burstOk: okCount, burstBadLogic: badLogic, burstErr: errCount, closeStatus: close.status, dbStatus: auc?.status, dbPrice: auc?.currentPrice, hasWinner: !!auc?.winnerId })
    console.log(`     chiusura ${close.status} | DB: status=${auc?.status} price=${auc?.currentPrice} winner=${auc?.winnerId ? 'sì' : 'NO'}`)
  }

  // 4) cleanup sessione
  await call('session:close', 'PUT', `/api/auctions/sessions/${sessionId}/close`, admin.token)

  // 5) REPORT
  console.log('\n' + '='.repeat(60))
  console.log('📊 REPORT METRICHE')
  console.log('='.repeat(60))
  const byLabel = {}
  for (const m of metrics) {
    (byLabel[m.label] ||= []).push(m)
  }
  const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
  console.log('\nlabel'.padEnd(20), 'n'.padStart(4), 'avg'.padStart(7), 'p95'.padStart(7), 'max'.padStart(7), 'errori')
  for (const [label, arr] of Object.entries(byLabel)) {
    const times = arr.map(a => a.ms)
    const errs = arr.filter(a => !a.ok)
    const errStatuses = [...new Set(errs.map(e => e.status))].join(',')
    const avg = Math.round(times.reduce((s, x) => s + x, 0) / times.length)
    console.log(
      label.padEnd(20),
      String(arr.length).padStart(4),
      `${avg}ms`.padStart(7),
      `${pct(times, 0.95)}ms`.padStart(7),
      `${Math.max(...times)}ms`.padStart(7),
      errs.length ? `${errs.length} [${errStatuses}]` : '—'
    )
  }
  const hardErr = metrics.filter(m => [500, 502, 503, 429, 'TIMEOUT', 'NETERR'].includes(m.status))
  console.log('\nErrori "di carico" (5xx/429/timeout/neterr):', hardErr.length)
  if (hardErr.length) hardErr.forEach(e => console.log(`  - ${e.label}: ${e.status} (${e.ms}ms)`))
  console.log('\nEsito lotti:')
  lotResults.forEach(l => console.log(`  Lotto ${l.lot}: burst ok=${l.burstOk} scarti=${l.burstBadLogic} err=${l.burstErr} | close=${l.closeStatus} | vincitore=${l.hasWinner ? 'sì' : 'NO'} @ ${l.dbPrice}`))
  const coldStart = metrics.find(m => m.label === 'login:admin')
  console.log(`\nCold-start (prima richiesta login:admin): ${coldStart?.ms}ms`)

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('FATAL:', e); await prisma.$disconnect(); process.exit(1) })
