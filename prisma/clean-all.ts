import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanAll() {
  console.log('Pulizia dati in corso...')

  // 1. Delete all prophecies
  const prophecies = await prisma.prophecy.deleteMany({})
  console.log('Prophecies eliminate:', prophecies.count)

  // 2. Delete all auction acknowledgments
  const acks = await prisma.auctionAcknowledgment.deleteMany({})
  console.log('Acknowledgments eliminati:', acks.count)

  // 3. Delete all auction bids
  const bids = await prisma.auctionBid.deleteMany({})
  console.log('Bids eliminate:', bids.count)

  // 4. Delete all auctions
  const auctions = await prisma.auction.deleteMany({})
  console.log('Auctions eliminate:', auctions.count)

  // 5. Delete all player movements
  const movements = await prisma.playerMovement.deleteMany({})
  console.log('Movements eliminati:', movements.count)

  // 6. Delete all player contracts
  const contracts = await prisma.playerContract.deleteMany({})
  console.log('Contracts eliminati:', contracts.count)

  // 7. Delete all player roster entries
  const rosters = await prisma.playerRoster.deleteMany({})
  console.log('Roster entries eliminate:', rosters.count)

  // 8. Delete all market sessions
  const sessions = await prisma.marketSession.deleteMany({})
  console.log('Market sessions eliminate:', sessions.count)

  // 9. Delete all SerieA players
  const players = await prisma.serieAPlayer.deleteMany({})
  console.log('SerieA players eliminati:', players.count)

  // 10. Reset member budgets to initial budget
  const leagues = await prisma.league.findMany({
    include: { members: true }
  })

  for (const league of leagues) {
    await prisma.leagueMember.updateMany({
      where: { leagueId: league.id },
      data: { currentBudget: league.initialBudget }
    })
  }
  console.log('Budget membri resettati')

  // 11. Reset league status to DRAFT
  const leagueReset = await prisma.league.updateMany({
    data: { status: 'DRAFT' }
  })
  console.log('Leghe resettate a DRAFT:', leagueReset.count)

  console.log('')
  console.log('✅ Pulizia completata! Ora puoi caricare il file quotazioni.')
}

cleanAll()
  .catch((e) => {
    console.error('Errore:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
