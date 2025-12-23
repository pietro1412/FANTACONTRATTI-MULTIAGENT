import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixDuplicateSessions() {
  console.log('Checking for duplicate PRIMO_MERCATO sessions...\n')

  // Get all leagues
  const leagues = await prisma.league.findMany({
    select: { id: true, name: true }
  })

  for (const league of leagues) {
    // Find all PRIMO_MERCATO sessions for this league
    const primoMercatoSessions = await prisma.marketSession.findMany({
      where: {
        leagueId: league.id,
        type: 'PRIMO_MERCATO',
      },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`League "${league.name}": ${primoMercatoSessions.length} PRIMO_MERCATO sessions`)

    if (primoMercatoSessions.length > 1) {
      console.log('  -> Found duplicates! Keeping the first one, deleting the rest...')

      // Keep the first one, delete the rest
      const toDelete = primoMercatoSessions.slice(1)

      for (const session of toDelete) {
        console.log(`  -> Deleting session ${session.id} (status: ${session.status})`)

        // Delete related auctions first (and their bids/acknowledgments)
        const auctions = await prisma.auction.findMany({
          where: { marketSessionId: session.id },
          select: { id: true }
        })

        for (const auction of auctions) {
          await prisma.auctionAcknowledgment.deleteMany({
            where: { auctionId: auction.id }
          })
          await prisma.auctionBid.deleteMany({
            where: { auctionId: auction.id }
          })
        }

        await prisma.auction.deleteMany({
          where: { marketSessionId: session.id }
        })

        // Delete the session
        await prisma.marketSession.delete({
          where: { id: session.id }
        })
      }

      console.log('  -> Duplicates removed!')
    }
  }

  // Show final state
  console.log('\n--- Final State ---')
  const allSessions = await prisma.marketSession.findMany({
    include: { league: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  for (const session of allSessions) {
    console.log(`${session.league.name}: ${session.type} - ${session.status}`)
  }
}

fixDuplicateSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
