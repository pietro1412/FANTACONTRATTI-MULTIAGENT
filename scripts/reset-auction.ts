import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Reset sessioni asta e dati correlati...\n')

  // Find the league
  const league = await prisma.league.findFirst({
    orderBy: { createdAt: 'desc' }
  })

  if (!league) {
    console.log('❌ Nessuna lega trovata')
    return
  }

  console.log(`Lega: ${league.name}`)

  // Delete all auctions bids
  const deletedBids = await prisma.auctionBid.deleteMany({
    where: {
      auction: { leagueId: league.id }
    }
  })
  console.log(`  Offerte eliminate: ${deletedBids.count}`)

  // Delete all auctions
  const deletedAuctions = await prisma.auction.deleteMany({
    where: { leagueId: league.id }
  })
  console.log(`  Aste eliminate: ${deletedAuctions.count}`)

  // Delete all player rosters
  const deletedRosters = await prisma.playerRoster.deleteMany({
    where: {
      leagueMember: { leagueId: league.id }
    }
  })
  console.log(`  Rose eliminate: ${deletedRosters.count}`)

  // Delete all market sessions
  const deletedSessions = await prisma.marketSession.deleteMany({
    where: { leagueId: league.id }
  })
  console.log(`  Sessioni mercato eliminate: ${deletedSessions.count}`)

  // Delete player movements
  const deletedMovements = await prisma.playerMovement.deleteMany({
    where: { leagueId: league.id }
  })
  console.log(`  Movimenti eliminati: ${deletedMovements.count}`)

  // Reset member budgets
  const resetBudgets = await prisma.leagueMember.updateMany({
    where: { leagueId: league.id },
    data: { currentBudget: league.initialBudget }
  })
  console.log(`  Budget resettati: ${resetBudgets.count} membri a ${league.initialBudget}`)

  // Keep league in ACTIVE status so we can start a new auction
  console.log(`\n✅ Reset completato! La lega "${league.name}" è pronta per una nuova asta.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
