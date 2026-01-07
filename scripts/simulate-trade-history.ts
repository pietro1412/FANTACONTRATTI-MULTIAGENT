/**
 * Simulate trade history between managers
 * Creates accepted, rejected, and expired trades
 * Run with: npx tsx scripts/simulate-trade-history.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simulateTradeHistory() {
  try {
    const league = await prisma.league.findFirst({
      where: { name: 'Lega Fantacontratti 2025' }
    })

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
    // Real usernames: paolo_bianchi, admin_lega, luca_gialli, marco_neri, mario_rossi, luigi_verdi, andrea_blu, giuseppe_viola
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, username: true } },
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      }
    })

    console.log(`Found ${members.length} managers`)
    members.forEach(m => console.log(`  - ${m.user.username}: ${m.roster.length} players`))

    // Create different types of trades
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

    // Helper to find member by username
    const findMember = (username: string) => members.find(m => m.user.username === username)

    // Trade 1: ACCEPTED - mario_rossi -> luigi_verdi (2 days ago)
    const mario = findMember('mario_rossi')
    const luigi = findMember('luigi_verdi')
    if (mario && luigi && mario.roster.length >= 2 && luigi.roster.length >= 1) {
      trades.push({
        sender: mario,
        receiver: luigi,
        offeredRosterIds: mario.roster.slice(0, 2).map(r => r.id),
        requestedRosterIds: luigi.roster.slice(0, 1).map(r => r.id),
        offeredBudget: 5,
        requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Scambio vantaggioso per entrambi!',
        daysAgo: 2
      })
    }

    // Trade 2: REJECTED - paolo_bianchi -> luca_gialli (1 day ago)
    const paolo = findMember('paolo_bianchi')
    const luca = findMember('luca_gialli')
    if (paolo && luca && paolo.roster.length >= 1 && luca.roster.length >= 2) {
      trades.push({
        sender: paolo,
        receiver: luca,
        offeredRosterIds: paolo.roster.slice(0, 1).map(r => r.id),
        requestedRosterIds: luca.roster.slice(0, 2).map(r => r.id),
        offeredBudget: 0,
        requestedBudget: 20,
        status: 'REJECTED',
        message: 'Ti offro il mio portiere per i tuoi due difensori',
        daysAgo: 1
      })
    }

    // Trade 3: ACCEPTED - luigi_verdi -> marco_neri (3 days ago)
    const marco = findMember('marco_neri')
    if (luigi && marco && luigi.roster.length >= 3 && marco.roster.length >= 1) {
      trades.push({
        sender: luigi,
        receiver: marco,
        offeredRosterIds: luigi.roster.slice(1, 3).map(r => r.id),
        requestedRosterIds: marco.roster.slice(0, 1).map(r => r.id),
        offeredBudget: 10,
        requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Affare d\'oro per te!',
        daysAgo: 3
      })
    }

    // Trade 4: EXPIRED - andrea_blu -> mario_rossi (5 days ago)
    const andrea = findMember('andrea_blu')
    if (andrea && mario && andrea.roster.length >= 3 && mario.roster.length >= 3) {
      trades.push({
        sender: andrea,
        receiver: mario,
        offeredRosterIds: andrea.roster.slice(0, 3).map(r => r.id),
        requestedRosterIds: mario.roster.slice(2, 3).map(r => r.id),
        offeredBudget: 0,
        requestedBudget: 15,
        status: 'EXPIRED',
        message: 'Proposta generosa, pensaci!',
        daysAgo: 5
      })
    }

    // Trade 5: REJECTED - luca_gialli -> giuseppe_viola (2 days ago)
    const giuseppe = findMember('giuseppe_viola')
    if (luca && giuseppe && luca.roster.length >= 1 && giuseppe.roster.length >= 3) {
      trades.push({
        sender: luca,
        receiver: giuseppe,
        offeredRosterIds: luca.roster.slice(0, 1).map(r => r.id),
        requestedRosterIds: giuseppe.roster.slice(1, 3).map(r => r.id),
        offeredBudget: 8,
        requestedBudget: 0,
        status: 'REJECTED',
        message: 'Scambio interessante?',
        daysAgo: 2
      })
    }

    // Trade 6: CANCELLED - giuseppe_viola -> paolo_bianchi (4 days ago)
    if (giuseppe && paolo && giuseppe.roster.length >= 4 && paolo.roster.length >= 2) {
      trades.push({
        sender: giuseppe,
        receiver: paolo,
        offeredRosterIds: giuseppe.roster.slice(2, 4).map(r => r.id),
        requestedRosterIds: paolo.roster.slice(1, 2).map(r => r.id),
        offeredBudget: 12,
        requestedBudget: 0,
        status: 'CANCELLED',
        message: 'Ho cambiato idea, scusa!',
        daysAgo: 4
      })
    }

    // Trade 7: ACCEPTED - andrea_blu -> luca_gialli (1 day ago)
    if (andrea && luca && andrea.roster.length >= 5 && luca.roster.length >= 3) {
      trades.push({
        sender: andrea,
        receiver: luca,
        offeredRosterIds: andrea.roster.slice(3, 5).map(r => r.id),
        requestedRosterIds: luca.roster.slice(2, 3).map(r => r.id),
        offeredBudget: 3,
        requestedBudget: 0,
        status: 'ACCEPTED',
        message: 'Affare fatto!',
        daysAgo: 1
      })
    }

    // Trade 8: REJECTED - marco_neri -> andrea_blu (3 days ago)
    if (marco && andrea && marco.roster.length >= 4 && andrea.roster.length >= 2) {
      trades.push({
        sender: marco,
        receiver: andrea,
        offeredRosterIds: marco.roster.slice(3, 4).map(r => r.id),
        requestedRosterIds: andrea.roster.slice(1, 2).map(r => r.id),
        offeredBudget: 0,
        requestedBudget: 5,
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
