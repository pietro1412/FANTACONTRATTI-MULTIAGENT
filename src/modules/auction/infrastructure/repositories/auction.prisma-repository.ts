/**
 * Auction Prisma Repository - Infrastructure Layer
 *
 * Implements IAuctionRepository using Prisma ORM for PostgreSQL.
 * CRITICAL: Contains atomic bid placement using database-level locking (SELECT FOR UPDATE).
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IAuctionRepository,
  PlaceBidData,
  PlaceBidResult,
  AuctionFilter,
} from '../../domain/repositories/auction.repository.interface'
import type {
  Auction,
  CreateAuctionData,
  AuctionStatus,
  AuctionType,
} from '../../domain/entities/auction.entity'
import type { AuctionBid, CreateBidData } from '../../domain/entities/bid.entity'
import type {
  AuctionAppeal,
  CreateAppealData,
  ResolveAppealData,
} from '../../domain/entities/appeal.entity'
import type {
  Auction as PrismaAuction,
  AuctionBid as PrismaAuctionBid,
  AuctionAppeal as PrismaAuctionAppeal,
  AuctionType as PrismaAuctionType,
  AuctionStatus as PrismaAuctionStatus,
} from '@prisma/client'

/**
 * Maps Prisma auction type to domain type
 */
function mapPrismaAuctionType(type: PrismaAuctionType): AuctionType {
  const mapping: Record<PrismaAuctionType, AuctionType> = {
    FREE_BID: 'FREE',
    RUBATA: 'RUBATA',
  }
  return mapping[type] || 'FREE'
}

/**
 * Maps domain auction type to Prisma type
 */
function mapDomainAuctionType(type: AuctionType): PrismaAuctionType {
  const mapping: Record<AuctionType, PrismaAuctionType> = {
    FREE: 'FREE_BID',
    RUBATA: 'RUBATA',
    SVINCOLATI: 'FREE_BID', // Svincolati uses FREE_BID type
  }
  return mapping[type]
}

/**
 * Maps Prisma auction status to domain status
 */
function mapPrismaAuctionStatus(status: PrismaAuctionStatus): AuctionStatus {
  const mapping: Record<PrismaAuctionStatus, AuctionStatus> = {
    PENDING: 'ACTIVE', // Map PENDING to ACTIVE for domain
    ACTIVE: 'ACTIVE',
    COMPLETED: 'CLOSED',
    CANCELLED: 'CANCELLED',
    NO_BIDS: 'CLOSED',
    APPEAL_REVIEW: 'ACTIVE',
    AWAITING_APPEAL_ACK: 'ACTIVE',
    AWAITING_RESUME: 'ACTIVE',
  }
  return mapping[status] || 'ACTIVE'
}

/**
 * Maps domain auction status to Prisma status
 */
function mapDomainAuctionStatus(status: AuctionStatus): PrismaAuctionStatus {
  const mapping: Record<AuctionStatus, PrismaAuctionStatus> = {
    ACTIVE: 'ACTIVE',
    CLOSED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  }
  return mapping[status]
}

/**
 * Result type for raw SQL query on Auction
 */
interface RawAuctionRow {
  id: string
  leagueId: string
  marketSessionId: string | null
  playerId: string
  type: PrismaAuctionType
  basePrice: number
  currentPrice: number
  winnerId: string | null
  sellerId: string | null
  nominatorId: string | null
  status: PrismaAuctionStatus
  timerExpiresAt: Date | null
  timerSeconds: number | null
  startsAt: Date | null
  endsAt: Date | null
  createdAt: Date
}

export class AuctionPrismaRepository implements IAuctionRepository {
  /**
   * Maps a Prisma auction to a domain entity
   */
  private mapToAuction(prismaAuction: PrismaAuction): Auction {
    return {
      id: prismaAuction.id,
      marketSessionId: prismaAuction.marketSessionId || '',
      playerId: prismaAuction.playerId,
      startingPrice: prismaAuction.basePrice,
      currentPrice: prismaAuction.currentPrice,
      currentWinnerId: prismaAuction.winnerId,
      status: mapPrismaAuctionStatus(prismaAuction.status),
      timerDuration: prismaAuction.timerSeconds || 30,
      timerExpiresAt: prismaAuction.timerExpiresAt,
      createdAt: prismaAuction.createdAt,
      closedAt: prismaAuction.endsAt,
      type: mapPrismaAuctionType(prismaAuction.type),
    }
  }

  /**
   * Maps a Prisma bid to a domain entity
   */
  private mapToBid(prismaBid: PrismaAuctionBid): AuctionBid {
    return {
      id: prismaBid.id,
      auctionId: prismaBid.auctionId,
      bidderId: prismaBid.bidderId,
      amount: prismaBid.amount,
      placedAt: prismaBid.placedAt,
      isWinning: prismaBid.isWinning,
    }
  }

  /**
   * Maps a Prisma appeal to a domain entity
   */
  private mapToAppeal(prismaAppeal: PrismaAuctionAppeal): AuctionAppeal {
    return {
      id: prismaAppeal.id,
      auctionId: prismaAppeal.auctionId,
      complainantId: prismaAppeal.memberId,
      reason: prismaAppeal.content,
      status: prismaAppeal.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
      resolution: prismaAppeal.resolutionNote,
      createdAt: prismaAppeal.createdAt,
      resolvedAt: prismaAppeal.resolvedAt,
    }
  }

  // ==================== AUCTION OPERATIONS ====================

  /**
   * Find an auction by ID
   */
  async findById(id: string): Promise<Auction | null> {
    const auction = await prisma.auction.findUnique({
      where: { id },
    })

    return auction ? this.mapToAuction(auction) : null
  }

  /**
   * Find the active auction in a session
   */
  async findActiveBySession(sessionId: string): Promise<Auction | null> {
    const auction = await prisma.auction.findFirst({
      where: {
        marketSessionId: sessionId,
        status: 'ACTIVE',
      },
    })

    return auction ? this.mapToAuction(auction) : null
  }

  /**
   * Find auctions matching filter criteria
   */
  async findMany(filter: AuctionFilter): Promise<Auction[]> {
    const where: Prisma.AuctionWhereInput = {}

    if (filter.sessionId) {
      where.marketSessionId = filter.sessionId
    }

    if (filter.status) {
      where.status = mapDomainAuctionStatus(filter.status)
    }

    if (filter.playerId) {
      where.playerId = filter.playerId
    }

    const auctions = await prisma.auction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return auctions.map((auction) => this.mapToAuction(auction))
  }

  /**
   * Create a new auction
   */
  async create(data: CreateAuctionData): Promise<Auction> {
    // Get the leagueId from the market session
    const session = await prisma.marketSession.findUnique({
      where: { id: data.marketSessionId },
      select: { leagueId: true },
    })

    if (!session) {
      throw new Error(`Market session not found: ${data.marketSessionId}`)
    }

    const auction = await prisma.auction.create({
      data: {
        leagueId: session.leagueId,
        marketSessionId: data.marketSessionId,
        playerId: data.playerId,
        type: mapDomainAuctionType(data.type),
        basePrice: data.startingPrice,
        currentPrice: data.startingPrice,
        timerSeconds: data.timerDuration,
        timerExpiresAt: new Date(Date.now() + data.timerDuration * 1000),
        nominatorId: data.nominatorId,
        status: 'ACTIVE',
      },
    })

    return this.mapToAuction(auction)
  }

  /**
   * CRITICAL: Place a bid atomically using SELECT FOR UPDATE
   *
   * This method uses database-level locking to prevent race conditions.
   * The implementation:
   * 1. SELECTs the auction FOR UPDATE to acquire a lock
   * 2. Validates the bid amount > currentPrice
   * 3. Updates previous winning bid to isWinning = false
   * 4. Inserts new bid with isWinning = true
   * 5. Updates auction currentPrice, currentWinnerId, and timerExpiresAt
   * 6. COMMITs the transaction
   *
   * If any step fails, the entire operation rolls back.
   */
  async placeBidAtomic(auctionId: string, bid: PlaceBidData): Promise<PlaceBidResult> {
    return prisma.$transaction(
      async (tx) => {
        // Step 1: Lock the auction row with SELECT FOR UPDATE
        const auctionRows = await tx.$queryRaw<RawAuctionRow[]>`
        SELECT * FROM "Auction" WHERE id = ${auctionId} FOR UPDATE
      `

        const auction = auctionRows[0]

        // Step 2: Validate auction exists and is active
        if (!auction) {
          return { success: false, error: 'AUCTION_NOT_FOUND' as const }
        }

        if (auction.status !== 'ACTIVE') {
          return { success: false, error: 'AUCTION_NOT_ACTIVE' as const }
        }

        // Step 3: Validate bid amount > currentPrice
        if (bid.amount <= auction.currentPrice) {
          return { success: false, error: 'BID_TOO_LOW' as const }
        }

        const previousWinnerId = auction.winnerId

        // Step 4: Update previous winning bid to isWinning = false
        await tx.auctionBid.updateMany({
          where: {
            auctionId,
            isWinning: true,
          },
          data: {
            isWinning: false,
          },
        })

        // Step 5: Get the bidder's userId for the bid record
        const bidder = await tx.leagueMember.findUnique({
          where: { id: bid.bidderId },
          select: { userId: true },
        })

        if (!bidder) {
          throw new Error(`Bidder not found: ${bid.bidderId}`)
        }

        // Step 6: Create new bid with isWinning = true
        const newBid = await tx.auctionBid.create({
          data: {
            auctionId,
            bidderId: bid.bidderId,
            userId: bidder.userId,
            amount: bid.amount,
            isWinning: true,
          },
        })

        // Step 7: Update auction with new price, winner, and timer
        await tx.auction.update({
          where: { id: auctionId },
          data: {
            currentPrice: bid.amount,
            winnerId: bid.bidderId,
            timerExpiresAt: bid.newTimerExpiresAt,
          },
        })

        // Return success with bid details
        return {
          success: true,
          bid: this.mapToBid(newBid),
          previousWinnerId,
        }
      },
      {
        // Use Serializable isolation level for maximum consistency
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        // Set timeout to prevent long-running transactions
        timeout: 10000, // 10 seconds
      }
    )
  }

  /**
   * Close an auction with the winner
   */
  async close(auctionId: string, winnerId: string | null, finalAmount: number): Promise<void> {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: winnerId ? 'COMPLETED' : 'NO_BIDS',
        winnerId,
        currentPrice: finalAmount,
        endsAt: new Date(),
      },
    })
  }

  /**
   * Cancel an auction
   */
  async cancel(auctionId: string): Promise<void> {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'CANCELLED',
        endsAt: new Date(),
      },
    })
  }

  /**
   * Reset the auction timer
   */
  async resetTimer(auctionId: string, expiresAt: Date): Promise<void> {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        timerExpiresAt: expiresAt,
      },
    })
  }

  /**
   * Update auction status
   */
  async updateStatus(auctionId: string, status: AuctionStatus): Promise<void> {
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: mapDomainAuctionStatus(status),
      },
    })
  }

  // ==================== BID OPERATIONS ====================

  /**
   * Get all bids for an auction, ordered by amount descending
   */
  async getBids(auctionId: string): Promise<AuctionBid[]> {
    const bids = await prisma.auctionBid.findMany({
      where: {
        auctionId,
        isCancelled: false,
      },
      orderBy: { amount: 'desc' },
    })

    return bids.map((bid) => this.mapToBid(bid))
  }

  /**
   * Get the winning bid for an auction
   */
  async getWinningBid(auctionId: string): Promise<AuctionBid | null> {
    const bid = await prisma.auctionBid.findFirst({
      where: {
        auctionId,
        isWinning: true,
        isCancelled: false,
      },
    })

    return bid ? this.mapToBid(bid) : null
  }

  /**
   * Create a bid (non-atomic, use placeBidAtomic for concurrent-safe bidding)
   */
  async createBid(data: CreateBidData): Promise<AuctionBid> {
    // Get the bidder's userId
    const bidder = await prisma.leagueMember.findUnique({
      where: { id: data.bidderId },
      select: { userId: true },
    })

    if (!bidder) {
      throw new Error(`Bidder not found: ${data.bidderId}`)
    }

    const bid = await prisma.auctionBid.create({
      data: {
        auctionId: data.auctionId,
        bidderId: data.bidderId,
        userId: bidder.userId,
        amount: data.amount,
        isWinning: false,
      },
    })

    return this.mapToBid(bid)
  }

  // ==================== APPEAL OPERATIONS ====================

  /**
   * Get the appeal for an auction (if any)
   */
  async getAppeal(auctionId: string): Promise<AuctionAppeal | null> {
    const appeal = await prisma.auctionAppeal.findFirst({
      where: { auctionId },
      orderBy: { createdAt: 'desc' },
    })

    return appeal ? this.mapToAppeal(appeal) : null
  }

  /**
   * Create an appeal for an auction
   */
  async createAppeal(data: CreateAppealData): Promise<AuctionAppeal> {
    const appeal = await prisma.auctionAppeal.create({
      data: {
        auctionId: data.auctionId,
        memberId: data.complainantId,
        content: data.reason,
        status: 'PENDING',
      },
    })

    return this.mapToAppeal(appeal)
  }

  /**
   * Resolve an appeal
   */
  async resolveAppeal(appealId: string, data: ResolveAppealData): Promise<AuctionAppeal> {
    const appeal = await prisma.auctionAppeal.update({
      where: { id: appealId },
      data: {
        status: data.resolution,
        resolutionNote: data.notes,
        resolvedAt: new Date(),
      },
    })

    return this.mapToAppeal(appeal)
  }

  /**
   * Get pending appeals for a league
   */
  async getPendingAppeals(leagueId: string): Promise<AuctionAppeal[]> {
    const appeals = await prisma.auctionAppeal.findMany({
      where: {
        auction: {
          leagueId,
        },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    })

    return appeals.map((appeal) => this.mapToAppeal(appeal))
  }
}
