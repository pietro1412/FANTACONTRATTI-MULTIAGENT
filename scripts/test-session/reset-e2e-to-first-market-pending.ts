/**
 * Sessione test 2026-06-09 — RESET della "Lega test E2E" allo stato
 * "rose da creare, Primo Mercato DA AVVIARE".
 *
 * Obiettivo: riportare la lega esattamente come una lega appena diventata ACTIVE,
 * pronta perché l'admin entri nella sala asta del Primo Mercato e PREMA il bottone
 * "Avvia Primo Mercato" (= definizione ordine turni → prima nomination).
 *
 * Stato target (determinato dal codice di produzione, non inventato):
 *  - Il Primo Mercato si "avvia" quando l'admin chiama setFirstMarketTurnOrder
 *    (src/services/auction.service.ts:1776), che imposta session.turnOrder + currentTurnIndex=0
 *    + currentRole='P' e fa partire l'asta (triggerAuctionStarted).
 *  - Il frontend (src/hooks/useAuctionRoomState.ts:252) distingue gli stati con
 *    `hasTurnOrder = firstMarketStatus.turnOrder && turnOrder.length > 0`:
 *      • turnOrder VUOTO/null  → "da avviare": l'admin vede il pannello ordine turni
 *        + bottone "Avvia Primo Mercato".
 *      • turnOrder presente    → "in corso": l'asta procede.
 *  - Quindi lo stato "da avviare" = MarketSession PRIMO_MERCATO, status ACTIVE,
 *    currentPhase ASTA_LIBERA, turnOrder=null, currentTurnIndex=null, currentRole=null,
 *    nessun pending nomination / ready / nominatorConfirmed.
 *
 * NB: la funzione di produzione resetFirstMarket (admin.service.ts:240) NON azzera
 * turnOrder (mantiene l'ordine già scelto, currentTurnIndex=0): è un reset "ricomincia
 * con lo stesso ordine". Qui il target richiesto è "DA AVVIARE da capo", quindi azzeriamo
 * anche turnOrder così da far ricomparire il bottone "Avvia Primo Mercato".
 *
 * Idempotente: rieseguibile senza effetti collaterali. Opera SOLO sulla lega E2E.
 * NON tocca codice di produzione. NON tocca altre leghe.
 *
 * Run: bash scripts/with-env.sh .env.local npx tsx scripts/test-session/reset-e2e-to-first-market-pending.ts
 */
import { PrismaClient, Prisma, MemberStatus, SessionStatus, MarketPhase } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmq3eqxpf06p7xt0cjcjil3qe'

async function main() {
  console.log('=== RESET LEGA E2E → PRIMO MERCATO DA AVVIARE ===')
  console.log('League ID:', LEAGUE_ID)

  const league = await prisma.league.findUnique({ where: { id: LEAGUE_ID } })
  if (!league) {
    console.log('ERRORE: lega non trovata. Interrompo.')
    return
  }
  if (league.name && !/e2e/i.test(league.name)) {
    // Guard di sicurezza: ci aspettiamo la lega di test E2E. Avvisa ma procedi solo sull'ID dato.
    console.log(`ATTENZIONE: la lega "${league.name}" non contiene "E2E" nel nome. Procedo solo sull'ID hardcoded.`)
  }
  console.log(`Lega "${league.name}" status=${league.status} initialBudget=${league.initialBudget}`)

  // Individua la sessione PRIMO_MERCATO (target da riportare a "da avviare").
  const firstMarket = await prisma.marketSession.findFirst({
    where: { leagueId: LEAGUE_ID, type: 'PRIMO_MERCATO' },
    orderBy: { createdAt: 'desc' },
  })
  if (!firstMarket) {
    console.log('ERRORE: nessuna sessione PRIMO_MERCATO nella lega. Interrompo (non invento stato).')
    return
  }
  const allSessions = await prisma.marketSession.findMany({
    where: { leagueId: LEAGUE_ID },
    select: { id: true, type: true },
  })
  console.log(`Sessione PRIMO_MERCATO: ${firstMarket.id}. Sessioni totali nella lega: ${allSessions.length}`)

  // ---------------------------------------------------------------------------
  // 1. CANCELLAZIONE dati derivati. Ordine pensato per rispettare le foreign key.
  //    Tutti i filtri sono ancorati alla lega/sessione E2E.
  // ---------------------------------------------------------------------------

  const appeals = await prisma.auctionAppeal.deleteMany({ where: { auction: { leagueId: LEAGUE_ID } } })
  console.log('Deleted AuctionAppeals:', appeals.count)

  const acks = await prisma.auctionAcknowledgment.deleteMany({ where: { auction: { leagueId: LEAGUE_ID } } })
  console.log('Deleted AuctionAcknowledgments:', acks.count)

  const bids = await prisma.auctionBid.deleteMany({ where: { auction: { leagueId: LEAGUE_ID } } })
  console.log('Deleted AuctionBids:', bids.count)

  // Prophecy referenzia l'auction (auctionId) → cancellare prima delle auction.
  const prophecies = await prisma.prophecy.deleteMany({ where: { leagueId: LEAGUE_ID } })
  console.log('Deleted Prophecies:', prophecies.count)

  // PlayerMovement referenzia auctionId → cancellare prima delle auction.
  const movements = await prisma.playerMovement.deleteMany({ where: { leagueId: LEAGUE_ID } })
  console.log('Deleted PlayerMovements:', movements.count)

  const auctions = await prisma.auction.deleteMany({ where: { leagueId: LEAGUE_ID } })
  console.log('Deleted Auctions:', auctions.count)

  // Eventi storici contratti + snapshot finanziari legati alle sessioni della lega.
  const history = await prisma.contractHistory.deleteMany({ where: { marketSession: { leagueId: LEAGUE_ID } } })
  console.log('Deleted ContractHistory:', history.count)

  const snapshots = await prisma.managerSessionSnapshot.deleteMany({ where: { marketSession: { leagueId: LEAGUE_ID } } })
  console.log('Deleted ManagerSessionSnapshots:', snapshots.count)

  // Dati di fase non-primo-mercato che potrebbero esistere su sessioni della lega.
  const consolidations = await prisma.contractConsolidation.deleteMany({ where: { session: { leagueId: LEAGUE_ID } } })
  console.log('Deleted ContractConsolidations:', consolidations.count)

  const indemnities = await prisma.indemnityDecision.deleteMany({ where: { session: { leagueId: LEAGUE_ID } } })
  console.log('Deleted IndemnityDecisions:', indemnities.count)

  const objectives = await prisma.auctionObjective.deleteMany({ where: { session: { leagueId: LEAGUE_ID } } })
  console.log('Deleted AuctionObjectives:', objectives.count)

  const drafts = await prisma.draftContract.deleteMany({ where: { session: { leagueId: LEAGUE_ID } } })
  console.log('Deleted DraftContracts:', drafts.count)

  // PlayerContract referenzia il roster → cancellare prima dei roster.
  const contracts = await prisma.playerContract.deleteMany({
    where: { roster: { leagueMember: { leagueId: LEAGUE_ID } } },
  })
  console.log('Deleted PlayerContracts:', contracts.count)

  const rosters = await prisma.playerRoster.deleteMany({
    where: { leagueMember: { leagueId: LEAGUE_ID } },
  })
  console.log('Deleted PlayerRosters:', rosters.count)

  // ---------------------------------------------------------------------------
  // 2. BUDGET: ripristina currentBudget = initialBudget per tutti i membri ACTIVE.
  //    teamName, role e firstMarketOrder restano invariati (non li tocchiamo).
  // ---------------------------------------------------------------------------
  const budgets = await prisma.leagueMember.updateMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    data: { currentBudget: league.initialBudget },
  })
  console.log('Reset budgets (membri ACTIVE):', budgets.count)

  // ---------------------------------------------------------------------------
  // 3. SESSIONE: riporta la PRIMO_MERCATO allo stato "DA AVVIARE".
  //    - status ACTIVE, currentPhase ASTA_LIBERA (la sola fase del Primo Mercato)
  //    - turnOrder/currentTurnIndex/currentRole azzerati → frontend mostra
  //      il pannello ordine turni + bottone "Avvia Primo Mercato"
  //    - nessun pending nomination / nominatorConfirmed / readyMembers
  // ---------------------------------------------------------------------------
  await prisma.marketSession.update({
    where: { id: firstMarket.id },
    data: {
      status: SessionStatus.ACTIVE,
      currentPhase: MarketPhase.ASTA_LIBERA,
      turnOrder: Prisma.JsonNull,
      currentTurnIndex: null,
      currentRole: null,
      pendingNominationPlayerId: null,
      pendingNominatorId: null,
      nominatorConfirmed: false,
      readyMembers: Prisma.JsonNull,
      endsAt: null,
      phaseStartedAt: null,
    },
  })
  console.log('Sessione PRIMO_MERCATO riportata a "da avviare".')

  // ---------------------------------------------------------------------------
  // RIEPILOGO DI VERIFICA
  // ---------------------------------------------------------------------------
  console.log('\n=== VERIFICA ===')

  const rosterCount = await prisma.playerRoster.count({ where: { leagueMember: { leagueId: LEAGUE_ID } } })
  const contractCount = await prisma.playerContract.count({ where: { roster: { leagueMember: { leagueId: LEAGUE_ID } } } })
  const auctionCount = await prisma.auction.count({ where: { leagueId: LEAGUE_ID } })
  const movementCount = await prisma.playerMovement.count({ where: { leagueId: LEAGUE_ID } })
  console.log(`Rose: ${rosterCount} (atteso 0)  Contratti: ${contractCount} (atteso 0)  Aste: ${auctionCount} (atteso 0)  Movimenti: ${movementCount} (atteso 0)`)

  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: MemberStatus.ACTIVE },
    include: { user: { select: { username: true } } },
    orderBy: { firstMarketOrder: 'asc' },
  })
  console.log('\nMembri ACTIVE (budget atteso = ' + league.initialBudget + '):')
  let allBudgetsOk = true
  for (const m of members) {
    const ok = m.currentBudget === league.initialBudget
    if (!ok) allBudgetsOk = false
    console.log(`  ${m.role.padEnd(7)} ${m.user.username.padEnd(11)} budget=${m.currentBudget} ${ok ? 'OK' : '!! ATTESO ' + league.initialBudget} team="${m.teamName}" firstMarketOrder=${m.firstMarketOrder}`)
  }

  const session = await prisma.marketSession.findUnique({ where: { id: firstMarket.id } })
  const turnOrderArr = session?.turnOrder as string[] | null
  console.log('\nSessione PRIMO_MERCATO:')
  console.log(`  status=${session?.status} phase=${session?.currentPhase} turnOrder=${JSON.stringify(turnOrderArr)} currentTurnIndex=${session?.currentTurnIndex} currentRole=${session?.currentRole}`)
  console.log(`  pendingNomination=${session?.pendingNominationPlayerId} nominatorConfirmed=${session?.nominatorConfirmed} readyMembers=${JSON.stringify(session?.readyMembers)}`)

  const leagueAfter = await prisma.league.findUnique({ where: { id: LEAGUE_ID }, select: { status: true } })

  const hasTurnOrder = Array.isArray(turnOrderArr) && turnOrderArr.length > 0
  const ready =
    rosterCount === 0 &&
    contractCount === 0 &&
    auctionCount === 0 &&
    movementCount === 0 &&
    allBudgetsOk &&
    members.length === 8 &&
    leagueAfter?.status === 'ACTIVE' &&
    session?.status === 'ACTIVE' &&
    session?.currentPhase === 'ASTA_LIBERA' &&
    !hasTurnOrder

  console.log('\n=== ESITO ===')
  if (ready) {
    console.log('OK: lega ACTIVE, rose/contratti/aste/movimenti = 0, budget tutti a ' + league.initialBudget + ',')
    console.log('    sessione PRIMO_MERCATO ACTIVE/ASTA_LIBERA senza turnOrder → PRONTA PER AVVIARE IL PRIMO MERCATO.')
  } else {
    console.log('ATTENZIONE: una o più condizioni del target non sono soddisfatte (vedi sopra).')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
