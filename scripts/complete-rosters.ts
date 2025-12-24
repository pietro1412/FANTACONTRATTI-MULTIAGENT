/**
 * Complete all rosters and close market session
 * Run with: npx tsx scripts/complete-rosters.ts
 */
import { PrismaClient, AcquisitionType } from '@prisma/client'

const prisma = new PrismaClient()

async function completeRosters() {
  try {
    const league = await prisma.league.findFirst({
      where: { name: 'Lega Fantacontratti 2025' }
    })

    if (!league) {
      console.error('League not found!')
      return
    }

    console.log(`League: ${league.name}`)

    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { username: true } },
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      }
    })

    // Get taken player IDs
    const takenIds = await prisma.playerRoster.findMany({
      where: { status: 'ACTIVE', leagueMember: { leagueId: league.id } },
      select: { playerId: true }
    }).then(r => r.map(x => x.playerId))

    // Get available attackers
    const attackers = await prisma.serieAPlayer.findMany({
      where: { position: 'A', id: { notIn: takenIds } },
      orderBy: { quotation: 'desc' },
      take: 20
    })

    console.log(`Available attackers: ${attackers.length}`)

    let idx = 0
    for (const member of members) {
      const aCount = member.roster.filter(r => r.player.position === 'A').length
      const needed = league.forwardSlots - aCount

      if (needed > 0 && attackers[idx]) {
        const player = attackers[idx]
        const price = Math.max(1, Math.floor(player.quotation * 1.2))

        await prisma.playerRoster.create({
          data: {
            leagueMemberId: member.id,
            playerId: player.id,
            acquisitionPrice: price,
            acquisitionType: AcquisitionType.FIRST_MARKET,
            status: 'ACTIVE'
          }
        })

        await prisma.leagueMember.update({
          where: { id: member.id },
          data: { currentBudget: { decrement: price } }
        })

        console.log(`${member.user.username}: + ${player.name} (${price} crediti)`)
        idx++
      }
    }

    // Close the market session
    const result = await prisma.marketSession.updateMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      data: { status: 'COMPLETED', endsAt: new Date() }
    })

    console.log(`\nClosed ${result.count} market session(s)`)

    // Show final status
    console.log('\n=== FINAL ROSTERS ===')
    const finalMembers = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { username: true } },
        roster: { where: { status: 'ACTIVE' }, include: { player: true } }
      }
    })

    for (const m of finalMembers) {
      const p = m.roster.filter(r => r.player.position === 'P').length
      const d = m.roster.filter(r => r.player.position === 'D').length
      const c = m.roster.filter(r => r.player.position === 'C').length
      const a = m.roster.filter(r => r.player.position === 'A').length
      console.log(`${m.user.username}: P=${p}/3, D=${d}/8, C=${c}/8, A=${a}/6 | Budget: ${m.currentBudget}`)
    }

    console.log('\n✅ Rose completate! Sessione PRIMO_MERCATO chiusa.')
    console.log('Ora puoi passare alla prossima fase.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeRosters()
