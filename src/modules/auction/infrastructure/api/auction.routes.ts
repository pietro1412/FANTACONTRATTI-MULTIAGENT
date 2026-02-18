/**
 * Auction Module API Routes
 *
 * Provides endpoints for auction operations including:
 * - Creating auctions (nominating players)
 * - Placing bids with atomic operations
 * - Getting active auction state
 * - Closing auctions (admin)
 * - Creating and handling appeals
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'
import {
  batchedPusherService,
  getAuctionChannel,
  BATCHED_PUSHER_EVENTS,
} from '@/shared/infrastructure/realtime'

// Use case imports - these would be implemented in the application layer
// For now, we'll use placeholder types and import the existing service functions
import {
  nominatePlayer,
  getCurrentAuction,
  placeBid,
  closeAuction,
  submitAppeal,
  resolveAppeal,
  getAppealStatus,
} from '@/services/auction.service'

const router = Router()

// ==================== TYPES ====================

// Type helper for accessing dynamic properties on service result data
type ResultData = Record<string, unknown>

interface CreateAuctionBody {
  playerId: string
  basePrice?: number
}

interface PlaceBidBody {
  amount: number
}

interface CreateAppealBody {
  content: string
}

interface ResolveAppealBody {
  decision: 'ACCEPTED' | 'REJECTED'
  resolutionNote?: string
}

// ==================== AUCTION ENDPOINTS ====================

/**
 * POST /api/auctions
 * Create a new auction (nominate a player)
 *
 * Body: { playerId: string, basePrice?: number }
 * Response: { success: boolean, data?: { auctionId, player, basePrice }, message?: string }
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId, basePrice } = req.body as CreateAuctionBody
    const userId = req.user!.userId

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    // Get sessionId from query or derive from context
    const sessionId = req.query.sessionId as string
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'sessionId richiesto' })
      return
    }

    const result = await nominatePlayer(sessionId, playerId, userId, basePrice)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event for auction creation
    batchedPusherService.queueEvent(
      getAuctionChannel(sessionId),
      BATCHED_PUSHER_EVENTS.AUCTION_STARTED,
      {
        auctionId: (result.data as ResultData | undefined)?.auctionId,
        playerId,
        basePrice,
        nominatedBy: userId,
        timestamp: Date.now(),
      }
    )

    res.status(201).json(result)
  })
)

/**
 * POST /api/auctions/:auctionId/bid
 * Place a bid on an auction (atomic operation)
 *
 * Body: { amount: number }
 * Response: { success: boolean, data?: { bidId, amount, timerExpiresAt }, message?: string }
 */
router.post(
  '/:auctionId/bid',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = req.params.auctionId as string
    const { amount } = req.body as PlaceBidBody
    const userId = req.user!.userId

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await placeBid(auctionId, userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event for bid placed
    // Extract sessionId from auction context if available
    const data = result.data as ResultData | undefined
    const sessionId = data?.sessionId as string | undefined
    if (sessionId) {
      batchedPusherService.queueEvent(
        getAuctionChannel(sessionId),
        BATCHED_PUSHER_EVENTS.BID_PLACED,
        {
          auctionId,
          amount,
          bidderId: userId,
          timerExpiresAt: data?.timerExpiresAt,
          timestamp: Date.now(),
        }
      )

      // Send immediate timer reset for time-sensitive update
      if (data?.timerExpiresAt) {
        const remainingSeconds = (data.remainingSeconds as number) || 30
        const totalSeconds = (data.totalSeconds as number) || 30
        await batchedPusherService.sendTimerReset(getAuctionChannel(sessionId), {
          auctionId,
          remainingSeconds,
          totalSeconds,
          resetReason: 'bid',
          triggeredBy: userId,
          timestamp: Date.now(),
        })
      }
    }

    res.status(201).json(result)
  })
)

/**
 * GET /api/auctions/:sessionId/active
 * Get the currently active auction for a session
 *
 * Response: { success: boolean, data?: { auction, currentBid, bidHistory }, message?: string }
 */
router.get(
  '/:sessionId/active',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await getCurrentAuction(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/auctions/:auctionId/close
 * Close an auction (admin only)
 *
 * Response: { success: boolean, data?: { winnerId, winningBid, player }, message?: string }
 */
router.post(
  '/:auctionId/close',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = req.params.auctionId as string
    const userId = req.user!.userId

    const result = await closeAuction(auctionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event for auction closed
    const data = result.data as ResultData | undefined
    const sessionId = data?.sessionId as string | undefined
    if (sessionId) {
      batchedPusherService.queueEvent(
        getAuctionChannel(sessionId),
        BATCHED_PUSHER_EVENTS.AUCTION_CLOSED,
        {
          auctionId,
          winnerId: data?.winnerId,
          winningBid: data?.winningBid,
          playerId: data?.playerId,
          timestamp: Date.now(),
        }
      )
    }

    res.json(result)
  })
)

// ==================== APPEAL ENDPOINTS ====================

/**
 * POST /api/auctions/:auctionId/appeal
 * Create an appeal for an auction
 *
 * Body: { content: string }
 * Response: { success: boolean, data?: { appealId }, message?: string }
 */
router.post(
  '/:auctionId/appeal',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = req.params.auctionId as string
    const { content } = req.body as CreateAppealBody
    const userId = req.user!.userId

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Contenuto del ricorso richiesto' })
      return
    }

    const result = await submitAppeal(auctionId, userId, content)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  })
)

/**
 * GET /api/auctions/:auctionId/appeal
 * Get appeal status for an auction
 *
 * Response: { success: boolean, data?: { appeal, status }, message?: string }
 */
router.get(
  '/:auctionId/appeal',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = req.params.auctionId as string
    const userId = req.user!.userId

    const result = await getAppealStatus(auctionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * PUT /api/auctions/:auctionId/appeal/resolve
 * Resolve an appeal (admin only)
 *
 * Body: { decision: 'ACCEPTED' | 'REJECTED', resolutionNote?: string }
 * Response: { success: boolean, message?: string }
 */
router.put(
  '/:auctionId/appeal/resolve',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const auctionId = req.params.auctionId as string
    const { decision, resolutionNote } = req.body as ResolveAppealBody
    const userId = req.user!.userId

    if (!decision || !['ACCEPTED', 'REJECTED'].includes(decision)) {
      res.status(400).json({
        success: false,
        message: 'Decisione richiesta (ACCEPTED o REJECTED)',
      })
      return
    }

    // Note: resolveAppeal expects appealId, we need to get it from the auction
    // This is a simplification - in production, you'd want a proper appeal lookup
    const result = await resolveAppeal(auctionId, userId, decision, resolutionNote)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

export default router
