/**
 * Full Market Simulation via API
 *
 * Step 1: Create primo mercato session
 * Step 2: Use complete-all-slots to fill rosters (fast)
 * Step 3: Manual auctions for a few players (generates bid logs)
 * Step 4: Close primo mercato
 *
 * Usage: npx tsx scripts/run-full-simulation.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3100'
const LEAGUE_ID = 'cmlbe8xy2000912dx55eqxyd7'

interface AuthInfo { token: string; email: string; memberId: string }

const USERS = [
  { email: 'pietro@test.it', password: 'Pietro2025!', memberId: 'cmlbe8xy5000c12dxi988u8bo' },
  { email: 'michele@test.it', password: 'Michele2025!', memberId: 'cmlbe8xya000e12dxtdv0caje' },
  { email: 'mirko@test.it', password: 'Mirko2025!', memberId: 'cmlbe8xyd000g12dxqkmkw0fo' },
  { email: 'emmanuele@test.it', password: 'Emmanuele2025!', memberId: 'cmlbe8xyf000i12dxvq6zqofw' },
  { email: 'diego@test.it', password: 'Diego2025!', memberId: 'cmlbe8xyh000k12dxcsvl014u' },
  { email: 'marco@test.it', password: 'Marco2025!', memberId: 'cmlbe8xyk000m12dxu40bwodk' },
  { email: 'marcolino@test.it', password: 'Marcolino2025!', memberId: 'cmlbe8xym000o12dxqoz3lldv' },
  { email: 'emiliano@test.it', password: 'Emiliano2025!', memberId: 'cmlbe8xyo000q12dxg7og2war' },
]

async function api(token: string, method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<{ success: boolean; message?: string; data?: unknown }>
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: email, password }),
  })
  const data = await res.json() as { success: boolean; data?: { accessToken: string } }
  if (!data.success || !data.data) throw new Error(`Login failed: ${email}`)
  return data.data.accessToken
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

async function main() {
  log('=== FULL MARKET SIMULATION ===\n')

  // 1. Login all users
  log('Step 1: Login all users...')
  const auth: AuthInfo[] = []
  for (const u of USERS) {
    const token = await login(u.email, u.password)
    auth.push({ token, email: u.email, memberId: u.memberId })
  }
  const admin = auth[0]!
  log(`  ${auth.length} users logged in\n`)

  // 2. Check current state
  const sessRes = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const sessions = (sessRes.data || []) as Array<{ type: string; status: string; id: string; currentPhase: string }>

  const completedPrimo = sessions.find(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  if (completedPrimo) {
    log('Primo mercato already completed! Moving to mercato ricorrente...\n')
    await simulateMercatoRicorrente(admin, auth, sessions)
    await printLogSummary()
    return
  }

  let activePrimo = sessions.find(s => s.type === 'PRIMO_MERCATO' && s.status === 'ACTIVE')
  let sessionId: string

  if (activePrimo) {
    sessionId = activePrimo.id
    log(`Primo mercato already active: ${sessionId}\n`)
  } else {
    // Create primo mercato
    log('Step 2: Creating primo mercato session...')
    const createRes = await api(admin.token, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: false })
    if (!createRes.success) {
      log(`  ERROR: ${createRes.message}`)
      return
    }
    const createData = createRes.data as { session?: { id: string } }
    sessionId = createData?.session?.id || ''
    if (!sessionId) {
      // Re-fetch sessions
      const newSess = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
      const active = ((newSess.data || []) as typeof sessions).find(s => s.status === 'ACTIVE')
      if (!active) { log('  Cannot find active session'); return }
      sessionId = active.id
    }
    log(`  Session created: ${sessionId}\n`)
  }

  // 3. Use complete-all-slots to fill rosters fast
  log('Step 3: Filling all roster slots (complete-all-slots)...')
  const completeRes = await api(admin.token, 'POST', `/auctions/sessions/${sessionId}/complete-all-slots`)
  if (completeRes.success) {
    const data = completeRes.data as { totalAuctions?: number; message?: string }
    log(`  ${completeRes.message}`)
    log(`  Auctions created: ${data?.totalAuctions || 'unknown'}\n`)
  } else {
    log(`  complete-all-slots failed: ${completeRes.message}`)
    log('  Trying manual auctions instead...\n')
    await simulateManualAuctions(admin, auth, sessionId)
  }

  // 4. Check rosters
  log('Step 4: Checking rosters...')
  for (const a of auth) {
    const rosterRes = await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/roster`)
    const roster = rosterRes.data as { roster?: Array<unknown> } | Array<unknown>
    const count = Array.isArray(roster) ? roster.length : (roster as { roster?: Array<unknown> })?.roster?.length || 0
    log(`  ${a.email.split('@')[0]}: ${count} players`)
  }

  // 5. Check budgets
  log('\nStep 5: Checking budgets...')
  const finRes = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/financials`)
  if (finRes.success) {
    const finData = finRes.data as { teams?: Array<{ teamName: string; budget: number; annualContractCost: number; slotCount: number }> }
    for (const t of finData?.teams || []) {
      log(`  ${t.teamName}: budget ${t.budget}M, ingaggi ${t.annualContractCost}M, ${t.slotCount} giocatori`)
    }
  }

  // 6. Various API calls to generate diverse logs
  log('\nStep 6: Generating diverse log patterns...')
  // Each manager checks their roster, financials, movements
  for (const a of auth) {
    await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/roster`)
    await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/financials`)
    await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/movements?limit=5`)
    await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/contracts`)
  }
  // Invalid operations
  await api(auth[1]!.token, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: true }) // non-admin
  await api(admin.token, 'GET', `/leagues/invalid-league/financials`)
  await api('bad-token', 'GET', `/leagues/${LEAGUE_ID}`)
  log('  Done\n')

  // 7. Try to advance to mercato ricorrente
  log('Step 7: Checking if we can start mercato ricorrente...')
  const sessCheck = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const updatedSessions = (sessCheck.data || []) as typeof sessions
  const primoCompleted = updatedSessions.find(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  if (primoCompleted) {
    log('  Primo mercato completed! Starting mercato ricorrente...\n')
    await simulateMercatoRicorrente(admin, auth, updatedSessions)
  } else {
    const primoActive = updatedSessions.find(s => s.type === 'PRIMO_MERCATO' && s.status === 'ACTIVE')
    log(`  Primo mercato still active (phase: ${primoActive?.currentPhase || 'unknown'})`)
    log('  Attempting to close it...')
    // Try setting phase to end
    const advRes = await api(admin.token, 'POST', `/auctions/sessions/${sessionId}/advance-phase`)
    log(`  Advance phase: ${advRes.message || advRes.success}\n`)
  }

  await printLogSummary()
}

async function simulateManualAuctions(admin: AuthInfo, auth: AuthInfo[], sessionId: string) {
  log('  Running manual auctions for 10 players...')
  const freeRes = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/free-agents`)
  const players = ((freeRes.data || []) as Array<{ id: string; name: string; position: string }>).slice(0, 10)

  for (const player of players) {
    // Start auction
    const startRes = await api(admin.token, 'POST', `/leagues/${LEAGUE_ID}/free-agents/auction`, { playerId: player.id })
    if (!startRes.success) { log(`    Skip ${player.name}: ${startRes.message}`); continue }

    const auctionId = ((startRes.data as Record<string, unknown>)?.auction as Record<string, unknown>)?.id as string
    if (!auctionId) continue

    // 2 bids
    for (let b = 0; b < 2; b++) {
      const bidder = auth[(b + 1) % auth.length]!
      await api(bidder.token, 'POST', `/leagues/${LEAGUE_ID}/auction/bid`, { auctionId, amount: 2 + b })
    }

    // Close
    const closeRes = await api(admin.token, 'POST', `/leagues/${LEAGUE_ID}/free-agents/auction/${auctionId}/close`)
    log(`    ${player.name}: ${closeRes.success ? 'OK' : closeRes.message}`)
  }
}

async function simulateMercatoRicorrente(admin: AuthInfo, auth: AuthInfo[], sessions: Array<{ type: string; status: string; id: string; currentPhase: string }>) {
  log('=== MERCATO RICORRENTE ===\n')

  let activeRicorrente = sessions.find(s => s.type === 'MERCATO_RICORRENTE' && s.status === 'ACTIVE')

  if (!activeRicorrente) {
    log('Creating mercato ricorrente session...')
    const createRes = await api(admin.token, 'POST', `/leagues/${LEAGUE_ID}/auctions`, { isRegularMarket: true })
    if (!createRes.success) {
      log(`  ERROR: ${createRes.message}`)
      return
    }
    log(`  Created: ${createRes.message}`)

    const newSess = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
    activeRicorrente = ((newSess.data || []) as typeof sessions).find(s => s.type === 'MERCATO_RICORRENTE' && s.status === 'ACTIVE')
    if (!activeRicorrente) { log('  Cannot find active ricorrente session'); return }
  }

  const sessionId = activeRicorrente.id
  log(`Session: ${sessionId}, Phase: ${activeRicorrente.currentPhase}\n`)

  // Advance through phases, doing operations at each one
  const phases = ['OFFERTE_PRE_RINNOVO', 'PREMI', 'CONTRATTI', 'RUBATA', 'ASTA_SVINCOLATI', 'OFFERTE_POST_ASTA_SVINCOLATI']

  for (const targetPhase of phases) {
    // Check current phase
    const sessCheck = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
    const current = ((sessCheck.data || []) as typeof sessions).find(s => s.id === sessionId)
    if (!current || current.status !== 'ACTIVE') {
      log(`Session no longer active (${current?.status || 'gone'})`)
      break
    }

    log(`--- Phase: ${current.currentPhase} ---`)

    // Do phase-specific operations
    if (current.currentPhase === 'OFFERTE_PRE_RINNOVO') {
      // All managers check financials
      for (const a of auth) {
        await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/financials`)
        await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/contracts`)
      }
      log('  All managers checked financials')
    }

    if (current.currentPhase === 'PREMI') {
      // Admin init prizes
      const prizeInit = await api(admin.token, 'POST', `/sessions/${sessionId}/prizes/init`)
      log(`  Prize init: ${prizeInit.message || prizeInit.success}`)
    }

    if (current.currentPhase === 'CONTRATTI') {
      // Managers check contracts
      for (const a of auth) {
        await api(a.token, 'GET', `/leagues/${LEAGUE_ID}/contracts`)
      }
      log('  All managers checked contracts')
    }

    // Try to advance phase
    log(`  Advancing from ${current.currentPhase}...`)
    const advRes = await api(admin.token, 'POST', `/auctions/sessions/${sessionId}/advance-phase`)
    if (advRes.success) {
      log(`  -> Advanced: ${advRes.message}`)
    } else {
      log(`  -> Cannot advance: ${advRes.message}`)
      // Try force advance or break
      break
    }
  }

  // Final state
  const finalCheck = await api(admin.token, 'GET', `/leagues/${LEAGUE_ID}/auctions`)
  const finalSession = ((finalCheck.data || []) as typeof sessions).find(s => s.id === sessionId)
  log(`\nFinal state: ${finalSession?.currentPhase || 'unknown'} (${finalSession?.status || 'unknown'})`)
}

async function printLogSummary() {
  const logRes = await fetch(`${API_URL}/api/logs/recent?sinceMinutes=60&limit=2000`, {
    headers: { 'x-cron-secret': 'fantacontratti-beta-cron-2026' },
  })
  const logData = await logRes.json() as { data?: { count: number; logs: Array<{ severity: string; message: string; statusCode: number | null }> } }
  const logs = logData.data?.logs || []
  const bySev: Record<string, number> = {}
  logs.forEach(l => { bySev[l.severity] = (bySev[l.severity] || 0) + 1 })
  const errors = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL')

  log('\n=== LOG SUMMARY ===')
  log(`  Total: ${logs.length}`)
  log(`  By severity: ${JSON.stringify(bySev)}`)
  if (errors.length > 0) {
    log(`  ERRORS (${errors.length}):`)
    errors.slice(0, 10).forEach(e => log(`    ${e.severity}: ${e.message}`))
  }
  log('=== DONE ===')
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
