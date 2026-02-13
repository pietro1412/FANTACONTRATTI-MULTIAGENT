/**
 * Simulate trade history between managers
 * Creates accepted, rejected, and expired trades
 * Run with: npx tsx scripts/simulate-trade-history.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simulateTradeHistory() {
  try {
    const leagueId = process.argv[2] || null
    const league = leagueId
      ? await prisma.league.findUnique({ where: { id: leagueId } })
      : await prisma.league.findFirst({ where: { name: 'Lega Fantacontratti 2025' } })

    if (!league) {
      console.error('League not found!')
      return
    }

    // Find current market session
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

    // Get all members with their rosters
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, username: true } },
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      }
    })

    console.log(`Found ${members.length} managers`)
    members.forEach(m => console.log(`  - ${m.user.username}: ${m.roster.length} players`))

    if (members.length < 3) {
      console.error('Need at least 3 members to simulate trades!')
      return
    }

    // Create different types of trades dynamically using available members
    const trades: Array<{
      sender: typeof members[0]
      receiver: typeof members[0]
      offeredRosterIds: string[]
      requestedRosterIds: string[]
      offeredBudget: number
      requestedBudget: number
      status: 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
      message: string
      daysAgo: number
    }> = []

    const m = members // shorthand

    // Trade 1: ACCEPTED - member[0] -> member[1] (2 days ago)
    if (m[0].roster.length >= 2 && m[1].roster.length >= 1) {
      trades.push({
        sender: m[0], receiver: m[1],
        offeredRosterIds: m[0].roster.slice(0, 2).map(r => r.id),
        requestedRosterIds: m[1].roster.slice(0, 1).map(r => r.id),
        offeredBudget: 5, requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Scambio vantaggioso per entrambi!',
        daysAgo: 2
      })
    }

    // Trade 2: REJECTED - member[2] -> member[3] (1 day ago)
    if (m.length >= 4 && m[2].roster.length >= 1 && m[3].roster.length >= 2) {
      trades.push({
        sender: m[2], receiver: m[3],
        offeredRosterIds: m[2].roster.slice(2, 3).map(r => r.id),
        requestedRosterIds: m[3].roster.slice(0, 2).map(r => r.id),
        offeredBudget: 0, requestedBudget: 20,
        status: 'REJECTED',
        message: 'Ti offro il mio portiere per i tuoi due difensori',
        daysAgo: 1
      })
    }

    // Trade 3: ACCEPTED - member[1] -> member[2] (3 days ago)
    if (m[1].roster.length >= 3 && m[2].roster.length >= 1) {
      trades.push({
        sender: m[1], receiver: m[2],
        offeredRosterIds: m[1].roster.slice(3, 5).map(r => r.id),
        requestedRosterIds: m[2].roster.slice(4, 5).map(r => r.id),
        offeredBudget: 10, requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Affare d\'oro per te!',
        daysAgo: 3
      })
    }

    // Trade 4: EXPIRED - member[3] -> member[0] (5 days ago)
    if (m.length >= 4 && m[3].roster.length >= 3 && m[0].roster.length >= 3) {
      trades.push({
        sender: m[3], receiver: m[0],
        offeredRosterIds: m[3].roster.slice(5, 8).map(r => r.id),
        requestedRosterIds: m[0].roster.slice(3, 4).map(r => r.id),
        offeredBudget: 0, requestedBudget: 15,
        status: 'EXPIRED',
        message: 'Proposta generosa, pensaci!',
        daysAgo: 5
      })
    }

    // Trade 5: REJECTED - member[4] -> member[5] (2 days ago)
    if (m.length >= 6 && m[4].roster.length >= 1 && m[5].roster.length >= 3) {
      trades.push({
        sender: m[4], receiver: m[5],
        offeredRosterIds: m[4].roster.slice(6, 7).map(r => r.id),
        requestedRosterIds: m[5].roster.slice(8, 10).map(r => r.id),
        offeredBudget: 8, requestedBudget: 0,
        status: 'REJECTED',
        message: 'Scambio interessante?',
        daysAgo: 2
      })
    }

    // Trade 6: CANCELLED - member[5] -> member[0] (4 days ago)
    if (m.length >= 6 && m[5].roster.length >= 4 && m[0].roster.length >= 2) {
      trades.push({
        sender: m[5], receiver: m[0],
        offeredRosterIds: m[5].roster.slice(10, 12).map(r => r.id),
        requestedRosterIds: m[0].roster.slice(5, 6).map(r => r.id),
        offeredBudget: 12, requestedBudget: 0,
        status: 'CANCELLED',
        message: 'Ho cambiato idea, scusa!',
        daysAgo: 4
      })
    }

    // Trade 7: ACCEPTED - member[3] -> member[4] (1 day ago)
    if (m.length >= 5 && m[3].roster.length >= 5 && m[4].roster.length >= 3) {
      trades.push({
        sender: m[3], receiver: m[4],
        offeredRosterIds: m[3].roster.slice(10, 12).map(r => r.id),
        requestedRosterIds: m[4].roster.slice(8, 9).map(r => r.id),
        offeredBudget: 3, requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Affare fatto!',
        daysAgo: 1
      })
    }

    // Trade 8: REJECTED - member[2] -> member[1] (3 days ago)
    if (m[2].roster.length >= 4 && m[1].roster.length >= 2) {
      trades.push({
        sender: m[2], receiver: m[1],
        offeredRosterIds: m[2].roster.slice(12, 13).map(r => r.id),
        requestedRosterIds: m[1].roster.slice(6, 7).map(r => r.id),
        offeredBudget: 0, requestedBudget: 5,
        status: 'REJECTED',
        message: 'Ti do il mio attaccante per il tuo centrocampista?',
        daysAgo: 3
      })
    }

    // Create the trade offers
    for (const trade of trades) {
      const createdAt = new Date()
      createdAt.setDate(createdAt.getDate() - trade.daysAgo)

      const expiresAt = new Date(createdAt)
      expiresAt.setHours(expiresAt.getHours() + 48)

      const respondedAt = new Date(createdAt)
      respondedAt.setHours(respondedAt.getHours() + Math.floor(Math.random() * 24) + 1)

      const involvedRosterIds = [...trade.offeredRosterIds, ...trade.requestedRosterIds]

      const tradeOffer = await prisma.tradeOffer.create({
        data: {
          marketSessionId: marketSession.id,
          senderId: trade.sender.user.id,
          receiverId: trade.receiver.user.id,
          offeredPlayers: trade.offeredRosterIds,
          requestedPlayers: trade.requestedRosterIds,
          offeredBudget: trade.offeredBudget,
          requestedBudget: trade.requestedBudget,
          involvedPlayers: involvedRosterIds,
          message: trade.message,
          status: trade.status,
          createdAt,
          expiresAt,
          respondedAt: trade.status !== 'EXPIRED' ? respondedAt : null,
        }
      })

      const statusEmoji = {
        ACCEPTED: '✅',
        REJECTED: '❌',
        EXPIRED: '⏰',
        CANCELLED: '🚫'
      }

      console.log(`\n${statusEmoji[trade.status]} Trade ${trade.status}:`)
      console.log(`   ${trade.sender.user.username} -> ${trade.receiver.user.username}`)
      console.log(`   Offered: ${trade.offeredRosterIds.length} players + ${trade.offeredBudget} credits`)
      console.log(`   Requested: ${trade.requestedRosterIds.length} players + ${trade.requestedBudget} credits`)
      console.log(`   Created: ${trade.daysAgo} days ago`)
    }

    console.log(`\n✅ Done! Created ${trades.length} historical trades.`)
    console.log('\nSummary:')
    console.log(`  - ACCEPTED: ${trades.filter(t => t.status === 'ACCEPTED').length}`)
    console.log(`  - REJECTED: ${trades.filter(t => t.status === 'REJECTED').length}`)
    console.log(`  - EXPIRED: ${trades.filter(t => t.status === 'EXPIRED').length}`)
    console.log(`  - CANCELLED: ${trades.filter(t => t.status === 'CANCELLED').length}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

simulateTradeHistory()
