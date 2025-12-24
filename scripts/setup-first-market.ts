/**
 * Script to setup the PRIMO MERCATO (ASTA_LIBERA) phase for testing
 * Run with: npx tsx scripts/setup-first-market.ts
 */
import { PrismaClient, MarketPhase, SessionStatus, MarketType, Position } from '@prisma/client'

const prisma = new PrismaClient()

async function setupFirstMarket() {
  try {
    // Find the league
    const league = await prisma.league.findFirst({
      where: { name: 'Lega Fantacontratti 2025' }
    })

    if (!league) {
      console.error('League not found!')
      return
    }

    console.log(`Found league: ${league.name} (${league.id})`)

    // Get all active members
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: { user: { select: { username: true } } },
      orderBy: { joinedAt: 'asc' }
    })

    if (members.length < 2) {
      console.error('Need at least 2 members!')
      return
    }

    console.log(`\nFound ${members.length} members`)

    // Create turn order (member IDs in order)
    const turnOrder = members.map(m => m.id)
    console.log('Turn order:', members.map(m => m.user.username).join(' → '))

    // Check for existing active session
    let session = await prisma.marketSession.findFirst({
      where: { leagueId: league.id, status: SessionStatus.ACTIVE }
    })

    if (session) {
      // Update existing session
      session = await prisma.marketSession.update({
        where: { id: session.id },
        data: {
          type: MarketType.PRIMO_MERCATO,
          currentPhase: MarketPhase.ASTA_LIBERA,
          currentRole: Position.P, // Start with goalkeepers
          turnOrder: turnOrder,
          currentTurnIndex: 0,
          auctionTimerSeconds: 5,
        }
      })
      console.log(`\nUpdated existing session to ASTA_LIBERA phase`)
    } else {
      // Create new market session
      session = await prisma.marketSession.create({
        data: {
          leagueId: league.id,
          type: MarketType.PRIMO_MERCATO,
          season: 1,
          semester: 1,
          status: SessionStatus.ACTIVE,
          currentPhase: MarketPhase.ASTA_LIBERA,
          currentRole: Position.P, // Start with goalkeepers
          turnOrder: turnOrder,
          currentTurnIndex: 0,
          auctionTimerSeconds: 5,
          startsAt: new Date(),
        }
      })
      console.log(`\nCreated new PRIMO_MERCATO session: ${session.id}`)
    }

    // Verify
    console.log(`\n=== Active Session ===`)
    console.log(`  ID: ${session.id}`)
    console.log(`  Type: ${session.type}`)
    console.log(`  Phase: ${session.currentPhase}`)
    console.log(`  Current Role: ${session.currentRole}`)
    console.log(`  Timer: ${session.auctionTimerSeconds}s`)
    console.log(`  Current Turn Index: ${session.currentTurnIndex}`)

    // Show whose turn it is
    const currentTurnMember = members.find(m => m.id === turnOrder[session!.currentTurnIndex ?? 0])
    console.log(`  Current Turn: ${currentTurnMember?.user.username}`)

    // Show league configuration
    console.log(`\n=== League Configuration ===`)
    console.log(`  Goalkeeper slots: ${league.goalkeeperSlots}`)
    console.log(`  Defender slots: ${league.defenderSlots}`)
    console.log(`  Midfielder slots: ${league.midfielderSlots}`)
    console.log(`  Forward slots: ${league.forwardSlots}`)

    // Show members
    console.log(`\n=== League Members ===`)
    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      const isCurrent = m.id === currentTurnMember?.id
      console.log(`  ${i + 1}. ${m.user.username} - Budget: ${m.currentBudget} - Team: ${m.teamName || 'N/A'}${isCurrent ? ' ← CURRENT TURN' : ''}`)
    }

    console.log('\n✅ PRIMO MERCATO (ASTA_LIBERA) phase is now active!')
    console.log('\nFlow:')
    console.log('  1. Current turn manager nominates a player')
    console.log('  2. All managers mark "ready"')
    console.log('  3. Auction starts (base price = 1)')
    console.log('  4. All managers can bid')
    console.log('  5. Admin closes auction when timer expires')
    console.log('  6. All managers acknowledge result')
    console.log('  7. Advance to next turn')
    console.log('\nLogin as admin_lega and go to AdminPanel → Auctions')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupFirstMarket()
