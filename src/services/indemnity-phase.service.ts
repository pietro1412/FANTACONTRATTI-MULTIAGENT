import { PrismaClient, MemberStatus, RosterStatus, PlayerExitReason, Prisma } from '@prisma/client'
import { recordMovement } from './movement.service'
import { triggerIndemnityDecisionSubmitted, triggerIndemnityAllDecided } from './pusher.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// Interface for players affected by exit classification in a specific league
export interface AffectedPlayer {
  playerId: string
  playerName: string
  position: string
  team: string
  exitReason: PlayerExitReason
  exitDate: Date | null
  contract: {
    id: string
    salary: number
    duration: number
    rescissionClause: number
  }
  roster: {
    id: string
    acquisitionPrice: number
  }
}

export interface MemberAffectedPlayers {
  memberId: string
  memberUsername: string
  teamName: string | null
  currentBudget: number
  affectedPlayers: AffectedPlayer[]
}

// Interface for manager decision on a player
export type PlayerDecision = 'KEEP' | 'RELEASE'

export interface PlayerDecisionInput {
  rosterId: string
  decision: PlayerDecision
}

// ==================== GET AFFECTED PLAYERS FOR LEAGUE ====================

/**
 * Get all players affected by exit classification for the current CALCOLO_INDENNIZZI phase
 * Returns players grouped by manager, with their exit reasons and contract details
 */
export async function getAffectedPlayersForLeague(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if we're in CALCOLO_INDENNIZZI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CALCOLO_INDENNIZZI',
    },
  })

  const inCalcoloIndennizziPhase = !!activeSession

  // Get all members with affected players
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          status: RosterStatus.ACTIVE,
          player: {
            listStatus: 'NOT_IN_LIST',
            exitReason: { not: null },
          },
        },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  const result: MemberAffectedPlayers[] = members
    .filter(m => m.roster.length > 0)
    .map(m => ({
      memberId: m.id,
      memberUsername: m.user.username,
      teamName: m.teamName,
      currentBudget: m.currentBudget,
      affectedPlayers: m.roster
        .filter(r => r.contract) // Only include players with contracts
        .map(r => ({
          playerId: r.player.id,
          playerName: r.player.name,
          position: r.player.position,
          team: r.player.team,
          exitReason: r.player.exitReason!,
          exitDate: r.player.exitDate,
          contract: {
            id: r.contract!.id,
            salary: r.contract!.salary,
            duration: r.contract!.duration,
            rescissionClause: r.contract!.rescissionClause,
          },
          roster: {
            id: r.id,
            acquisitionPrice: r.acquisitionPrice,
          },
        })),
    }))

  return {
    success: true,
    data: {
      inCalcoloIndennizziPhase,
      sessionId: activeSession?.id || null,
      members: result,
      isAdmin: member.role === 'ADMIN',
    },
  }
}

// ==================== GET MY AFFECTED PLAYERS ====================

/**
 * Get affected players for the current user in a specific league
 */
export async function getMyAffectedPlayers(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          status: RosterStatus.ACTIVE,
          player: {
            listStatus: 'NOT_IN_LIST',
            exitReason: { not: null },
          },
        },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if we're in CALCOLO_INDENNIZZI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CALCOLO_INDENNIZZI',
    },
  })

  const inCalcoloIndennizziPhase = !!activeSession

  // Check if already submitted decisions
  const existingDecision = activeSession ? await prisma.indemnityDecision.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  }) : null

  // Get the indennizzo estero amount from the session's prize configuration
  let indennizzoEstero = 50 // Default
  if (activeSession) {
    const prizeCategory = await prisma.prizeCategory.findFirst({
      where: {
        marketSessionId: activeSession.id,
        name: 'Indennizzo Partenza Estero',
        isSystemPrize: true,
      },
      include: {
        managerPrizes: {
          where: { leagueMemberId: member.id },
        },
      },
    })
    if (prizeCategory?.managerPrizes[0]?.amount) {
      indennizzoEstero = prizeCategory.managerPrizes[0].amount
    }
  }

  const affectedPlayers: AffectedPlayer[] = member.roster
    .filter(r => r.contract)
    .map(r => ({
      playerId: r.player.id,
      playerName: r.player.name,
      position: r.player.position,
      team: r.player.team,
      exitReason: r.player.exitReason!,
      exitDate: r.player.exitDate,
      contract: {
        id: r.contract!.id,
        salary: r.contract!.salary,
        duration: r.contract!.duration,
        rescissionClause: r.contract!.rescissionClause,
      },
      roster: {
        id: r.id,
        acquisitionPrice: r.acquisitionPrice,
      },
    }))

  return {
    success: true,
    data: {
      inCalcoloIndennizziPhase,
      sessionId: activeSession?.id || null,
      hasSubmittedDecisions: !!existingDecision,
      submittedAt: existingDecision?.decidedAt || null,
      currentBudget: member.currentBudget,
      indennizzoEstero,
      affectedPlayers,
    },
  }
}

// ==================== SUBMIT PLAYER DECISIONS ====================

/**
 * Submit decisions for affected players
 * - RITIRATO: automatically processed (no choice), contract dissolved
 * - RETROCESSO: KEEP = continue paying, RELEASE = no compensation
 * - ESTERO: KEEP = continue paying, RELEASE = receive compensation
 */
export async function submitPlayerDecisions(
  leagueId: string,
  userId: string,
  decisions: PlayerDecisionInput[]
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if we're in CALCOLO_INDENNIZZI phase
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CALCOLO_INDENNIZZI',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Non siamo in fase CALCOLO_INDENNIZZI' }
  }

  // Check if already submitted
  const existingDecision = await prisma.indemnityDecision.findUnique({
    where: {
      sessionId_memberId: {
        sessionId: activeSession.id,
        memberId: member.id,
      },
    },
  })

  if (existingDecision) {
    return { success: false, message: 'Hai già inviato le tue decisioni' }
  }

  // Get affected players for validation
  const affectedRosters = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: member.id,
      status: RosterStatus.ACTIVE,
      player: {
        listStatus: 'NOT_IN_LIST',
        exitReason: { not: null },
      },
    },
    include: {
      player: true,
      contract: true,
    },
  })

  // Validate that all affected players have decisions (except RITIRATO which is automatic)
  const needsDecision = affectedRosters.filter(r =>
    r.player.exitReason !== 'RITIRATO' && r.contract
  )

  const decisionMap = new Map(decisions.map(d => [d.rosterId, d.decision]))

  for (const roster of needsDecision) {
    if (!decisionMap.has(roster.id)) {
      return {
        success: false,
        message: `Decisione mancante per ${roster.player.name}`
      }
    }
  }

  // Get Indennizzo Estero from the current session's prize configuration
  const prizeCategory = await prisma.prizeCategory.findFirst({
    where: {
      marketSessionId: activeSession.id,
      name: 'Indennizzo Partenza Estero',
      isSystemPrize: true,
    },
    include: {
      managerPrizes: {
        where: { leagueMemberId: member.id },
      },
    },
  })

  const indennizzoEstero = prizeCategory?.managerPrizes[0]?.amount ?? 50 // Default 50M

  // Process decisions in transaction
  try {
    const processedResults = await prisma.$transaction(async (tx) => {
      const results: Array<{
        playerName: string
        exitReason: PlayerExitReason
        decision: string
        compensation: number
      }> = []

      // Process RITIRATO players automatically (contract dissolved, no compensation)
      const ritiratiPlayers = affectedRosters.filter(r =>
        r.player.exitReason === 'RITIRATO' && r.contract
      )

      for (const roster of ritiratiPlayers) {
        // Delete contract
        await tx.playerContract.delete({
          where: { id: roster.contract!.id },
        })

        // Release player
        await tx.playerRoster.update({
          where: { id: roster.id },
          data: {
            status: RosterStatus.RELEASED,
            releasedAt: new Date(),
          },
        })

        // Record movement
        await recordMovement({
          leagueId,
          playerId: roster.playerId,
          movementType: 'RETIREMENT',
          fromMemberId: member.id,
          price: 0,
          marketSessionId: activeSession.id,
        })

        results.push({
          playerName: roster.player.name,
          exitReason: 'RITIRATO',
          decision: 'AUTO_RELEASE',
          compensation: 0,
        })
      }

      // Process RETROCESSO and ESTERO players based on decisions
      for (const roster of needsDecision) {
        const decision = decisionMap.get(roster.id)!
        const exitReason = roster.player.exitReason!
        let compensation = 0

        if (decision === 'RELEASE') {
          // Delete contract
          await tx.playerContract.delete({
            where: { id: roster.contract!.id },
          })

          // Release player
          await tx.playerRoster.update({
            where: { id: roster.id },
            data: {
              status: RosterStatus.RELEASED,
              releasedAt: new Date(),
            },
          })

          if (exitReason === 'ESTERO') {
            // Calculate compensation: MIN(clausola_rescissione, indennizzo_estero)
            compensation = Math.min(roster.contract!.rescissionClause, indennizzoEstero)

            // Add compensation to budget
            await tx.leagueMember.update({
              where: { id: member.id },
              data: {
                currentBudget: { increment: compensation },
              },
            })

            // Record movement
            await recordMovement({
              leagueId,
              playerId: roster.playerId,
              movementType: 'ABROAD_COMPENSATION',
              fromMemberId: member.id,
              price: compensation,
              marketSessionId: activeSession.id,
            })
          } else {
            // RETROCESSO - no compensation
            await recordMovement({
              leagueId,
              playerId: roster.playerId,
              movementType: 'RELEGATION_RELEASE',
              fromMemberId: member.id,
              price: 0,
              marketSessionId: activeSession.id,
            })
          }
        } else {
          // KEEP - player stays, contract continues
          const movementType = exitReason === 'ESTERO' ? 'ABROAD_KEEP' : 'RELEGATION_KEEP'

          await recordMovement({
            leagueId,
            playerId: roster.playerId,
            movementType,
            toMemberId: member.id,
            price: 0,
            marketSessionId: activeSession.id,
          })
        }

        results.push({
          playerName: roster.player.name,
          exitReason,
          decision,
          compensation,
        })
      }

      // Record that member has submitted decisions
      await tx.indemnityDecision.create({
        data: {
          sessionId: activeSession.id,
          memberId: member.id,
          decisions: decisions as unknown as Prisma.InputJsonValue,
        },
      })

      return results
    })

    // Calculate total compensation received
    const totalCompensation = processedResults
      .filter(r => r.compensation > 0)
      .reduce((sum, r) => sum + r.compensation, 0)

    // Trigger Pusher notification for decision submission
    // Check how many managers have submitted decisions
    const allMembers = await prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: MemberStatus.ACTIVE,
      },
      include: {
        user: { select: { username: true } },
        roster: {
          where: {
            status: RosterStatus.ACTIVE,
            player: {
              listStatus: 'NOT_IN_LIST',
              exitReason: { not: null },
            },
          },
          include: { contract: true },
        },
      },
    })

    const managersWithAffected = allMembers.filter(m =>
      m.roster.some(r => r.contract)
    )

    const allDecisions = await prisma.indemnityDecision.findMany({
      where: { sessionId: activeSession.id },
    })

    const decidedCount = allDecisions.length
    const totalCount = managersWithAffected.length

    // Get the current member's username
    const currentMember = await prisma.leagueMember.findUnique({
      where: { id: member.id },
      include: { user: { select: { username: true } } },
    })

    // Trigger decision submitted event
    await triggerIndemnityDecisionSubmitted(activeSession.id, {
      memberId: member.id,
      memberUsername: currentMember?.user.username || 'Unknown',
      decidedCount,
      totalCount,
      timestamp: new Date().toISOString(),
    })

    // If all managers have decided, trigger the all decided event
    if (decidedCount >= totalCount && totalCount > 0) {
      await triggerIndemnityAllDecided(activeSession.id, {
        totalMembers: totalCount,
        timestamp: new Date().toISOString(),
      })
    }

    return {
      success: true,
      message: totalCompensation > 0
        ? `Decisioni registrate. Compenso ricevuto: ${totalCompensation}M`
        : 'Decisioni registrate',
      data: {
        processed: processedResults,
        totalCompensation,
      },
    }
  } catch (error) {
    console.error('Error processing indemnity decisions:', error)
    return { success: false, message: 'Errore durante l\'elaborazione delle decisioni' }
  }
}

// ==================== GET ALL DECISIONS STATUS ====================

/**
 * Get decision status for all members (admin view)
 */
export async function getAllDecisionsStatus(
  leagueId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify user is admin
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  if (member.role !== 'ADMIN') {
    return { success: false, message: 'Solo gli admin possono vedere lo stato delle decisioni' }
  }

  // Get active session
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'CALCOLO_INDENNIZZI',
    },
  })

  if (!activeSession) {
    return {
      success: true,
      data: {
        inCalcoloIndennizziPhase: false,
        managers: [],
        allDecided: false,
      },
    }
  }

  // Get all members with affected players
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          status: RosterStatus.ACTIVE,
          player: {
            listStatus: 'NOT_IN_LIST',
            exitReason: { not: null },
          },
        },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  // Get existing decisions
  const decisions = await prisma.indemnityDecision.findMany({
    where: { sessionId: activeSession.id },
  })

  const decisionMap = new Map(decisions.map(d => [d.memberId, d.decidedAt]))

  // Only consider members with affected players
  const managersWithAffected = members.filter(m =>
    m.roster.some(r => r.contract && r.player.exitReason)
  )

  const managersStatus = managersWithAffected.map(m => ({
    memberId: m.id,
    username: m.user.username,
    teamName: m.teamName,
    affectedCount: m.roster.filter(r => r.contract).length,
    hasDecided: decisionMap.has(m.id),
    decidedAt: decisionMap.get(m.id) || null,
  }))

  const allDecided = managersStatus.length === 0 || managersStatus.every(m => m.hasDecided)

  return {
    success: true,
    data: {
      inCalcoloIndennizziPhase: true,
      sessionId: activeSession.id,
      managers: managersStatus,
      decidedCount: managersStatus.filter(m => m.hasDecided).length,
      totalCount: managersStatus.length,
      allDecided,
    },
  }
}

// ==================== CAN ADVANCE FROM CALCOLO_INDENNIZZI ====================

/**
 * Check if all managers have submitted their decisions
 */
export async function canAdvanceFromCalcoloIndennizzi(
  sessionId: string
): Promise<{ canAdvance: boolean; reason?: string }> {
  const session = await prisma.marketSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { canAdvance: false, reason: 'Sessione non trovata' }
  }

  if (session.currentPhase !== 'CALCOLO_INDENNIZZI') {
    return { canAdvance: true }
  }

  // Get all members with affected players
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: session.leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          status: RosterStatus.ACTIVE,
          player: {
            listStatus: 'NOT_IN_LIST',
            exitReason: { not: null },
          },
        },
        include: {
          contract: true,
        },
      },
    },
  })

  // Filter to members who have affected players with contracts
  const managersWithAffected = members.filter(m =>
    m.roster.some(r => r.contract)
  )

  // Get decisions for this session
  const decisions = await prisma.indemnityDecision.findMany({
    where: { sessionId },
  })

  const decidedMemberIds = new Set(decisions.map(d => d.memberId))

  const notDecided = managersWithAffected.filter(m => !decidedMemberIds.has(m.id))

  if (notDecided.length > 0) {
    const names = notDecided.map(m => m.user.username).join(', ')
    return {
      canAdvance: false,
      reason: `Manager non hanno inviato decisioni: ${names}`,
    }
  }

  return { canAdvance: true }
}

// ==================== AUTO-PROCESS EXITED PLAYERS ====================

export interface AutoProcessResult {
  totalProcessed: number
  byExitReason: {
    ritirato: { count: number; players: string[] }
    retrocesso: { count: number; players: string[] }
    estero: { count: number; players: string[]; totalCompensation: number }
  }
  memberResults: Array<{
    memberId: string
    memberUsername: string
    playersReleased: number
    compensationReceived: number
  }>
}

/**
 * Auto-process all exited players when creating a MERCATO_RICORRENTE.
 * Automatically releases all players with listStatus=NOT_IN_LIST and a classified exitReason.
 * - RITIRATO: released, no compensation
 * - RETROCESSO: released, no compensation
 * - ESTERO: released, compensation = MIN(rescissionClause, indennizzoEstero)
 */
export async function autoProcessExitedPlayers(
  leagueId: string,
  sessionId: string
): Promise<AutoProcessResult> {
  const emptyResult: AutoProcessResult = {
    totalProcessed: 0,
    byExitReason: {
      ritirato: { count: 0, players: [] },
      retrocesso: { count: 0, players: [] },
      estero: { count: 0, players: [], totalCompensation: 0 },
    },
    memberResults: [],
  }

  // Find all members with affected roster entries
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          status: RosterStatus.ACTIVE,
          player: {
            listStatus: 'NOT_IN_LIST',
            exitReason: { not: null },
          },
        },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  // Filter to members who have affected players with contracts
  const membersWithAffected = members.filter(m =>
    m.roster.some(r => r.contract)
  )

  if (membersWithAffected.length === 0) {
    return emptyResult
  }

  // Get indennizzoEstero from the most recent completed session's prize config
  let defaultIndennizzoEstero = 50
  const previousSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      id: { not: sessionId },
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
  })

  const indennizzoMap = new Map<string, number>()
  if (previousSession) {
    const prevCategory = await prisma.prizeCategory.findFirst({
      where: {
        marketSessionId: previousSession.id,
        name: 'Indennizzo Partenza Estero',
        isSystemPrize: true,
      },
      include: { managerPrizes: true },
    })
    if (prevCategory) {
      for (const prize of prevCategory.managerPrizes) {
        indennizzoMap.set(prize.leagueMemberId, prize.amount)
      }
      // Use the first non-zero value as default if available
      const values = prevCategory.managerPrizes.map(p => p.amount).filter(a => a > 0)
      if (values.length > 0) {
        defaultIndennizzoEstero = values[0]
      }
    }
  }

  // Collect data for movements (to record AFTER transaction)
  const movementsToRecord: Array<{
    playerId: string
    movementType: 'RETIREMENT' | 'RELEGATION_RELEASE' | 'ABROAD_COMPENSATION'
    fromMemberId: string
    price: number
  }> = []

  const byExitReason = {
    ritirato: { count: 0, players: [] as string[] },
    retrocesso: { count: 0, players: [] as string[] },
    estero: { count: 0, players: [] as string[], totalCompensation: 0 },
  }

  // Process all in a single transaction
  const memberResults = await prisma.$transaction(async (tx) => {
    const results: AutoProcessResult['memberResults'] = []

    for (const member of membersWithAffected) {
      const affectedRosters = member.roster.filter(r => r.contract)
      let memberCompensation = 0

      for (const roster of affectedRosters) {
        const exitReason = roster.player.exitReason!
        let compensation = 0

        // Delete contract
        await tx.playerContract.delete({
          where: { id: roster.contract!.id },
        })

        // Release from roster
        await tx.playerRoster.update({
          where: { id: roster.id },
          data: {
            status: RosterStatus.RELEASED,
            releasedAt: new Date(),
          },
        })

        if (exitReason === 'ESTERO') {
          const memberIndennizzo = indennizzoMap.get(member.id) ?? defaultIndennizzoEstero
          compensation = Math.min(roster.contract!.rescissionClause, memberIndennizzo)

          await tx.leagueMember.update({
            where: { id: member.id },
            data: { currentBudget: { increment: compensation } },
          })

          byExitReason.estero.count++
          byExitReason.estero.players.push(roster.player.name)
          byExitReason.estero.totalCompensation += compensation

          movementsToRecord.push({
            playerId: roster.playerId,
            movementType: 'ABROAD_COMPENSATION',
            fromMemberId: member.id,
            price: compensation,
          })
        } else if (exitReason === 'RITIRATO') {
          byExitReason.ritirato.count++
          byExitReason.ritirato.players.push(roster.player.name)

          movementsToRecord.push({
            playerId: roster.playerId,
            movementType: 'RETIREMENT',
            fromMemberId: member.id,
            price: 0,
          })
        } else if (exitReason === 'RETROCESSO') {
          byExitReason.retrocesso.count++
          byExitReason.retrocesso.players.push(roster.player.name)

          movementsToRecord.push({
            playerId: roster.playerId,
            movementType: 'RELEGATION_RELEASE',
            fromMemberId: member.id,
            price: 0,
          })
        }

        memberCompensation += compensation
      }

      // Create IndemnityDecision record for tracking
      await tx.indemnityDecision.create({
        data: {
          sessionId,
          memberId: member.id,
          decisions: affectedRosters.map(r => ({
            rosterId: r.id,
            playerId: r.playerId,
            playerName: r.player.name,
            exitReason: r.player.exitReason,
            decision: 'RELEASE',
            auto: true,
          })) as unknown as Prisma.InputJsonValue,
        },
      })

      results.push({
        memberId: member.id,
        memberUsername: member.user.username,
        playersReleased: affectedRosters.length,
        compensationReceived: memberCompensation,
      })
    }

    return results
  })

  // Record movements OUTSIDE transaction (following existing pattern)
  for (const movement of movementsToRecord) {
    await recordMovement({
      leagueId,
      playerId: movement.playerId,
      movementType: movement.movementType,
      fromMemberId: movement.fromMemberId,
      price: movement.price,
      marketSessionId: sessionId,
    })
  }

  const totalProcessed = byExitReason.ritirato.count + byExitReason.retrocesso.count + byExitReason.estero.count

  return {
    totalProcessed,
    byExitReason,
    memberResults,
  }
}
