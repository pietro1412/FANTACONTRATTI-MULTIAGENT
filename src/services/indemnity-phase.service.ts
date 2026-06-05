import type { Prisma } from '@prisma/client'
import { MemberStatus, RosterStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordMovement } from './movement.service'

// ==================== AUTO-RELEASE RITIRATO PLAYERS ====================

/**
 * Auto-release only RITIRATO players at session creation.
 * Called during MERCATO_RICORRENTE creation, after decrementContractDurations().
 * RETROCESSO/ESTERO players are handled by the manager in CONTRATTI phase.
 */
export async function autoReleaseRitiratiPlayers(
  leagueId: string,
  sessionId: string
): Promise<{ released: number; players: string[] }> {
  // Find all active roster entries with RITIRATO players that have contracts
  const affectedRosters = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId, status: MemberStatus.ACTIVE },
      status: RosterStatus.ACTIVE,
      player: {
        listStatus: 'NOT_IN_LIST',
        exitReason: 'RITIRATO',
      },
      contract: { isNot: null },
    },
    include: {
      player: { select: { id: true, name: true } },
      contract: true,
      leagueMember: { select: { id: true } },
    },
  })

  if (affectedRosters.length === 0) {
    return { released: 0, players: [] }
  }

  const releasedNames: string[] = []

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const roster of affectedRosters) {
      if (!roster.contract) continue

      // Delete contract
      await tx.playerContract.delete({
        where: { id: roster.contract.id },
      })

      // Release from roster
      await tx.playerRoster.update({
        where: { id: roster.id },
        data: {
          status: RosterStatus.RELEASED,
          releasedAt: new Date(),
        },
      })

      releasedNames.push(roster.player.name)
    }
  })

  // Record movements outside transaction
  for (const roster of affectedRosters) {
    await recordMovement({
      leagueId,
      marketSessionId: sessionId,
      playerId: roster.player.id,
      fromMemberId: roster.leagueMember.id,
      toMemberId: null,
      movementType: 'RETIREMENT',
      price: 0,
    })
  }

  return { released: releasedNames.length, players: releasedNames }
}
