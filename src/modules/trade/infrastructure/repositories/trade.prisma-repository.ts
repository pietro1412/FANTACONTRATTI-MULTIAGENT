/**
 * Trade Prisma Repository - Infrastructure Layer
 *
 * Implements ITradeRepository interface using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type {
  ITradeRepository,
  RosterInfo,
  MemberBudgetInfo,
} from '../../domain/repositories/trade.repository.interface'
import type { TradeOffer, TradeStatus, CreateTradeOfferData } from '../../domain/entities/trade-offer.entity'

export class TradePrismaRepository implements ITradeRepository {
  /**
   * Find a trade offer by its unique ID
   */
  async findById(id: string): Promise<TradeOffer | null> {
    const trade = await prisma.tradeOffer.findUnique({
      where: { id },
    })
    return trade ? this.mapToTradeOffer(trade) : null
  }

  /**
   * Find all trade offers for a league
   */
  async findByLeague(leagueId: string): Promise<TradeOffer[]> {
    const trades = await prisma.tradeOffer.findMany({
      where: {
        marketSession: {
          leagueId,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return trades.map((t) => this.mapToTradeOffer(t))
  }

  /**
   * Find pending trade offers for a member (as receiver)
   */
  async findPendingForMember(memberId: string): Promise<TradeOffer[]> {
    // Get userId from memberId
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    })
    if (!member) return []

    const trades = await prisma.tradeOffer.findMany({
      where: {
        receiverId: member.userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })
    return trades.map((t) => this.mapToTradeOffer(t))
  }

  /**
   * Find sent trade offers from a member (as sender)
   */
  async findSentByMember(memberId: string): Promise<TradeOffer[]> {
    // Get userId from memberId
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    })
    if (!member) return []

    const trades = await prisma.tradeOffer.findMany({
      where: {
        senderId: member.userId,
      },
      orderBy: { createdAt: 'desc' },
    })
    return trades.map((t) => this.mapToTradeOffer(t))
  }

  /**
   * Create a new trade offer
   */
  async create(data: CreateTradeOfferData): Promise<TradeOffer> {
    // Get userIds from memberIds
    const [senderMember, receiverMember] = await Promise.all([
      prisma.leagueMember.findUnique({
        where: { id: data.senderId },
        select: { userId: true },
      }),
      prisma.leagueMember.findUnique({
        where: { id: data.receiverId },
        select: { userId: true },
      }),
    ])

    if (!senderMember || !receiverMember) {
      throw new Error('Invalid sender or receiver member ID')
    }

    // Get active market session if not provided
    let sessionId = data.marketSessionId
    if (!sessionId) {
      const session = await prisma.marketSession.findFirst({
        where: {
          leagueId: data.leagueId,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      if (!session) {
        throw new Error('No active market session found')
      }
      sessionId = session.id
    }

    // Combine all players for involvedPlayers field
    const involvedPlayers = [...data.senderPlayers, ...data.receiverPlayers]

    const trade = await prisma.tradeOffer.create({
      data: {
        marketSessionId: sessionId,
        senderId: senderMember.userId,
        receiverId: receiverMember.userId,
        offeredPlayers: data.senderPlayers,
        offeredBudget: data.senderBudget,
        requestedPlayers: data.receiverPlayers,
        requestedBudget: data.receiverBudget,
        involvedPlayers,
        status: 'PENDING',
        message: data.message,
        expiresAt: data.expiresAt,
      },
    })
    return this.mapToTradeOffer(trade)
  }

  /**
   * Update the status of a trade offer
   */
  async updateStatus(id: string, status: TradeStatus, respondedAt?: Date): Promise<void> {
    await prisma.tradeOffer.update({
      where: { id },
      data: {
        status,
        respondedAt: respondedAt || new Date(),
      },
    })
  }

  /**
   * Set the counter offer link on the original trade
   */
  async setCounterOffer(originalId: string, counterOfferId: string): Promise<void> {
    await prisma.tradeOffer.update({
      where: { id: counterOfferId },
      data: {
        parentOfferId: originalId,
      },
    })
  }

  /**
   * Get roster information for validation
   */
  async getRosterInfo(rosterIds: string[]): Promise<RosterInfo[]> {
    const rosters = await prisma.playerRoster.findMany({
      where: {
        id: { in: rosterIds },
      },
      select: {
        id: true,
        leagueMemberId: true,
        playerId: true,
        status: true,
      },
    })

    return rosters.map((r) => ({
      id: r.id,
      leagueMemberId: r.leagueMemberId,
      playerId: r.playerId,
      status: r.status,
    }))
  }

  /**
   * Get member budget information
   */
  async getMemberBudget(memberId: string): Promise<MemberBudgetInfo | null> {
    const member = await prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        currentBudget: true,
      },
    })

    if (!member) return null

    return {
      memberId: member.id,
      currentBudget: member.currentBudget,
    }
  }

  /**
   * Execute trade: swap players and budgets between members
   * This is done in a transaction
   */
  async executeTrade(
    tradeId: string,
    senderMemberId: string,
    receiverMemberId: string,
    senderPlayers: string[],
    receiverPlayers: string[],
    senderBudget: number,
    receiverBudget: number
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const trade = await tx.tradeOffer.findUnique({ where: { id: tradeId } })
      if (!trade) throw new Error('Trade not found')

      // Swap players from sender to receiver
      for (const rosterId of senderPlayers) {
        await tx.playerRoster.update({
          where: { id: rosterId },
          data: { leagueMemberId: receiverMemberId },
        })
        // Update contract owner if exists
        await tx.playerContract.updateMany({
          where: { rosterId },
          data: { leagueMemberId: receiverMemberId },
        })
      }

      // Swap players from receiver to sender
      for (const rosterId of receiverPlayers) {
        await tx.playerRoster.update({
          where: { id: rosterId },
          data: { leagueMemberId: senderMemberId },
        })
        // Update contract owner if exists
        await tx.playerContract.updateMany({
          where: { rosterId },
          data: { leagueMemberId: senderMemberId },
        })
      }

      // Update budgets: sender gives senderBudget and receives receiverBudget
      await tx.leagueMember.update({
        where: { id: senderMemberId },
        data: { currentBudget: { increment: receiverBudget - senderBudget } },
      })

      // Receiver gives receiverBudget and receives senderBudget
      await tx.leagueMember.update({
        where: { id: receiverMemberId },
        data: { currentBudget: { increment: senderBudget - receiverBudget } },
      })

      // Update trade status
      await tx.tradeOffer.update({
        where: { id: tradeId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      })
    })
  }

  /**
   * Find accepted trades in same session involving same parties (for anti-loop check)
   */
  async findAcceptedTradesInSession(
    marketSessionId: string,
    senderId: string,
    receiverId: string
  ): Promise<TradeOffer[]> {
    // Get userIds from memberIds
    const [senderMember, receiverMember] = await Promise.all([
      prisma.leagueMember.findUnique({
        where: { id: senderId },
        select: { userId: true },
      }),
      prisma.leagueMember.findUnique({
        where: { id: receiverId },
        select: { userId: true },
      }),
    ])

    if (!senderMember || !receiverMember) return []

    const trades = await prisma.tradeOffer.findMany({
      where: {
        marketSessionId,
        status: 'ACCEPTED',
        OR: [
          { senderId: senderMember.userId, receiverId: receiverMember.userId },
          { senderId: receiverMember.userId, receiverId: senderMember.userId },
        ],
      },
    })
    return trades.map((t) => this.mapToTradeOffer(t))
  }

  /**
   * Check if a trade window is currently open for a league
   */
  async isTradeWindowOpen(leagueId: string): Promise<boolean> {
    const session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
        currentPhase: {
          in: ['OFFERTE_PRE_RINNOVO', 'OFFERTE_POST_ASTA_SVINCOLATI'],
        },
      },
    })
    return session !== null
  }

  /**
   * Get the active market session ID for a league (if any)
   */
  async getActiveMarketSessionId(leagueId: string): Promise<string | null> {
    const session = await prisma.marketSession.findFirst({
      where: {
        leagueId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    return session?.id || null
  }

  /**
   * Map Prisma TradeOffer model to domain TradeOffer entity
   */
  private mapToTradeOffer(prismaOffer: {
    id: string
    marketSessionId: string
    senderId: string
    receiverId: string
    offeredPlayers: unknown
    offeredBudget: number
    requestedPlayers: unknown
    requestedBudget: number
    status: string
    message: string | null
    createdAt: Date
    expiresAt: Date | null
    respondedAt: Date | null
    parentOfferId: string | null
  }): TradeOffer {
    return {
      id: prismaOffer.id,
      leagueId: '', // Not stored directly, derived from session
      senderId: prismaOffer.senderId,
      receiverId: prismaOffer.receiverId,
      senderPlayers: (prismaOffer.offeredPlayers as string[]) || [],
      receiverPlayers: (prismaOffer.requestedPlayers as string[]) || [],
      senderBudget: prismaOffer.offeredBudget,
      receiverBudget: prismaOffer.requestedBudget,
      status: prismaOffer.status as TradeStatus,
      message: prismaOffer.message || undefined,
      createdAt: prismaOffer.createdAt,
      respondedAt: prismaOffer.respondedAt,
      expiresAt: prismaOffer.expiresAt,
      counterOfferId: prismaOffer.parentOfferId,
      marketSessionId: prismaOffer.marketSessionId,
    }
  }
}
