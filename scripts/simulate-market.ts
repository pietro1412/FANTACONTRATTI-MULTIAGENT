/**
 * Full Visual Market Simulation - Corrected endpoints
 * Usage: npx tsx scripts/simulate-market.ts
 */
import { chromium, type Page } from 'playwright'

const BASE_URL = 'http://localhost:5180'
const API_URL = 'http://localhost:3100'
const LEAGUE_ID = 'cmlbe8xy2000912dx55eqxyd7'

const MEMBERS = {
  pietro:    { email: 'pietro@test.it',    password: 'Pietro2025!',    memberId: 'cmlbe8xy5000c12dxi988u8bo' },
  michele:   { email: 'michele@test.it',   password: 'Michele2025!',   memberId: 'cmlbe8xya000e12dxtdv0caje' },
  mirko:     { email: 'mirko@test.it',     password: 'Mirko2025!',     memberId: 'cmlbe8xyd000g12dxqkmkw0fo' },
  emmanuele: { email: 'emmanuele@test.it', password: 'Emmanuele2025!', memberId: 'cmlbe8xyf000i12dxvq6zqofw' },
  diego:     { email: 'diego@test.it',     password: 'Diego2025!',     memberId: 'cmlbe8xyh000k12dxcsvl014u' },
  marco:     { email: 'marco@test.it',     password: 'Marco2025!',     memberId: 'cmlbe8xyk000m12dxu40bwodk' },
  marcolino: { email: 'marcolino@test.it', password: 'Marcolino2025!', memberId: 'cmlbe8xym000o12dxqoz3lldv' },
  emiliano:  { email: 'emiliano@test.it',  password: 'Emiliano2025!',  memberId: 'cmlbe8xyo000q12dxg7og2war' },
}

function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`) }

async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: email, password }),
  })
  const data = await res.json() as { data?: { accessToken: string } }
  return data.data?.accessToken || ''
}

async function api(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<{ success: boolean; message?: string; data?: unknown }>
}

async function ss(page: Page, name: string) {
  const fs = await import('fs')
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots')
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
}

async function main() {
  log('=== FULL VISUAL SIMULATION ===\n')

  // Login all
  const tokens: Record<string, string> = {}
  for (const [name, m] of Object.entries(MEMBERS)) {
    tokens[name] = await apiLogin(m.email, m.password)
  }
  const T = tokens // shorthand
  log('All 8 users logged in\n')

  // Find active session
  const sessRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const sessions = (sessRes.data || []) as Array<{ type: string; status: string; id: string; currentPhase: string }>
  let active = sessions.find(s => s.status === 'ACTIVE')

  if (!active) {
    log('Creating new mercato ricorrente...')
    const cr = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: true })
    if (!cr.success) { log(`ERROR: ${cr.message}`); return }
    const newSess = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
    active = ((newSess.data || []) as typeof sessions).find(s => s.status === 'ACTIVE')
    if (!active) { log('Cannot find session'); return }
  }
  const SID = active.id
  log(`Session: ${SID} phase: ${active.currentPhase}\n`)

  // Launch browser
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()

  // Browser login
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel(/email o username/i).fill('pietro@test.it')
  await page.getByLabel(/password/i).fill('Pietro2025!')
  await page.getByRole('button', { name: /accedi/i }).click()
  await page.waitForURL(/\/(dashboard|leagues)/, { timeout: 15000 })

  // Helper: go to league page
  const goLeague = async (subpage?: string) => {
    const url = subpage ? `${BASE_URL}/leagues/${LEAGUE_ID}/${subpage}` : `${BASE_URL}/leagues/${LEAGUE_ID}`
    await page.goto(url)
    await page.waitForTimeout(2000)
  }

  // ============================================================
  // PHASE: OFFERTE_PRE_RINNOVO (if current)
  // ============================================================
  if (active.currentPhase === 'OFFERTE_PRE_RINNOVO') {
    log('--- OFFERTE_PRE_RINNOVO ---')

    // Trade: Pietro offers 10M to Michele
    const tradeRes = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/trades`, {
      toMemberId: MEMBERS.michele.memberId,
      offeredPlayerIds: [], requestedPlayerIds: [],
      offeredBudget: 10, requestedBudget: 0,
      message: 'Test: ti mando 10M',
    })
    log(`  Trade Pietro->Michele 10M: ${tradeRes.success ? 'OK' : tradeRes.message}`)

    // Michele accepts
    if (tradeRes.success) {
      const tradeId = (tradeRes.data as { id?: string })?.id
      if (tradeId) {
        const acceptRes = await api(T.michele!, 'PUT', `/trades/${tradeId}/accept`)
        log(`  Michele accepts: ${acceptRes.success ? 'OK' : acceptRes.message}`)
      }
    }

    // Check sent trades
    const sentRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/trades/sent`)
    log(`  Pietro sent trades: ${(sentRes.data as unknown[])?.length || 0}`)

    await goLeague('finanze')
    await ss(page, 'phase1-finanze')

    // Advance
    const adv = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/phase`, { phase: 'PREMI' })
    log(`  -> PREMI: ${adv.message}\n`)
  }

  // ============================================================
  // PHASE: PREMI
  // ============================================================
  const phaseCheck1 = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const currentPhase1 = ((phaseCheck1.data || []) as typeof sessions).find(s => s.id === SID)?.currentPhase

  if (currentPhase1 === 'PREMI') {
    log('--- PREMI ---')
    const initRes = await api(T.pietro!, 'POST', `/sessions/${SID}/prizes/init`)
    log(`  Init: ${initRes.success ? 'OK' : initRes.message}`)

    const finRes = await api(T.pietro!, 'POST', `/sessions/${SID}/prizes/finalize`)
    log(`  Finalize: ${finRes.success ? 'OK' : finRes.message}`)

    const adv = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/phase`, { phase: 'CONTRATTI' })
    log(`  -> CONTRATTI: ${adv.message}\n`)
  }

  // ============================================================
  // PHASE: CONTRATTI (renewal, spalma, release, indemnity, consolidate)
  // ============================================================
  const phaseCheck2 = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const currentPhase2 = ((phaseCheck2.data || []) as typeof sessions).find(s => s.id === SID)?.currentPhase

  if (currentPhase2 === 'CONTRATTI') {
    log('--- CONTRATTI ---')
    await goLeague('contratti')
    await ss(page, 'phase3-contratti')

    // Get Pietro's contracts
    const cRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/contracts`)
    const cData = cRes.data as { contracts?: Array<{ id: string; salary: number; duration: number; canRenew: boolean; canSpalmare: boolean; isExitedPlayer: boolean; exitReason: string | null; roster?: { player?: { name: string } } }> }
    const contracts = cData?.contracts || []
    log(`  Pietro: ${contracts.length} contracts`)

    // Renew first renewable
    const renewable = contracts.find(c => c.canRenew && !c.isExitedPlayer)
    if (renewable) {
      const pName = renewable.roster?.player?.name || '?'
      const renewRes = await api(T.pietro!, 'POST', `/contracts/${renewable.id}/renew`, {
        newSalary: renewable.salary + 2, newDuration: renewable.duration,
      })
      log(`  Renew ${pName} (${renewable.salary}->${renewable.salary+2}): ${renewRes.success ? 'OK' : renewRes.message}`)
    }

    // Spalma first spalmable
    const spalmable = contracts.find(c => c.canSpalmare && !c.isExitedPlayer)
    if (spalmable) {
      const pName = spalmable.roster?.player?.name || '?'
      const spalmaRes = await api(T.pietro!, 'POST', `/contracts/${spalmable.id}/renew`, {
        newSalary: spalmable.salary, newDuration: spalmable.duration + 1, isSpalma: true,
      })
      log(`  Spalma ${pName}: ${spalmaRes.success ? 'OK' : spalmaRes.message}`)
    }

    // Release a non-exit player
    const releasable = contracts.find(c => !c.isExitedPlayer && c.id !== renewable?.id && c.id !== spalmable?.id)
    if (releasable) {
      const pName = releasable.roster?.player?.name || '?'
      const relRes = await api(T.pietro!, 'POST', `/contracts/${releasable.id}/release`)
      log(`  Release ${pName}: ${relRes.success ? 'OK' : relRes.message}`)
    }

    await page.reload()
    await page.waitForTimeout(2000)
    await ss(page, 'phase3-after-operations')

    // Indemnity: check affected players
    log('  --- Indemnity ---')
    await goLeague('indemnity')
    await ss(page, 'phase3-indemnity')

    // Pietro has Ravaglia (ESTERO)
    const indRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/indemnity/my-affected`)
    const indData = indRes.data as { affectedPlayers?: Array<{ roster: { id: string }; exitReason: string; playerName: string }> }
    if (indData?.affectedPlayers?.length) {
      log(`  Pietro affected: ${indData.affectedPlayers.map(p => `${p.playerName}(${p.exitReason})`).join(', ')}`)

      // Submit decisions: RELEASE for ESTERO
      const decisions = indData.affectedPlayers
        .filter(p => p.exitReason !== 'RITIRATO')
        .map(p => ({ rosterId: p.roster.id, decision: 'RELEASE' as const }))

      if (decisions.length > 0) {
        const decRes = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/indemnity/decisions`, { decisions })
        log(`  Pietro decisions: ${decRes.success ? 'OK' : decRes.message}`)
      }
    } else {
      log(`  Pietro: no affected players (data: ${indRes.message || 'empty'})`)
    }

    // Emmanuele has Cavlina (RETROCESSO)
    const indRes2 = await api(T.emmanuele!, 'GET', `/leagues/${LEAGUE_ID}/indemnity/my-affected`)
    const indData2 = indRes2.data as { affectedPlayers?: Array<{ roster: { id: string }; exitReason: string; playerName: string }> }
    if (indData2?.affectedPlayers?.length) {
      log(`  Emmanuele affected: ${indData2.affectedPlayers.map(p => `${p.playerName}(${p.exitReason})`).join(', ')}`)
      const decisions2 = indData2.affectedPlayers
        .filter(p => p.exitReason !== 'RITIRATO')
        .map(p => ({ rosterId: p.roster.id, decision: 'KEEP' as const }))
      if (decisions2.length > 0) {
        const decRes2 = await api(T.emmanuele!, 'POST', `/leagues/${LEAGUE_ID}/indemnity/decisions`, { decisions: decisions2 })
        log(`  Emmanuele decisions (KEEP): ${decRes2.success ? 'OK' : decRes2.message}`)
      }
    }

    // Consolidate ALL managers
    log('  --- Consolidation ---')
    for (const [name, token] of Object.entries(tokens)) {
      const consRes = await api(token, 'POST', `/leagues/${LEAGUE_ID}/contracts/consolidate`, { sessionId: SID })
      log(`    ${name}: ${consRes.success ? 'consolidated' : consRes.message}`)
    }

    await page.reload()
    await page.waitForTimeout(2000)
    await ss(page, 'phase3-after-consolidation')

    // Advance to RUBATA
    const adv = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/phase`, { phase: 'RUBATA' })
    log(`  -> RUBATA: ${adv.message}\n`)
  }

  // ============================================================
  // PHASE: RUBATA
  // ============================================================
  const phaseCheck3 = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const currentPhase3 = ((phaseCheck3.data || []) as typeof sessions).find(s => s.id === SID)?.currentPhase

  if (currentPhase3 === 'RUBATA') {
    log('--- RUBATA ---')
    await goLeague('rubata')
    await page.waitForTimeout(2000)
    await ss(page, 'phase4-rubata')

    // Set rubata order
    const memberIds = Object.values(MEMBERS).map(m => m.memberId)
    const orderRes = await api(T.pietro!, 'PUT', `/leagues/${LEAGUE_ID}/rubata/order`, { order: memberIds })
    log(`  Set order: ${orderRes.success ? 'OK' : orderRes.message}`)

    // Generate board
    const boardGen = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/rubata/board/generate`)
    log(`  Generate board: ${boardGen.success ? 'OK' : boardGen.message}`)

    // Start rubata
    const startRes = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/rubata/start`)
    log(`  Start: ${startRes.success ? 'OK' : startRes.message}`)

    // Check status
    const statusRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/rubata/status`)
    log(`  Status: ${statusRes.success ? 'OK' : statusRes.message}`)

    await page.reload()
    await page.waitForTimeout(2000)
    await ss(page, 'phase4-rubata-active')

    // Advance to SVINCOLATI
    const adv = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/phase`, { phase: 'ASTA_SVINCOLATI' })
    log(`  -> ASTA_SVINCOLATI: ${adv.message}\n`)
  }

  // ============================================================
  // PHASE: ASTA_SVINCOLATI
  // ============================================================
  const phaseCheck4 = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const currentPhase4 = ((phaseCheck4.data || []) as typeof sessions).find(s => s.id === SID)?.currentPhase

  if (currentPhase4 === 'ASTA_SVINCOLATI') {
    log('--- ASTA_SVINCOLATI ---')
    await goLeague('svincolati')
    await page.waitForTimeout(2000)
    await ss(page, 'phase5-svincolati')

    // Set turn order (reverse of rubata)
    const reverseOrder = Object.values(MEMBERS).map(m => m.memberId).reverse()
    const orderRes = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/svincolati/turn-order`, { order: reverseOrder })
    log(`  Turn order: ${orderRes.success ? 'OK' : orderRes.message}`)

    // Get state
    const stateRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/svincolati`)
    log(`  State: ${stateRes.success ? 'OK' : stateRes.message}`)

    // Test pass (last manager passes)
    const passRes = await api(T.pietro!, 'POST', `/leagues/${LEAGUE_ID}/svincolati/pass`)
    log(`  Pietro pass: ${passRes.success ? 'OK' : passRes.message}`)

    // Test that passed member can't bid (our gap-analysis fix!)
    // First need an active auction to test against
    const boardRes = await api(T.pietro!, 'GET', `/leagues/${LEAGUE_ID}/svincolati/board`)
    log(`  Board: ${boardRes.success ? 'OK' : boardRes.message}`)

    await page.reload()
    await page.waitForTimeout(2000)
    await ss(page, 'phase5-svincolati-state')

    // Advance to OFFERTE_POST
    const adv = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/phase`, { phase: 'OFFERTE_POST_ASTA_SVINCOLATI' })
    log(`  -> OFFERTE_POST: ${adv.message}\n`)
  }

  // ============================================================
  // PHASE: OFFERTE_POST + CLOSE
  // ============================================================
  log('--- FINAL ---')
  await goLeague()
  await ss(page, 'phase6-offerte-post')

  const closeRes = await api(T.pietro!, 'PUT', `/auctions/sessions/${SID}/close`)
  log(`Close session: ${closeRes.message}`)

  // ============================================================
  // VERIFICATION
  // ============================================================
  log('\n--- VERIFICATION ---')
  await goLeague('storico')
  await page.waitForTimeout(2000)
  await ss(page, 'final-storico')

  await goLeague('finanze')
  await page.waitForTimeout(2000)
  await ss(page, 'final-finanze')

  await goLeague('contratti')
  await page.waitForTimeout(2000)
  await ss(page, 'final-contratti')

  await goLeague()
  await ss(page, 'final-league')

  // Log summary
  const logRes = await fetch(`${API_URL}/api/logs/recent?sinceMinutes=30&limit=2000`, {
    headers: { 'x-cron-secret': 'fantacontratti-beta-cron-2026' },
  })
  const logData = await logRes.json() as { data?: { logs: Array<{ severity: string; message: string; statusCode: number | null }> } }
  const logs = logData.data?.logs || []
  const errors = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL')
  const warns500 = logs.filter(l => l.statusCode !== null && l.statusCode >= 500)

  log('\n=== SUMMARY ===')
  log(`  Total logs: ${logs.length}`)
  log(`  Errors: ${errors.length}`)
  log(`  5xx responses: ${warns500.length}`)
  if (errors.length) errors.slice(0, 5).forEach(e => log(`    ${e.message}`))
  if (warns500.length) warns500.slice(0, 5).forEach(w => log(`    500: ${w.message}`))

  log('\n  Browser open 15s for review...')
  await page.waitForTimeout(15000)
  await browser.close()
  log('Done!')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
