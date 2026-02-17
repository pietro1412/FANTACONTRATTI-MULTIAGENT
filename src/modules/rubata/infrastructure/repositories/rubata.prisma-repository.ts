/**
 * RubataPrismaRepository - Prisma Implementation
 *
 * CRITICAL: This repository implements atomic operations for real-time performance.
 * All critical operations use Prisma transactions to prevent race conditions.
 *
 * Note: The current schema uses JSON fields for rubata data in MarketSession.
 * This repository works with the JSON structure until full normalization is complete.
 */

import { prisma } from '@/lib/prisma'
import type {
  IRubataRepository,
  AddToBoardData,
  PlaceOfferData,
  PlaceOfferResult,
} from '../../domain/repositories/rubata.repository.interface'
import type { RubataSession, RubataStatus, RubataPhase } from '../../domain/entities/rubata-session.entity'
import type { RubataBoardEntry, RubataBoardEntryWithDetails, RubataBoardStatus } from '../../domain/entities/rubata-board.entity'
import type { RubataOffer } from '../../domain/entities/rubata-offer.entity'
import type { RubataReadyStatus } from '../../domain/entities/rubata-ready.entity'

// =============================================================================
// Type Definitions for JSON Data
// =============================================================================

interface RubataBoardEntryJson {
  id: string
  rosterId: string
  memberId: string
  playerId: string
  status: RubataBoardStatus
  createdAt: string
  currentOffer?: number
  highestOfferId?: string
  offeredById?: string
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class RubataPrismaRepository implements IRubataRepository {
  // =============================================
  // Session Management
  // =============================================

  async getSession(sessionId: string): Promise<RubataSession | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.currentPhase !== 'RUBATA') {
      return null
    }

    return this.mapToRubataSession(session)
  }

  async updateSessionStatus(sessionId: string, status: RubataStatus): Promise<void> {
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: { rubataState: status },
    })
  }

  async updateSessionPhase(sessionId: string, phase: RubataPhase): Promise<void> {
    // Map phase to rubataState for consistency with current schema
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: { rubataState: phase },
    })
  }

  async getSessionMembers(sessionId: string): Promise<string[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      include: {
        league: {
          include: {
            members: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!session) return []
    return session.league.members.map((m) => m.id)
  }

  // =============================================
  // Board Management
  // =============================================

  async getBoardEntries(sessionId: string): Promise<RubataBoardEntry[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { rubataBoard: true },
    })

    if (!session?.rubataBoard) return []

    const board = session.rubataBoard as RubataBoardEntryJson[]
    return board.map((entry) => this.mapJsonToBoardEntry(entry, sessionId))
  }

  async getBoardEntriesWithDetails(sessionId: string): Promise<RubataBoardEntryWithDetails[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { rubataBoard: true, leagueId: true },
    })

    if (!session?.rubataBoard) return []

    const board = session.rubataBoard as RubataBoardEntryJson[]
    const playerIds = board.map((e) => e.playerId)
    const memberIds = board.map((e) => e.memberId)
    const rosterIds = board.map((e) => e.rosterId)

    // Fetch all related data in parallel
    const [players, members, rosters] = await Promise.all([
      prisma.serieAPlayer.findMany({
        where: { id: { in: playerIds } },
      }),
      prisma.leagueMember.findMany({
        where: { id: { in: memberIds } },
        include: { user: { select: { username: true } } },
      }),
      prisma.playerRoster.findMany({
        where: { id: { in: rosterIds } },
        include: { contract: true },
      }),
    ])

    // Create lookup maps
    const playerMap = new Map(players.map((p) => [p.id, p]))
    const memberMap = new Map(members.map((m) => [m.id, m]))
    const rosterMap = new Map(rosters.map((r) => [r.id, r]))

    return board.map((entry) => {
      const player = playerMap.get(entry.playerId)
      const member = memberMap.get(entry.memberId)
      const roster = rosterMap.get(entry.rosterId)
      const contract = roster?.contract

      const salary = contract?.salary ?? 0
      const clause = contract?.rescissionClause ?? 0
      const basePrice = clause + salary

      return {
        ...this.mapJsonToBoardEntry(entry, sessionId),
        playerName: player?.name ?? 'Unknown',
        playerPosition: player?.position ?? 'Unknown',
        playerTeam: player?.team ?? 'Unknown',
        ownerUsername: member?.user.username ?? 'Unknown',
        ownerTeamName: member?.teamName ?? null,
        contractSalary: salary,
        contractDuration: contract?.duration ?? 0,
        contractClause: clause,
        rubataBasePrice: basePrice,
      }
    })
  }

  async getBoardEntry(entryId: string): Promise<RubataBoardEntry | null> {
    // Find all sessions with rubataBoard containing this entry
    const sessions = await prisma.marketSession.findMany({
      where: {
        currentPhase: 'RUBATA',
        rubataBoard: { not: null },
      },
      select: { id: true, rubataBoard: true },
    })

    for (const session of sessions) {
      const board = session.rubataBoard as RubataBoardEntryJson[]
      const entry = board.find((e) => e.id === entryId)
      if (entry) {
        return this.mapJsonToBoardEntry(entry, session.id)
      }
    }

    return null
  }

  async getCurrentBoardEntry(sessionId: string): Promise<RubataBoardEntryWithDetails | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { rubataBoard: true, rubataBoardIndex: true },
    })

    if (!session?.rubataBoard) return null

    const board = session.rubataBoard as RubataBoardEntryJson[]
    const currentIndex = session.rubataBoardIndex ?? 0

    if (currentIndex >= board.length) return null

    const entries = await this.getBoardEntriesWithDetails(sessionId)
    return entries[currentIndex] ?? null
  }

  async addToBoardAtomic(data: AddToBoardData): Promise<RubataBoardEntry> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: data.sessionId },
        select: { rubataBoard: true },
      })

      const board = (session?.rubataBoard as RubataBoardEntryJson[]) || []

      // Generate unique ID for the entry
      const newEntry: RubataBoardEntryJson = {
        id: `rubata-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        rosterId: data.rosterId,
        memberId: data.memberId,
        playerId: data.playerId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      }

      await tx.marketSession.update({
        where: { id: data.sessionId },
        data: { rubataBoard: [...board, newEntry] },
      })

      return this.mapJsonToBoardEntry(newEntry, data.sessionId)
    })
  }

  async removeFromBoard(entryId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const sessions = await tx.marketSession.findMany({
        where: {
          currentPhase: 'RUBATA',
          rubataBoard: { not: null },
        },
        select: { id: true, rubataBoard: true },
      })

      for (const session of sessions) {
        const board = session.rubataBoard as RubataBoardEntryJson[]
        const filteredBoard = board.filter((e) => e.id !== entryId)

        if (filteredBoard.length !== board.length) {
          await tx.marketSession.update({
            where: { id: session.id },
            data: { rubataBoard: filteredBoard },
          })
          break
        }
      }
    })
  }

  async updateBoardEntryStatus(entryId: string, status: RubataBoardEntry['status']): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const sessions = await tx.marketSession.findMany({
        where: {
          currentPhase: 'RUBATA',
          rubataBoard: { not: null },
        },
        select: { id: true, rubataBoard: true },
      })

      for (const session of sessions) {
        const board = session.rubataBoard as RubataBoardEntryJson[]
        const entryIndex = board.findIndex((e) => e.id === entryId)

        if (entryIndex !== -1) {
          const updatedBoard = [...board]
          updatedBoard[entryIndex] = { ...board[entryIndex]!, status }

          await tx.marketSession.update({
            where: { id: session.id },
            data: { rubataBoard: updatedBoard },
          })
          break
        }
      }
    })
  }

  async getMemberBoardCount(sessionId: string, memberId: string): Promise<number> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { rubataBoard: true },
    })

    if (!session?.rubataBoard) return 0

    const board = session.rubataBoard as RubataBoardEntryJson[]
    return board.filter((e) => e.memberId === memberId).length
  }

  // =============================================
  // Ready Status
  // =============================================

  async getReadyStatus(sessionId: string): Promise<RubataReadyStatus[]> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: { rubataReadyMembers: true },
      include: {
        league: {
          include: {
            members: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!session) return []

    const readyMembers = (session.rubataReadyMembers as string[]) || []
    const allMembers = session.league.members

    return allMembers.map((member) => ({
      id: `${sessionId}-${member.id}`,
      sessionId,
      memberId: member.id,
      isReady: readyMembers.includes(member.id),
      readyAt: readyMembers.includes(member.id) ? new Date() : null,
    }))
  }

  async setReady(sessionId: string, memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.marketSession.findUnique({
        where: { id: sessionId },
        select: { rubataReadyMembers: true },
      })

      const readyMembers = (session?.rubataReadyMembers as string[]) || []

      if (!readyMembers.includes(memberId)) {
        await tx.marketSession.update({
          where: { id: sessionId },
          data: { rubataReadyMembers: [...readyMembers, memberId] },
        })
      }
    })
  }

  async resetAllReady(sessionId: string): Promise<void> {
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: { rubataReadyMembers: [] },
    })
  }

  async initializeReadyStatuses(sessionId: string, _memberIds: string[]): Promise<void> {
    // Initialize with empty ready list - all members start as not ready
    await prisma.marketSession.update({
      where: { id: sessionId },
      data: { rubataReadyMembers: [] },
    })
  }

  // =============================================
  // Offers - CRITICAL: Atomic Operations
  // =============================================

  async placeOfferAtomic(data: PlaceOfferData): Promise<PlaceOfferResult> {
    return prisma.$transaction(async (tx) => {
      // Find the session containing this board entry
      const sessions = await tx.marketSession.findMany({
        where: {
          currentPhase: 'RUBATA',
          rubataBoard: { not: null },
        },
        select: {
          id: true,
          rubataBoard: true,
          leagueId: true,
        },
      })

      let targetSession: (typeof sessions)[0] | undefined
      let boardEntry: RubataBoardEntryJson | undefined

      for (const session of sessions) {
        const board = session.rubataBoard as RubataBoardEntryJson[]
        boardEntry = board.find((e) => e.id === data.boardEntryId)
        if (boardEntry) {
          targetSession = session
          break
        }
      }

      if (!targetSession || !boardEntry) {
        return { success: false, errorCode: 'ENTRY_NOT_FOUND' as const }
      }

      // Check if entry is already in auction
      if (boardEntry.status === 'IN_AUCTION') {
        return { success: false, errorCode: 'ENTRY_ALREADY_IN_AUCTION' as const }
      }

      // Check if bidder is the player owner
      if (boardEntry.memberId === data.offeredByMemberId) {
        return { success: false, errorCode: 'CANNOT_BID_OWN_PLAYER' as const }
      }

      // Check bidder's budget
      const member = await tx.leagueMember.findUnique({
        where: { id: data.offeredByMemberId },
        select: { currentBudget: true },
      })

      if (!member || member.currentBudget < data.amount) {
        return { success: false, errorCode: 'INSUFFICIENT_BUDGET' as const }
      }

      // Check if offer is higher than current
      const currentHighest = boardEntry.currentOffer ?? 0
      if (data.amount <= currentHighest) {
        return { success: false, errorCode: 'OFFER_TOO_LOW' as const }
      }

      // Update the board entry with the new offer
      const board = targetSession.rubataBoard as RubataBoardEntryJson[]
      const updatedBoard = board.map((e) => {
        if (e.id === data.boardEntryId) {
          return {
            ...e,
            currentOffer: data.amount,
            offeredById: data.offeredByMemberId,
          }
        }
        return e
      })

      await tx.marketSession.update({
        where: { id: targetSession.id },
        data: { rubataBoard: updatedBoard },
      })

      // Create offer record
      const offer: RubataOffer = {
        id: `offer-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        boardEntryId: data.boardEntryId,
        offeredByMemberId: data.offeredByMemberId,
        amount: data.amount,
        status: 'PENDING',
        placedAt: new Date(),
      }

      return {
        success: true,
        offer,
        highestOffer: data.amount,
      }
    })
  }

  async getOffers(boardEntryId: string): Promise<RubataOffer[]> {
    // In the JSON-based approach, offers are not stored separately
    // This will return offers from the board entry's tracking
    // For now, return the current highest offer as the only offer
    const entry = await this.getBoardEntry(boardEntryId)

    if (!entry) return []

    // Get the current offer from the board entry JSON
    const sessions = await prisma.marketSession.findMany({
      where: {
        currentPhase: 'RUBATA',
        rubataBoard: { not: null },
      },
      select: { rubataBoard: true },
    })

    for (const session of sessions) {
      const board = session.rubataBoard as RubataBoardEntryJson[]
      const jsonEntry = board.find((e) => e.id === boardEntryId)

      if (jsonEntry && jsonEntry.currentOffer && jsonEntry.offeredById) {
        return [
          {
            id: `offer-${jsonEntry.id}`,
            boardEntryId,
            offeredByMemberId: jsonEntry.offeredById,
            amount: jsonEntry.currentOffer,
            status: 'PENDING',
            placedAt: new Date(),
          },
        ]
      }
    }

    return []
  }

  async getHighestOffer(boardEntryId: string): Promise<RubataOffer | null> {
    const offers = await this.getOffers(boardEntryId)
    if (offers.length === 0) return null

    return offers.reduce((highest, current) =>
      current.amount > highest.amount ? current : highest
    )
  }

  async cancelPendingOffers(boardEntryId: string): Promise<void> {
    // In the JSON approach, we clear the current offer when auction starts
    await prisma.$transaction(async (tx) => {
      const sessions = await tx.marketSession.findMany({
        where: {
          currentPhase: 'RUBATA',
          rubataBoard: { not: null },
        },
        select: { id: true, rubataBoard: true },
      })

      for (const session of sessions) {
        const board = session.rubataBoard as RubataBoardEntryJson[]
        const entryIndex = board.findIndex((e) => e.id === boardEntryId)

        if (entryIndex !== -1) {
          const updatedBoard = [...board]
          const entry = board[entryIndex]!
          updatedBoard[entryIndex] = {
            ...entry,
            currentOffer: undefined,
            offeredById: undefined,
            status: 'IN_AUCTION',
          }

          await tx.marketSession.update({
            where: { id: session.id },
            data: { rubataBoard: updatedBoard },
          })
          break
        }
      }
    })
  }

  async getMemberBudget(memberId: string): Promise<number> {
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { currentBudget: true },
    })

    return member?.currentBudget ?? 0
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private mapToRubataSession(session: {
    id: string
    rubataState: string | null
    rubataTimerStartedAt: Date | null
  }): RubataSession {
    const state = session.rubataState ?? 'SETUP'

    return {
      marketSessionId: session.id,
      status: this.mapStateToStatus(state),
      currentPhase: this.mapStateToPhase(state),
      boardSetupDeadline: null,
      auctionStartedAt: session.rubataTimerStartedAt,
    }
  }

  private mapStateToStatus(state: string): RubataStatus {
    switch (state) {
      case 'WAITING':
      case 'READY_CHECK':
        return 'SETUP'
      case 'BOARD_SELECTION':
        return 'BOARD_SELECTION'
      case 'OFFERING':
      case 'AUCTION_READY_CHECK':
      case 'AUCTION':
        return 'AUCTION'
      case 'COMPLETED':
        return 'COMPLETED'
      default:
        return 'SETUP'
    }
  }

  private mapStateToPhase(state: string): RubataPhase {
    switch (state) {
      case 'WAITING':
      case 'READY_CHECK':
        return 'WAITING_READY'
      case 'BOARD_SELECTION':
        return 'BOARD_SELECTION'
      case 'OFFERING':
        return 'OFFERS'
      case 'AUCTION_READY_CHECK':
      case 'AUCTION':
        return 'AUCTION'
      case 'COMPLETED':
        return 'DONE'
      default:
        return 'WAITING_READY'
    }
  }

  private mapJsonToBoardEntry(json: RubataBoardEntryJson, sessionId: string): RubataBoardEntry {
    return {
      id: json.id,
      sessionId,
      rosterId: json.rosterId,
      memberId: json.memberId,
      playerId: json.playerId,
      status: json.status,
      createdAt: new Date(json.createdAt),
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const rubataPrismaRepository = new RubataPrismaRepository()
