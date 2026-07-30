/**
 * STRESS TEST concorrenza — RUBATA + SVINCOLATI, 8 utenti, in PRODUZIONE.
 * Usa Prisma per leggere lo stato (auctionId, proprietario board, turni) e fetch per le azioni.
 * Uso: bash scripts/with-env.sh .env.vercel node scripts/_stress-test-rs.mjs
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const BASE = 'https://fantacontratti-multiagent.vercel.app'
const LEAGUE_ID = 'cmrhiriba0008x3t07twekh9d'
const RUBATA_LOTS = 3
const SVIN_LOTS = 3

const USERS = [
  { key: 'admin',  email: 'pietro1412@gmail.com',        pass: 'TestAdmin2026!', memberId: 'cmrhirid0000bx3t09jk70b6c', isAdmin: true },
  { key: 'sim01',  email: 'sim01@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirier000dx3t0gljgi6yl' },
  { key: 'sim02',  email: 'sim02@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirifh000fx3t0ypzkjj9d' },
  { key: 'sim03',  email: 'sim03@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirig8000hx3t0pozidljz' },
  { key: 'sim04',  email: 'sim04@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirih9000jx3t0s20u8n0g' },
  { key: 'sim05',  email: 'sim05@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirihz000lx3t0kq8gqrsh' },
  { key: 'sim06',  email: 'sim06@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhiriip000nx3t05ugpvl22' },
  { key: 'sim07',  email: 'sim07@sim.fantacontratti.it', pass: 'SimBeta2026!',   memberId: 'cmrhirijf000px3t055z5zz5n' },
]
const byMember = Object.fromEntries(USERS.map(u => [u.memberId, u]))

const metrics = []
async function call(label, method, path, token, body) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 30000)
  const t0 = performance.now(); let status = 0, ok = false, json = null
  try {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal })
    status = res.status; try { json = await res.json() } catch {}; ok = res.ok && json?.success !== false
  } catch (e) { status = e.name === 'AbortError' ? 'TIMEOUT' : 'NETERR' } finally { clearTimeout(to) }
  const ms = Math.round(performance.now() - t0); metrics.push({ label, ms, status, ok }); return { status, ok, json, ms }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function activeAuction(type) {
  return prisma.auction.findFirst({ where: { marketSessionId: SESSION_ID, status: 'ACTIVE', ...(type ? { type } : {}) }, orderBy: { createdAt: 'desc' }, select: { id: true, currentPrice: true, sellerId: true, playerId: true } })
}
let SESSION_ID

async function main() {
  console.log(`\n🔥 STRESS TEST RUBATA + SVINCOLATI — ${USERS.length} utenti, su ${BASE}\n`)

  // Login
  console.log('Login...')
  for (const u of USERS) {
    const r = await call(`login:${u.key}`, 'POST', '/api/auth/login', null, { emailOrUsername: u.email, password: u.pass })
    if (!r.ok) { console.error(`  ❌ login ${u.key}: ${r.status} ${JSON.stringify(r.json)}`); process.exit(1) }
    u.token = r.json.data.accessToken
  }
  const admin = USERS[0]
  console.log('  ✅ 8 login ok')

  // Sessione MERCATO_RICORRENTE (IN_PRESENCE)
  const created = await call('session:create', 'POST', `/api/leagues/${LEAGUE_ID}/auctions`, admin.token, { isRegularMarket: true, auctionMode: 'IN_PRESENCE' })
  if (!created.ok) { console.error(`  ❌ create session: ${created.status} ${JSON.stringify(created.json)}`); process.exit(1) }
  SESSION_ID = created.json.data?.id || created.json.data?.session?.id || created.json.id
  console.log(`  ✅ sessione ${SESSION_ID}`)

  // ===================== RUBATA =====================
  console.log('\n===== RUBATA =====')
  await call('phase:rubata', 'PUT', `/api/auctions/sessions/${SESSION_ID}/phase`, admin.token, { phase: 'RUBATA' })
  await call('rubata:order', 'PUT', `/api/leagues/${LEAGUE_ID}/rubata/order`, admin.token, { memberOrder: USERS.map(u => u.memberId) })
  await call('rubata:timers', 'PUT', `/api/leagues/${LEAGUE_ID}/rubata/timers`, admin.token, { offerTimerSeconds: 120, auctionTimerSeconds: 120 })
  const gen = await call('rubata:board-gen', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/board/generate`, admin.token)
  if (!gen.ok) console.error(`  ⚠️ board-generate: ${gen.status} ${JSON.stringify(gen.json)?.slice(0,150)}`)
  await call('rubata:start', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/start`, admin.token)

  for (let i = 0; i < RUBATA_LOTS; i++) {
    const sess = await prisma.marketSession.findUnique({ where: { id: SESSION_ID }, select: { rubataBoard: true, rubataBoardIndex: true, rubataState: true } })
    const board = Array.isArray(sess?.rubataBoard) ? sess.rubataBoard : []
    const idx = sess?.rubataBoardIndex ?? 0
    const entry = board[idx]
    if (!entry) { console.log(`  Lotto rubata ${i + 1}: board esaurito (idx ${idx}/${board.length}) — stop`); break }
    const ownerId = entry.memberId
    const bidders = USERS.filter(u => u.memberId !== ownerId)
    const offerer = bidders[0]
    console.log(`\n  Lotto rubata ${i + 1}: player ${entry.playerId} di ${byMember[ownerId]?.key} — offerente ${offerer.key}`)

    const off = await call('rubata:offer', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/offer`, offerer.token)
    if (!off.ok) { console.error(`    ⚠️ offer: ${off.status} ${JSON.stringify(off.json)?.slice(0,150)} — skip lotto`); await call('rubata:advance', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/advance`, admin.token); continue }
    await call('rubata:force-ready', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/force-ready`, admin.token)

    const auc = await activeAuction('RUBATA')
    const price = auc?.currentPrice ?? 40
    console.log(`    asta ${auc?.id} prezzo ${price} — 💥 BURST ${bidders.length} offerte simultanee`)
    const burst = await Promise.all(bidders.map((u, k) => call('rubata:bid:burst', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/auction/bid`, u.token, { amount: price + 1 + k })))
    const okc = burst.filter(b => b.ok).length, bad = burst.filter(b => b.status === 400).length, err = burst.filter(b => [500,502,503,429,'TIMEOUT','NETERR'].includes(b.status)).length
    console.log(`    ok:${okc} scarti(400):${bad} ERRORI:${err}`)

    await call('rubata:close', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/close-auction`, admin.token)
    await call('rubata:force-ack', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/force-acknowledge`, admin.token)
    await call('rubata:advance', 'POST', `/api/leagues/${LEAGUE_ID}/rubata/advance`, admin.token)
  }

  // ===================== SVINCOLATI =====================
  console.log('\n===== SVINCOLATI =====')
  await call('phase:svin', 'PUT', `/api/auctions/sessions/${SESSION_ID}/phase`, admin.token, { phase: 'ASTA_SVINCOLATI' })
  await call('svin:turn-order', 'POST', `/api/leagues/${LEAGUE_ID}/svincolati/turn-order`, admin.token, { memberIds: USERS.map(u => u.memberId) })
  await call('svin:timer', 'PUT', `/api/leagues/${LEAGUE_ID}/svincolati/timer`, admin.token, { timerSeconds: 120 })

  // giocatori svincolati (non in rosa)
  const inRoster = new Set((await prisma.playerRoster.findMany({ where: { leagueMember: { leagueId: LEAGUE_ID }, status: 'ACTIVE' }, select: { playerId: true } })).map(r => r.playerId))
  const freeAgents = (await prisma.serieAPlayer.findMany({ where: { isActive: true }, select: { id: true }, take: 200 })).map(p => p.id).filter(id => !inRoster.has(id))

  for (let i = 0; i < SVIN_LOTS; i++) {
    const sess = await prisma.marketSession.findUnique({ where: { id: SESSION_ID }, select: { svincolatiTurnOrder: true, svincolatiCurrentTurnIndex: true, svincolatiState: true } })
    const order = Array.isArray(sess?.svincolatiTurnOrder) ? sess.svincolatiTurnOrder : USERS.map(u => u.memberId)
    const turnIdx = sess?.svincolatiCurrentTurnIndex ?? 0
    const turnMember = order[turnIdx % order.length]
    const nominator = byMember[turnMember] || USERS[0]
    const playerId = freeAgents[i]
    console.log(`\n  Lotto svin ${i + 1}: turno ${nominator.key} nomina ${playerId}`)

    const nom = await call('svin:nominate', 'POST', `/api/leagues/${LEAGUE_ID}/svincolati/nominate`, nominator.token, { playerId })
    if (!nom.ok) { console.error(`    ⚠️ nominate: ${nom.status} ${JSON.stringify(nom.json)?.slice(0,150)} — skip`); continue }
    const conf = await call('svin:confirm', 'PUT', `/api/leagues/${LEAGUE_ID}/svincolati/confirm`, nominator.token)
    // se non auto-partita, forza
    let auc = await activeAuction('FREE_BID')
    if (!auc) { await call('svin:force-ready', 'POST', `/api/leagues/${LEAGUE_ID}/svincolati/force-ready`, admin.token); auc = await activeAuction('FREE_BID') }
    const price = auc?.currentPrice ?? 1
    console.log(`    asta ${auc?.id} prezzo ${price} — 💥 BURST ${USERS.length} offerte simultanee`)
    const burst = await Promise.all(USERS.map((u, k) => call('svin:bid:burst', 'POST', `/api/svincolati/${auc?.id}/bid`, u.token, { amount: price + 1 + k })))
    const okc = burst.filter(b => b.ok).length, bad = burst.filter(b => b.status === 400).length, err = burst.filter(b => [500,502,503,429,'TIMEOUT','NETERR'].includes(b.status)).length
    console.log(`    ok:${okc} scarti(400):${bad} ERRORI:${err}`)

    await call('svin:close-turn', 'PUT', `/api/svincolati/${auc?.id}/close-turn`, admin.token)
    await call('svin:force-ack', 'POST', `/api/leagues/${LEAGUE_ID}/svincolati/force-ack`, admin.token)
  }

  // REPORT
  console.log('\n' + '='.repeat(60) + '\n📊 REPORT METRICHE (Rubata + Svincolati)\n' + '='.repeat(60))
  const byLabel = {}; for (const m of metrics) (byLabel[m.label] ||= []).push(m)
  const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
  console.log('\nlabel'.padEnd(22), 'n'.padStart(3), 'avg'.padStart(7), 'p95'.padStart(7), 'max'.padStart(7), 'errori')
  for (const [label, arr] of Object.entries(byLabel)) {
    const times = arr.map(a => a.ms); const errs = arr.filter(a => !a.ok)
    const avg = Math.round(times.reduce((s, x) => s + x, 0) / times.length)
    console.log(label.padEnd(22), String(arr.length).padStart(3), `${avg}ms`.padStart(7), `${pct(times,0.95)}ms`.padStart(7), `${Math.max(...times)}ms`.padStart(7), errs.length ? `${errs.length} [${[...new Set(errs.map(e=>e.status))].join(',')}]` : '—')
  }
  const hardErr = metrics.filter(m => [500,502,503,429,'TIMEOUT','NETERR'].includes(m.status))
  console.log('\nErrori "di carico" (5xx/429/timeout):', hardErr.length)
  hardErr.forEach(e => console.log(`  - ${e.label}: ${e.status} (${e.ms}ms)`))
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FATAL:', e); await prisma.$disconnect(); process.exit(1) })
