/**
 * Simulate 3 trade offers to admin_lega from different managers
 * Run with: npx tsx scripts/simulate-offers.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simulateOffers() {
  try {
    // Find admin_lega
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin_lega' }
    })

    if (!adminUser) {
      console.error('admin_lega not found!')
      return
    }

    const league = await prisma.league.findFirst({
      where: { name: 'Lega Fantacontratti 2025' }
    })

    if (!league) {
      console.error('League not found!')
      return
    }

    // Find current market session (MERCATO_RICORRENTE with OFFERTE phase)
    const marketSession = await prisma.marketSession.findFirst({
      where: {
        leagueId: league.id,
        status: 'ACTIVE',
        currentPhase: { in: ['OFFERTE_PRE_RINNOVO', 'OFFERTE_POST_ASTA_SVINCOLATI'] }
      }
    })

    if (!marketSession) {
      console.error('No active market session with OFFERTE phase found!')
      return
    }

    console.log(`Market session: ${marketSession.id} (${marketSession.currentPhase})`)

    // Find admin_lega's membership
    const adminMember = await prisma.leagueMember.findFirst({
      where: { leagueId: league.id, userId: adminUser.id, status: 'ACTIVE' },
      include: {
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      }
    })

    if (!adminMember) {
      console.error('admin_lega membership not found!')
      return
    }

    console.log(`Admin member: ${adminMember.id}`)
    console.log(`Admin has ${adminMember.roster.length} players`)

    // Find other managers (need their user IDs)
    const otherMembers = await prisma.leagueMember.findMany({
      where: {
        leagueId: league.id,
        status: 'ACTIVE',
        userId: { not: adminUser.id }
      },
      include: {
        user: { select: { id: true, username: true } },
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      },
      take: 3
    })

    console.log(`\nFound ${otherMembers.length} other managers`)

    // Get some of admin's players to request (use player IDs, not roster entry IDs)
    const adminPlayers = adminMember.roster.slice(0, 5)

    // Create 3 offers
    const offers = [
      {
        fromMember: otherMembers[0],
        offeredPlayers: otherMembers[0].roster.slice(0, 2), // Offer 2 players
        requestedPlayers: [adminPlayers[0]], // Request 1 player
        offeredBudget: 5,
        requestedBudget: 0,
        message: 'Ciao! Ti propongo uno scambio interessante. I miei due giocatori per il tuo!',
      },
      {
        fromMember: otherMembers[1],
        offeredPlayers: [otherMembers[1].roster[0]], // Offer 1 player
        requestedPlayers: [adminPlayers[1], adminPlayers[2]], // Request 2 players
        offeredBudget: 0,
        requestedBudget: 10,
        message: 'Ho bisogno di rinforzi! Che ne dici?',
      },
      {
        fromMember: otherMembers[2],
        offeredPlayers: otherMembers[2].roster.slice(0, 3), // Offer 3 players
        requestedPlayers: [adminPlayers[3]], // Request 1 player
        offeredBudget: 15,
        requestedBudget: 0,
        message: 'Offerta generosa! 3 giocatori + 15 crediti per il tuo campione!',
      },
    ]

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i]
      if (!offer.fromMember || !offer.offeredPlayers.length || !offer.requestedPlayers.length) {
        console.log(`Skipping offer ${i + 1}: missing data`)
        continue
      }

      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24 + (i * 12)) // Different expiration times

      // Get roster entry IDs (the trade service looks up by roster ID, not player ID)
      const offeredRosterIds = offer.offeredPlayers.map(r => r.id)
      const requestedRosterIds = offer.requestedPlayers.map(r => r.id)
      const involvedRosterIds = [...offeredRosterIds, ...requestedRosterIds]

      const tradeOffer = await prisma.tradeOffer.create({
        data: {
          marketSessionId: marketSession.id,
          senderId: offer.fromMember.user.id,
          receiverId: adminUser.id,
          offeredPlayers: offeredRosterIds,
          requestedPlayers: requestedRosterIds,
          offeredBudget: offer.offeredBudget,
          requestedBudget: offer.requestedBudget,
          involvedPlayers: involvedRosterIds,
          message: offer.message,
          status: 'PENDING',
          expiresAt,
        }
      })

      console.log(`\n✅ Offer ${i + 1} created:`)
      console.log(`   From: ${offer.fromMember.user.username}`)
      console.log(`   Offered: ${offer.offeredPlayers.map(p => p.player.name).join(', ')} + ${offer.offeredBudget} crediti`)
      console.log(`   Requested: ${offer.requestedPlayers.map(p => p.player.name).join(', ')} + ${offer.requestedBudget} crediti`)
      console.log(`   Message: ${offer.message}`)
      console.log(`   Expires: ${expiresAt.toLocaleString('it-IT')}`)
    }

    console.log('\n✅ Done! admin_lega now has 3 pending trade offers.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simulateOffers()
