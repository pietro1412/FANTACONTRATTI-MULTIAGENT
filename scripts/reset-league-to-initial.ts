import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LEAGUE_ID = 'cmk9hsvuc00019uhl8r906gee'

async function main() {
  console.log('=== RESET LEAGUE TO INITIAL STATE ===')
  console.log('League ID:', LEAGUE_ID)

  // Get league info
  const league = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: {
      members: true,
      marketSessions: true
    }
  })

  if (!league) {
    console.error('League not found!')
    return
  }

  console.log('League:', league.name)
  console.log('Initial Budget:', league.initialBudget)
  console.log('Current Status:', league.status)
  console.log('Members:', league.members.length)
  console.log('Sessions:', league.marketSessions.length)

  console.log('\n--- Starting reset ---\n')

  // 1. Delete all session prizes (through prizeCategory → marketSession)
  const deletedSessionPrizes = await prisma.sessionPrize.deleteMany({
    where: {
      prizeCategory: { marketSession: { leagueId: LEAGUE_ID } }
    }
  })
  console.log('Deleted SessionPrizes:', deletedSessionPrizes.count)

  // 2. Delete all prize categories
  const deletedPrizeCategories = await prisma.prizeCategory.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted PrizeCategories:', deletedPrizeCategories.count)

  // 3. Delete all prize phase configs
  const deletedPrizeConfigs = await prisma.prizePhaseConfig.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted PrizePhaseConfigs:', deletedPrizeConfigs.count)

  // 3b. Delete all legacy prizes
  const deletedLegacyPrizes = await prisma.prize.deleteMany({
    where: { leagueId: LEAGUE_ID }
  })
  console.log('Deleted Legacy Prizes:', deletedLegacyPrizes.count)

  // 4. Delete all rubata preferences
  const deletedRubataPrefs = await prisma.rubataPreference.deleteMany({
    where: {
      session: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted RubataPreferences:', deletedRubataPrefs.count)

  // 5. Delete all auction acknowledgments
  const deletedAuctionAcks = await prisma.auctionAcknowledgment.deleteMany({
    where: {
      auction: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted AuctionAcknowledgments:', deletedAuctionAcks.count)

  // 6. Delete all auction appeals
  const deletedAppeals = await prisma.auctionAppeal.deleteMany({
    where: {
      auction: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted AuctionAppeals:', deletedAppeals.count)

  // 7. Delete all auction bids
  const deletedBids = await prisma.auctionBid.deleteMany({
    where: {
      auction: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted AuctionBids:', deletedBids.count)

  // 8. Delete all auctions
  const deletedAuctions = await prisma.auction.deleteMany({
    where: { leagueId: LEAGUE_ID }
  })
  console.log('Deleted Auctions:', deletedAuctions.count)

  // 9. Delete all trade offers (TradeOfferPlayer doesn't exist - uses JSON fields)
  const deletedTradeOffers = await prisma.tradeOffer.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted TradeOffers:', deletedTradeOffers.count)

  // 9b. Delete all chat messages
  const deletedChatMessages = await prisma.chatMessage.deleteMany({
    where: {
      marketSession: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted ChatMessages:', deletedChatMessages.count)

  // 10. Delete all player movements
  const deletedMovements = await prisma.playerMovement.deleteMany({
    where: { leagueId: LEAGUE_ID }
  })
  console.log('Deleted PlayerMovements:', deletedMovements.count)

  // 11. Delete all draft contracts
  const deletedDraftContracts = await prisma.draftContract.deleteMany({
    where: {
      session: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted DraftContracts:', deletedDraftContracts.count)

  // 12. Delete all contract consolidations
  const deletedConsolidations = await prisma.contractConsolidation.deleteMany({
    where: {
      session: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted ContractConsolidations:', deletedConsolidations.count)

  // 13. Delete all contracts
  const deletedContracts = await prisma.playerContract.deleteMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted PlayerContracts:', deletedContracts.count)

  // 14. Delete all roster entries (PlayerRoster, not RosterEntry)
  const deletedRosters = await prisma.playerRoster.deleteMany({
    where: {
      leagueMember: { leagueId: LEAGUE_ID }
    }
  })
  console.log('Deleted PlayerRosters:', deletedRosters.count)

  // 15. Delete all market sessions
  const deletedSessions = await prisma.marketSession.deleteMany({
    where: { leagueId: LEAGUE_ID }
  })
  console.log('Deleted MarketSessions:', deletedSessions.count)

  // 16. Reset all member budgets and orders
  const updatedMembers = await prisma.leagueMember.updateMany({
    where: { leagueId: LEAGUE_ID },
    data: {
      currentBudget: league.initialBudget,
      rubataOrder: null,
      firstMarketOrder: null
    }
  })
  console.log('Reset member budgets:', updatedMembers.count)

  // 17. Reset league status to DRAFT
  await prisma.league.update({
    where: { id: LEAGUE_ID },
    data: {
      status: 'DRAFT',
      currentSeason: 1
    }
  })
  console.log('Reset league status to DRAFT')

  console.log('\n=== RESET COMPLETE ===')

  // Verify
  const updatedLeague = await prisma.league.findUnique({
    where: { id: LEAGUE_ID },
    include: {
      members: {
        select: { teamName: true, currentBudget: true, user: { select: { username: true } } }
      },
      marketSessions: true
    }
  })

  console.log('\nVerification:')
  console.log('League Status:', updatedLeague?.status)
  console.log('Sessions:', updatedLeague?.marketSessions.length)
  console.log('Members:')
  updatedLeague?.members.forEach(m => {
    console.log(`  - ${m.teamName || m.user.username}: ${m.currentBudget} credits`)
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
