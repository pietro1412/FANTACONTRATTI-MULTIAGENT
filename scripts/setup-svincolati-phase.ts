/**
 * Script to setup the SVINCOLATI phase for testing the auction system
 * Run with: npx tsx scripts/setup-svincolati-phase.ts
 */
import { PrismaClient, MarketPhase, SessionStatus, MarketType } from '@prisma/client'

const prisma = new PrismaClient()

async function setupSvincolatiPhase() {
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

    // Check for existing active session
    const existingSession = await prisma.marketSession.findFirst({
      where: { leagueId: league.id, status: SessionStatus.ACTIVE }
    })

    if (existingSession) {
      // Update existing session to SVINCOLATI phase
      await prisma.marketSession.update({
        where: { id: existingSession.id },
        data: { currentPhase: MarketPhase.SVINCOLATI }
      })
      console.log(`Updated existing session to SVINCOLATI phase`)
    } else {
      // Create new market session in SVINCOLATI phase
      const session = await prisma.marketSession.create({
        data: {
          leagueId: league.id,
          type: MarketType.PRIMO_MERCATO,
          season: 1,
          semester: 1,
          status: SessionStatus.ACTIVE,
          currentPhase: MarketPhase.SVINCOLATI,
          auctionTimerSeconds: 30,
          startsAt: new Date(),
        }
      })
      console.log(`Created new market session in SVINCOLATI phase: ${session.id}`)
    }

    // Verify
    const activeSession = await prisma.marketSession.findFirst({
      where: { leagueId: league.id, status: SessionStatus.ACTIVE }
    })
    console.log(`\nActive session:`)
    console.log(`  ID: ${activeSession?.id}`)
    console.log(`  Phase: ${activeSession?.currentPhase}`)
    console.log(`  Type: ${activeSession?.type}`)
    console.log(`  Timer: ${activeSession?.auctionTimerSeconds}s`)

    // Show members for reference
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: { user: { select: { username: true } } }
    })
    console.log(`\nLeague members (${members.length}):`)
    for (const m of members) {
      console.log(`  - ${m.user.username} (Budget: ${m.currentBudget})`)
    }

    console.log('\n✅ SVINCOLATI phase is now active!')
    console.log('You can now test the auction system with bots.')
    console.log('Login as admin_lega and go to "Svincolati" page.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupSvincolatiPhase()
