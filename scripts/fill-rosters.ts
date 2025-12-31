/**
 * Script to fill all rosters except the last attacker for each manager
 * Run with: npx tsx scripts/fill-rosters.ts
 */
import { PrismaClient, Position, AcquisitionType } from '@prisma/client'

const prisma = new PrismaClient()

async function fillRosters() {
  try {
    // Find the first active league with an active market session
    const session = await prisma.marketSession.findFirst({
      where: { status: 'ACTIVE', type: 'PRIMO_MERCATO' },
      include: { league: true }
    })

    const league = session?.league

    if (!league) {
      console.error('League not found!')
      return
    }

    console.log(`Found league: ${league.name} (${league.id})`)
    console.log(`Slots: P=${league.goalkeeperSlots}, D=${league.defenderSlots}, C=${league.midfielderSlots}, A=${league.forwardSlots}`)

    // Get all active members
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { username: true } },
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true }
        }
      }
    })

    console.log(`\nFound ${members.length} members`)

    // Get all available players (not already in any roster in this league)
    const takenPlayerIds = await prisma.playerRoster.findMany({
      where: {
        status: 'ACTIVE',
        leagueMember: { leagueId: league.id }
      },
      select: { playerId: true }
    }).then(r => r.map(x => x.playerId))

    console.log(`Already taken: ${takenPlayerIds.length} players`)

    // Get available players by position
    const availablePlayers: Record<Position, { id: string; name: string; team: string; quotation: number }[]> = {
      P: [],
      D: [],
      C: [],
      A: []
    }

    for (const pos of ['P', 'D', 'C', 'A'] as Position[]) {
      const players = await prisma.serieAPlayer.findMany({
        where: {
          position: pos,
          id: { notIn: takenPlayerIds }
        },
        orderBy: { quotation: 'desc' },
        take: 100
      })
      availablePlayers[pos] = players
      console.log(`Available ${pos}: ${players.length} players`)
    }

    // Target slots for each position (COMPLETE ALL)
    const targetSlots: Record<Position, number> = {
      P: league.goalkeeperSlots,
      D: league.defenderSlots,
      C: league.midfielderSlots,
      A: league.forwardSlots // Complete all slots
    }

    console.log(`\nTarget slots: P=${targetSlots.P}, D=${targetSlots.D}, C=${targetSlots.C}, A=${targetSlots.A}`)

    // Track which players we've assigned
    const assignedPlayerIds = new Set<string>()

    // Fill rosters for each member
    for (const member of members) {
      console.log(`\n=== ${member.user.username} ===`)

      // Count current players by position
      const currentCounts: Record<Position, number> = {
        P: member.roster.filter(r => r.player.position === 'P').length,
        D: member.roster.filter(r => r.player.position === 'D').length,
        C: member.roster.filter(r => r.player.position === 'C').length,
        A: member.roster.filter(r => r.player.position === 'A').length
      }

      console.log(`  Current: P=${currentCounts.P}, D=${currentCounts.D}, C=${currentCounts.C}, A=${currentCounts.A}`)

      // Add missing players for each position
      for (const pos of ['P', 'D', 'C', 'A'] as Position[]) {
        const needed = targetSlots[pos] - currentCounts[pos]

        if (needed <= 0) {
          console.log(`  ${pos}: Already complete (${currentCounts[pos]}/${targetSlots[pos]})`)
          continue
        }

        console.log(`  ${pos}: Need ${needed} more players`)

        // Get available players for this position (not yet assigned)
        const available = availablePlayers[pos].filter(p => !assignedPlayerIds.has(p.id))

        if (available.length < needed) {
          console.log(`  WARNING: Not enough ${pos} players available! Have ${available.length}, need ${needed}`)
        }

        // Assign players
        for (let i = 0; i < needed && i < available.length; i++) {
          const player = available[i]
          const price = Math.max(1, Math.floor(player.quotation * (1 + Math.random() * 0.5))) // Random price based on quotation

          await prisma.playerRoster.create({
            data: {
              leagueMemberId: member.id,
              playerId: player.id,
              acquisitionPrice: price,
              acquisitionType: AcquisitionType.FIRST_MARKET,
              status: 'ACTIVE'
            }
          })

          // Deduct from budget
          await prisma.leagueMember.update({
            where: { id: member.id },
            data: { currentBudget: { decrement: price } }
          })

          assignedPlayerIds.add(player.id)
          console.log(`    + ${player.name} (${player.team}) - ${price} crediti`)
        }
      }
    }

    // Show final status
    console.log('\n\n========== FINAL ROSTERS ==========')

    const finalMembers = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, status: 'ACTIVE' },
      include: {
        user: { select: { username: true } },
        roster: {
          where: { status: 'ACTIVE' },
          include: { player: true }
        }
      }
    })

    for (const member of finalMembers) {
      const counts: Record<Position, number> = {
        P: member.roster.filter(r => r.player.position === 'P').length,
        D: member.roster.filter(r => r.player.position === 'D').length,
        C: member.roster.filter(r => r.player.position === 'C').length,
        A: member.roster.filter(r => r.player.position === 'A').length
      }

      console.log(`${member.user.username}: P=${counts.P}/${league.goalkeeperSlots}, D=${counts.D}/${league.defenderSlots}, C=${counts.C}/${league.midfielderSlots}, A=${counts.A}/${league.forwardSlots} | Budget: ${member.currentBudget}`)
    }

    // Close the market session (all rosters complete)
    if (session) {
      await prisma.marketSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          currentPhase: 'CONTRATTI', // Next phase after ASTA_LIBERA
          endsAt: new Date(),
          pendingNominationPlayerId: null,
          pendingNominatorId: null,
          readyMembers: []
        }
      })
      console.log('\n✅ Market session COMPLETED - Passing to CONTRATTI phase')
    }

    console.log('\n✅ ALL ROSTERS COMPLETE!')
    console.log('The first market is finished. Managers can now set their contracts.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fillRosters()
