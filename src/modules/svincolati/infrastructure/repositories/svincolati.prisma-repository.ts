/**
 * SvincolatiPrismaRepository - Prisma Implementation
 *
 * CRITICAL: This repository implements atomic operations for real-time performance.
 * All critical operations use Prisma transactions to prevent race conditions.
 *
 * Note: The current schema uses JSON fields for svincolati data in MarketSession.
 * This repository works with the JSON structure until full normalization is complete.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type {
  ISvincolatiRepository,
  NominateAtomicData,
  Player,
} from '../../domain/repositories/svincolati.repository.interface'
import type {
  SvincolatiSession,
  UpdateSvincolatiSessionData,
} from '../../domain/entities/svincolati-session.entity'
import type { SvincolatiTurnOrder } from '../../domain/entities/turn-order.entity'
import type {
  SvincolatiNomination,
  UpdateNominationData,
  NominateResult,
} from '../../domain/entities/nomination.entity'

// =============================================================================
// Type Definitions for JSON Data
// =============================================================================

interface TurnOrderJson {
  memberId: string
  hasPassed: boolean
  hasFinished: boolean
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class SvincolatiPrismaRepository implements ISvincolatiRepository {
  // ==================== SESSION OPERATIONS ====================

  async getSession(sessionId: string): Promise<SvincolatiSession | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.currentPhase !== 'ASTA_SVINCOLATI') {
      return null
    }

    return this.mapToSvincolatiSession(session)
  }

  async getActiveSessionByLeagueId(leagueId: string): Promise<SvincolatiSession | null> {
    const session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        currentPhase: 'ASTA_SVINCOLATI',
        status: 'ACTIVE',
      },
    })

    if (!session) return null

    return this.mapToSvincolatiSession(session)
  }

  async updateSession(sessionId: string, data: UpdateSvincolatiSessionData): Promise<void> {
    const updateData: Record<string, unknown> = {}

    if (data.status !== undefined) {
      updateData.svincolatiState = data.status
    }
    if (data.currentNominatorId !== undefined) {
      updateData.svincolatiPendingNominatorId = data.currentNominatorId
    }
    if (data.currentRound !== undefined) {
      updateData.svincolatiCurrentTurnIndex = data.currentRound
    }
    if (data.timerSeconds !== undefined) {
      updateData.svincolatiTimerSeconds = data.timerSeconds
    }

    await prisma.marketSession.update({
      where: { id: sessionId },
      data: updateData,
    })
  }

  // ==================== TURN ORDER OPERATIONS ====================

  async getTurnOrder(sessionId: string): Promise<SvincolatiTurnOrder[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { svincolatiTurnOrder: true },
    })

    if (!session?.svincolatiTurnOrder) return []

    const turnOrder = session.svincolatiTurnOrder as unknown as TurnOrderJson[]

    return turnOrder.map((t, idx) => ({
      id: `${sessionId}-${t.memberId}`,
      sessionId,
      memberId: t.memberId,
      orderIndex: idx,
      hasPassed: t.hasPassed || false,
      hasFinished: t.hasFinished || false,
    }))
  }

  async setTurnOrder(sessionId: string, memberIds: string[]): Promise<void> {
    const turnOrder: TurnOrderJson[] = memberIds.map((memberId) => ({
      memberId,
      hasPassed: false,
      hasFinished: false,
    }))

    await prisma.marketSession.update({
      where: { id: sessionId },
      data: {
        svincolatiTurnOrder: turnOrder as unknown as Prisma.InputJsonValue,
        svincolatiCurrentTurnIndex: 0,
      },
    })
  }

  async markPassed(sessionId: string, memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiTurnOrder: true, svincolatiPassedMembers: true },
      })

      const turnOrder = (session?.svincolatiTurnOrder as unknown as TurnOrderJson[]) || []
      const passedMembers = (session?.svincolatiPassedMembers as string[]) || []

      // Update turn order JSON
      const updatedTurnOrder = turnOrder.map((t) =>
        t.memberId === memberId ? { ...t, hasPassed: true } : t
      )

      // Also update passedMembers array for backward compatibility
      const updatedPassedMembers = passedMembers.includes(memberId)
        ? passedMembers
        : [...passedMembers, memberId]

      await tx.marketSession.update({
        where: { id: sessionId },
        data: {
          svincolatiTurnOrder: updatedTurnOrder as unknown as Prisma.InputJsonValue,
          svincolatiPassedMembers: updatedPassedMembers,
        },
      })
    })
  }

  async resetPasses(sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiTurnOrder: true },
      })

      const turnOrder = (session?.svincolatiTurnOrder as unknown as TurnOrderJson[]) || []

      const updatedTurnOrder = turnOrder.map((t) => ({ ...t, hasPassed: false }))

      await tx.marketSession.update({
        where: { id: sessionId },
        data: {
          svincolatiTurnOrder: updatedTurnOrder as unknown as Prisma.InputJsonValue,
          svincolatiPassedMembers: [],
        },
      })
    })
  }

  async markFinished(sessionId: string, memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiTurnOrder: true, svincolatiFinishedMembers: true },
      })

      const turnOrder = (session?.svincolatiTurnOrder as unknown as TurnOrderJson[]) || []
      const finishedMembers = (session?.svincolatiFinishedMembers as string[]) || []

      const updatedTurnOrder = turnOrder.map((t) =>
        t.memberId === memberId ? { ...t, hasFinished: true, hasPassed: true } : t
      )

      const updatedFinishedMembers = finishedMembers.includes(memberId)
        ? finishedMembers
        : [...finishedMembers, memberId]

      await tx.marketSession.update({
        where: { id: sessionId },
        data: {
          svincolatiTurnOrder: updatedTurnOrder as unknown as Prisma.InputJsonValue,
          svincolatiFinishedMembers: updatedFinishedMembers,
        },
      })
    })
  }

  async unmarkFinished(sessionId: string, memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiTurnOrder: true, svincolatiFinishedMembers: true },
      })

      const turnOrder = (session?.svincolatiTurnOrder as unknown as TurnOrderJson[]) || []
      const finishedMembers = (session?.svincolatiFinishedMembers as string[]) || []

      const updatedTurnOrder = turnOrder.map((t) =>
        t.memberId === memberId ? { ...t, hasFinished: false } : t
      )

      const updatedFinishedMembers = finishedMembers.filter((m) => m !== memberId)

      await tx.marketSession.update({
        where: { id: sessionId },
        data: {
          svincolatiTurnOrder: updatedTurnOrder as unknown as Prisma.InputJsonValue,
          svincolatiFinishedMembers: updatedFinishedMembers,
        },
      })
    })
  }

  async getCurrentTurnMemberId(sessionId: string): Promise<string | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { svincolatiTurnOrder: true, svincolatiCurrentTurnIndex: true },
    })

    if (!session?.svincolatiTurnOrder) return null

    const turnOrder = session.svincolatiTurnOrder as unknown as TurnOrderJson[]
    const currentIndex = session.svincolatiCurrentTurnIndex ?? 0

    // Find next active member starting from current index
    for (let i = 0; i < turnOrder.length; i++) {
      const idx = (currentIndex + i) % turnOrder.length
      const entry = turnOrder[idx]
      if (entry && !entry.hasPassed && !entry.hasFinished) {
        return entry.memberId
      }
    }

    return null
  }

  async advanceToNextMember(sessionId: string): Promise<SvincolatiTurnOrder | null> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiTurnOrder: true, svincolatiCurrentTurnIndex: true },
      })

      if (!session?.svincolatiTurnOrder) return null

      const turnOrder = session.svincolatiTurnOrder as unknown as TurnOrderJson[]
      const currentIndex = session.svincolatiCurrentTurnIndex ?? 0

      // Find next active member
      for (let i = 1; i <= turnOrder.length; i++) {
        const idx = (currentIndex + i) % turnOrder.length
        const entry = turnOrder[idx]
        if (entry && !entry.hasPassed && !entry.hasFinished) {
          await tx.marketSession.update({
            where: { id: sessionId },
            data: { svincolatiCurrentTurnIndex: idx },
          })

          return {
            id: `${sessionId}-${entry.memberId}`,
            sessionId,
            memberId: entry.memberId,
            orderIndex: idx,
            hasPassed: entry.hasPassed,
            hasFinished: entry.hasFinished,
          }
        }
      }

      return null
    })
  }

  // ==================== NOMINATION OPERATIONS ====================

  async nominatePlayerAtomic(data: NominateAtomicData): Promise<NominateResult> {
    return prisma.$transaction(async (tx) => {
      // Get session and verify state
      const session = await tx.marketSession.findUnique({
        where: { id: data.sessionId },
        include: {
          auctions: {
            where: { status: 'ACTIVE' },
          },
        },
      })

      if (!session) {
        return { success: false, error: 'SESSION_NOT_ACTIVE' }
      }

      // Check for existing active auction
      if (session.auctions.length > 0) {
        return { success: false, error: 'WRONG_PHASE' }
      }

      // Verify the nominator is the current turn holder
      const turnOrder = (session.svincolatiTurnOrder as unknown as TurnOrderJson[]) || []
      const currentIndex = session.svincolatiCurrentTurnIndex ?? 0
      const currentEntry = turnOrder[currentIndex]

      if (!currentEntry || currentEntry.memberId !== data.nominatorId) {
        return { success: false, error: 'NOT_YOUR_TURN' }
      }

      // Check if player is already owned in this league
      const owned = await tx.playerRoster.findFirst({
        where: {
          playerId: data.playerId,
          status: 'ACTIVE',
          leagueMember: { leagueId: session.leagueId },
        },
      })

      if (owned) {
        return { success: false, error: 'PLAYER_ALREADY_OWNED' }
      }

      // Check if player exists and is active
      const player = await tx.serieAPlayer.findUnique({
        where: { id: data.playerId },
      })

      if (!player || !player.isActive) {
        return { success: false, error: 'INVALID_PLAYER' }
      }

      // Check nominator's budget
      const member = await tx.leagueMember.findUnique({
        where: { id: data.nominatorId },
        select: { currentBudget: true },
      })

      if (!member || member.currentBudget < 1) {
        return { success: false, error: 'INSUFFICIENT_BUDGET' }
      }

      // Create auction for nominated player
      const auction = await tx.auction.create({
        data: {
          leagueId: session.leagueId,
          marketSessionId: data.sessionId,
          playerId: data.playerId,
          type: 'FREE_BID',
          basePrice: 1,
          currentPrice: 1,
          status: 'ACTIVE',
          nominatorId: data.nominatorId,
          timerSeconds: session.svincolatiTimerSeconds,
          timerExpiresAt: new Date(Date.now() + session.svincolatiTimerSeconds * 1000),
        },
      })

      // Update session state
      await tx.marketSession.update({
        where: { id: data.sessionId },
        data: {
          svincolatiState: 'AUCTION',
          svincolatiPendingPlayerId: data.playerId,
          svincolatiPendingNominatorId: data.nominatorId,
          svincolatiTimerStartedAt: new Date(),
        },
      })

      // Create nomination record
      const nomination: SvincolatiNomination = {
        id: `nom-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        sessionId: data.sessionId,
        playerId: data.playerId,
        nominatorId: data.nominatorId,
        round: data.round,
        status: 'IN_AUCTION',
        createdAt: new Date(),
        auctionId: auction.id,
        winnerId: null,
        finalPrice: null,
      }

      return { success: true, nomination }
    })
  }

  async getNominations(sessionId: string): Promise<SvincolatiNomination[]> {
    // Nominations are tracked through auctions in the current schema
    const auctions = await prisma.auction.findMany({
      where: {
        marketSessionId: sessionId,
        type: 'FREE_BID',
      },
      orderBy: { createdAt: 'asc' },
    })

    return auctions.map((auction) => ({
      id: auction.id,
      sessionId,
      playerId: auction.playerId,
      nominatorId: auction.nominatorId ?? '',
      round: 1, // Round tracking would need to be added
      status: this.mapAuctionStatusToNominationStatus(auction.status),
      createdAt: auction.createdAt,
      auctionId: auction.id,
      winnerId: auction.winnerId,
      finalPrice: auction.currentPrice,
    }))
  }

  async getPendingNomination(sessionId: string): Promise<SvincolatiNomination | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: {
        svincolatiPendingPlayerId: true,
        svincolatiPendingNominatorId: true,
        svincolatiNominatorConfirmed: true,
      },
    })

    if (!session?.svincolatiPendingPlayerId) return null

    // Find the active auction for this nomination
    const auction = await prisma.auction.findFirst({
      where: {
        marketSessionId: sessionId,
        playerId: session.svincolatiPendingPlayerId,
        status: 'ACTIVE',
      },
    })

    return {
      id: auction?.id ?? `pending-${sessionId}`,
      sessionId,
      playerId: session.svincolatiPendingPlayerId,
      nominatorId: session.svincolatiPendingNominatorId ?? '',
      round: 1,
      status: session.svincolatiNominatorConfirmed ? 'CONFIRMED' : 'PENDING',
      createdAt: new Date(),
      auctionId: auction?.id ?? null,
      winnerId: null,
      finalPrice: null,
    }
  }

  async updateNomination(_id: string, data: UpdateNominationData): Promise<void> {
    // Nominations are tracked through auctions
    if (data.auctionId && (data.status === 'SOLD' || data.status === 'UNSOLD')) {
      await prisma.auction.update({
        where: { id: data.auctionId },
        data: {
          status: data.status === 'SOLD' ? 'COMPLETED' : 'CANCELLED',
          winnerId: data.winnerId,
          currentPrice: data.finalPrice ?? 1,
        },
      })
    }
  }

  async cancelNomination(id: string): Promise<boolean> {
    try {
      // Check if it's an auction ID
      const auction = await prisma.auction.findUnique({
        where: { id },
      })

      if (auction && auction.status === 'ACTIVE') {
        await prisma.auction.update({
          where: { id },
          data: { status: 'CANCELLED' },
        })
        return true
      }

      return false
    } catch {
      return false
    }
  }

  // ==================== PLAYER OPERATIONS ====================

  async getAvailablePlayers(
    sessionId: string,
    filters?: {
      position?: 'P' | 'D' | 'C' | 'A'
      team?: string
      search?: string
      minQuotation?: number
      maxQuotation?: number
    }
  ): Promise<Player[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { leagueId: true },
    })

    if (!session) return []

    // Get all players owned in this league
    const ownedPlayerIds = await prisma.playerRoster.findMany({
      where: {
        status: 'ACTIVE',
        leagueMember: { leagueId: session.leagueId },
      },
      select: { playerId: true },
    })

    const ownedIds = ownedPlayerIds.map((r) => r.playerId)

    // Build filters
    const where: Record<string, unknown> = {
      isActive: true,
      id: { notIn: ownedIds },
    }

    if (filters?.position) {
      where.position = filters.position
    }
    if (filters?.team) {
      where.team = filters.team
    }
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' }
    }
    if (filters?.minQuotation !== undefined || filters?.maxQuotation !== undefined) {
      where.quotation = {}
      if (filters?.minQuotation !== undefined) {
        ;(where.quotation as Record<string, unknown>).gte = filters.minQuotation
      }
      if (filters?.maxQuotation !== undefined) {
        ;(where.quotation as Record<string, unknown>).lte = filters.maxQuotation
      }
    }

    const players = await prisma.serieAPlayer.findMany({
      where,
      orderBy: [{ quotation: 'desc' }, { name: 'asc' }],
    })

    return players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      position: p.position as 'P' | 'D' | 'C' | 'A',
      quotation: p.quotation,
      isActive: p.isActive,
    }))
  }

  async isPlayerOwned(sessionId: string, playerId: string): Promise<boolean> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { leagueId: true },
    })

    if (!session) return false

    const roster = await prisma.playerRoster.findFirst({
      where: {
        playerId,
        status: 'ACTIVE',
        leagueMember: { leagueId: session.leagueId },
      },
    })

    return !!roster
  }

  async isPlayerNominated(sessionId: string, playerId: string): Promise<boolean> {
    const auction = await prisma.auction.findFirst({
      where: {
        marketSessionId: sessionId,
        playerId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
    })

    return !!auction
  }

  // ==================== MEMBER OPERATIONS ====================

  async getMemberBudget(memberId: string): Promise<number> {
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { currentBudget: true },
    })

    return member?.currentBudget ?? 0
  }

  async getActiveMembers(sessionId: string): Promise<
    Array<{
      id: string
      userId: string
      username: string
      currentBudget: number
      isAdmin: boolean
    }>
  > {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { leagueId: true },
    })

    if (!session) return []

    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: session.leagueId,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    })

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      username: m.user.username,
      currentBudget: m.currentBudget,
      isAdmin: m.role === 'ADMIN',
    }))
  }

  // ==================== READY CHECK OPERATIONS ====================

  async getReadyMembers(sessionId: string): Promise<string[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { svincolatiReadyMembers: true },
    })

    return (session?.svincolatiReadyMembers as string[]) || []
  }

  async markReady(sessionId: string, memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { svincolatiReadyMembers: true },
      })

      const readyMembers = (session?.svincolatiReadyMembers as string[]) || []

      if (!readyMembers.includes(memberId)) {
        await tx.marketSession.update({
          where: { id: sessionId },
          data: { svincolatiReadyMembers: [...readyMembers, memberId] },
        })
      }
    })
  }

  async clearReadyMarks(sessionId: string): Promise<void> {
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: { svincolatiReadyMembers: [] },
    })
  }

  async areAllReady(sessionId: string): Promise<boolean> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { svincolatiReadyMembers: true, leagueId: true },
    })

    if (!session) return false

    const readyMembers = (session.svincolatiReadyMembers as string[]) || []

    const activeMembers = await prisma.leagueMember.count({
      where: {
        leagueId: session.leagueId,
        status: 'ACTIVE',
      },
    })

    return readyMembers.length >= activeMembers
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private mapToSvincolatiSession(session: {
    id: string
    svincolatiState: string | null
    svincolatiPendingNominatorId: string | null
    svincolatiCurrentTurnIndex: number | null
    svincolatiTimerSeconds: number
  }): SvincolatiSession {
    return {
      marketSessionId: session.id,
      status: this.mapStateToStatus(session.svincolatiState ?? 'SETUP'),
      currentNominatorId: session.svincolatiPendingNominatorId,
      currentRound: session.svincolatiCurrentTurnIndex ?? 1,
      totalRounds: 99, // Default, could be stored in session config
      timerSeconds: session.svincolatiTimerSeconds,
    }
  }

  private mapStateToStatus(
    state: string
  ): 'SETUP' | 'READY_CHECK' | 'NOMINATION' | 'AUCTION' | 'PENDING_ACK' | 'COMPLETED' {
    switch (state) {
      case 'SETUP':
        return 'SETUP'
      case 'READY_CHECK':
        return 'READY_CHECK'
      case 'NOMINATION':
        return 'NOMINATION'
      case 'AUCTION':
        return 'AUCTION'
      case 'PENDING_ACK':
        return 'PENDING_ACK'
      case 'COMPLETED':
        return 'COMPLETED'
      default:
        return 'SETUP'
    }
  }

  private mapAuctionStatusToNominationStatus(
    auctionStatus: string
  ): 'PENDING' | 'CONFIRMED' | 'IN_AUCTION' | 'SOLD' | 'UNSOLD' {
    switch (auctionStatus) {
      case 'PENDING':
        return 'PENDING'
      case 'ACTIVE':
        return 'IN_AUCTION'
      case 'COMPLETED':
        return 'SOLD'
      case 'CANCELLED':
        return 'UNSOLD'
      default:
        return 'PENDING'
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const svincolatiPrismaRepository = new SvincolatiPrismaRepository()
