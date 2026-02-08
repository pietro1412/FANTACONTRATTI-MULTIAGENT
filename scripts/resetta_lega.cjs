const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Leggi league ID da argomento CLI
const LEAGUE_ID = process.argv[2]

if (!LEAGUE_ID) {
  console.error('Uso: node scripts/resetta_lega.cjs <league_id>')
  console.error('  oppure: npm run resetta_lega -- <league_id>')
  process.exit(1)
}

async function resetta_lega(leagueId) {
  console.log('=== RESET LEGA A INIZIO PRIMO MERCATO ===\n')
  console.log(`League ID: ${leagueId}\n`)

  // Verifica che la lega esista
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: { where: { status: 'ACTIVE' } }
    }
  })

  if (!league) {
    console.error(`ERRORE: Lega "${leagueId}" non trovata!`)
    process.exit(1)
  }

  console.log(`Lega: ${league.name}`)
  console.log(`Membri attivi: ${league.members.length}`)
  console.log(`Budget iniziale: ${league.initialBudget}`)
  console.log(`\nCancellazione dati...\n`)

  // ===== CANCELLAZIONE IN ORDINE FK =====
  const steps = [
    ['Profezie', () => prisma.prophecy.deleteMany({ where: { leagueId } })],
    ['Contract History', () => prisma.contractHistory.deleteMany({ where: { leagueMember: { leagueId } } })],
    ['Manager Snapshots', () => prisma.managerSessionSnapshot.deleteMany({ where: { leagueMember: { leagueId } } })],
    ['Rubata Preferences', () => prisma.rubataPreference.deleteMany({ where: { session: { leagueId } } })],
    ['Auction Objectives', () => prisma.auctionObjective.deleteMany({ where: { session: { leagueId } } })],
    ['Movimenti giocatori', () => prisma.playerMovement.deleteMany({ where: { leagueId } })],
    ['Auction Ack', () => prisma.auctionAcknowledgment.deleteMany({ where: { auction: { leagueId } } })],
    ['Auction Appeals', () => prisma.auctionAppeal.deleteMany({ where: { auction: { leagueId } } })],
    ['Offerte aste', () => prisma.auctionBid.deleteMany({ where: { auction: { leagueId } } })],
    ['Aste', () => prisma.auction.deleteMany({ where: { leagueId } })],
    ['Draft Contracts', () => prisma.draftContract.deleteMany({ where: { member: { leagueId } } })],
    ['Contratti', () => prisma.playerContract.deleteMany({ where: { leagueMember: { leagueId } } })],
    ['Rose', () => prisma.playerRoster.deleteMany({ where: { leagueMember: { leagueId } } })],
    ['Trade Offers (unlink)', () => prisma.tradeOffer.updateMany({ where: { marketSession: { leagueId }, parentOfferId: { not: null } }, data: { parentOfferId: null } })],
    ['Trade Offers', () => prisma.tradeOffer.deleteMany({ where: { marketSession: { leagueId } } })],
    ['Consolidations', () => prisma.contractConsolidation.deleteMany({ where: { session: { leagueId } } })],
    ['Indemnity Decisions', () => prisma.indemnityDecision.deleteMany({ where: { session: { leagueId } } })],
    ['Session Prizes', () => prisma.sessionPrize.deleteMany({ where: { prizeCategory: { marketSession: { leagueId } } } })],
    ['Prize Categories', () => prisma.prizeCategory.deleteMany({ where: { marketSession: { leagueId } } })],
    ['Prize Phase Configs', () => prisma.prizePhaseConfig.deleteMany({ where: { marketSession: { leagueId } } })],
    ['Premi (legacy)', () => prisma.prize.deleteMany({ where: { leagueId } })],
    ['Chat Messages', () => prisma.chatMessage.deleteMany({ where: { marketSession: { leagueId } } })],
    ['Sessioni mercato', () => prisma.marketSession.deleteMany({ where: { leagueId } })],
  ]

  for (let i = 0; i < steps.length; i++) {
    const [name, fn] = steps[i]
    const result = await fn()
    if (result.count > 0) {
      console.log(`  ${String(i + 1).padStart(2)}. ${name}: ${result.count}`)
    }
  }

  // ===== RESET MEMBRI =====
  const resetBudgets = await prisma.leagueMember.updateMany({
    where: { leagueId },
    data: {
      currentBudget: league.initialBudget,
      preConsolidationBudget: null,
      rubataOrder: null,
    }
  })

  // ===== RESET LEGA =====
  await prisma.league.update({
    where: { id: leagueId },
    data: {
      status: 'ACTIVE',
      currentSeason: 1,
    }
  })

  // ===== RIEPILOGO =====
  console.log('\n=============================================')
  console.log('            RESET COMPLETATO!')
  console.log('=============================================')
  console.log(`  Lega:    ${league.name}`)
  console.log(`  Stato:   ACTIVE | Stagione 1`)
  console.log(`  Budget:  ${league.initialBudget} x ${resetBudgets.count} membri`)
  console.log('  Rose:    vuote')
  console.log('---------------------------------------------')
  for (const m of league.members) {
    console.log(`  ${m.teamName || 'N/A'}`)
  }
  console.log('---------------------------------------------')
  console.log('  Pronto per il PRIMO MERCATO ASSOLUTO')
  console.log('=============================================\n')
}

resetta_lega(LEAGUE_ID)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
