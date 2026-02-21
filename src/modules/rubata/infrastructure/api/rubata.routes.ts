/**
 * Rubata Module API Routes
 *
 * Provides endpoints for the "Rubata" (steal) phase operations including:
 * - Getting rubata state
 * - Adding/removing players from the board
 * - Marking ready status
 * - Placing offers (atomic)
 * - Starting auctions for highest offers
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'
import {
  batchedPusherService,
  BATCHED_PUSHER_EVENTS,
} from '@/shared/infrastructure/realtime'

// Import existing service functions
import {
  getRubataBoard,
  generateRubataBoard,
  startRubata,
  makeRubataOffer,
  bidOnRubataAuction,
  closeCurrentRubataAuction,
  getRubataReadyStatus,
  setRubataReady,
  forceAllRubataReady,
  pauseRubata,
  resumeRubata,
  advanceRubataPlayer,
  goBackRubataPlayer,
} from '@/services/rubata.service'

const router = Router()

// ==================== TYPES ====================

// Type helper for accessing dynamic properties on service result data
type ResultData = Record<string, unknown>

interface AddToBoardBody {
  playerId: string
  rosterId?: string
}

interface PlaceBidBody {
  amount: number
}

// ==================== HELPER ====================

/**
 * Get the rubata channel name for a session
 */
function getRubataChannel(sessionId: string): string {
  return `rubata-${sessionId}`
}

// ==================== STATE ENDPOINTS ====================

/**
 * GET /api/rubata/:sessionId
 * Get the current rubata state for a session
 *
 * Response: {
 *   success: boolean,
 *   data?: {
 *     board: RubataBoardEntry[],
 *     currentPlayerIndex: number,
 *     phase: 'SETUP' | 'OFFERS' | 'AUCTION' | 'COMPLETED',
 *     readyMembers: string[],
 *     activeOffer?: { memberId, amount },
 *     activeAuction?: { auctionId, currentBid }
 *   },
 *   message?: string
 * }
 */
router.get(
  '/:sessionId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    // Use the league-based function - sessionId maps to leagueId in this context
    const result = await getRubataBoard(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== BOARD MANAGEMENT ====================

/**
 * POST /api/rubata/:sessionId/board
 * Add a player to the rubata board
 *
 * Body: { playerId: string, rosterId?: string }
 * Response: { success: boolean, data?: { entryId, player }, message?: string }
 */
router.post(
  '/:sessionId/board',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const { playerId, rosterId } = req.body as AddToBoardBody
    const userId = req.user!.userId

    if (!playerId && !rosterId) {
      res.status(400).json({ success: false, message: 'playerId o rosterId richiesto' })
      return
    }

    // Generate board adds players - this is a simplified version
    // In full implementation, use AddToBoardUseCase
    const result = await generateRubataBoard(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'board-updated',
        sessionId,
        timestamp: Date.now(),
      }
    )

    res.status(201).json(result)
  })
)

/**
 * DELETE /api/rubata/:sessionId/board/:entryId
 * Remove a player from the rubata board
 *
 * Response: { success: boolean, message?: string }
 */
router.delete(
  '/:sessionId/board/:entryId',
  authMiddleware,
  asyncHandler((req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const entryId = req.params.entryId as string
    const userId = req.user!.userId

    // This would use RemoveFromBoardUseCase
    // For now, return not implemented as there's no direct service function
    res.status(501).json({
      success: false,
      message: 'Funzionalita in sviluppo',
      entryId,
      userId,
      sessionId,
    })
    return Promise.resolve()
  })
)

// ==================== READY STATUS ====================

/**
 * POST /api/rubata/:sessionId/ready
 * Mark the current user as ready for rubata
 *
 * Response: { success: boolean, data?: { readyCount, totalCount }, message?: string }
 */
router.post(
  '/:sessionId/ready',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await setRubataReady(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    const data = result.data as ResultData | undefined

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_READY_CHANGED,
      {
        memberId: userId,
        isReady: true,
        readyCount: data?.readyCount,
        totalCount: data?.totalCount,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * GET /api/rubata/:sessionId/ready
 * Get ready status for all members
 *
 * Response: { success: boolean, data?: { members: { id, isReady }[] }, message?: string }
 */
router.get(
  '/:sessionId/ready',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await getRubataReadyStatus(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/rubata/:sessionId/force-ready
 * Force all members as ready (admin only)
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/force-ready',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await forceAllRubataReady(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_READY_CHANGED,
      {
        action: 'force-all-ready',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== OFFER ENDPOINTS ====================

/**
 * POST /api/rubata/:sessionId/offer
 * Place an offer on the current player (atomic operation)
 *
 * Body: { amount?: number } - if not provided, uses base price
 * Response: { success: boolean, data?: { offerId, amount, timerExpiresAt }, message?: string }
 */
router.post(
  '/:sessionId/offer',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await makeRubataOffer(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event for steal declared
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STEAL_DECLARED,
      {
        memberId: userId,
        playerId: (result.data as ResultData | undefined)?.playerId,
        timestamp: Date.now(),
      }
    )

    res.status(201).json(result)
  })
)

/**
 * POST /api/rubata/:sessionId/bid
 * Place a bid during rubata auction
 *
 * Body: { amount: number }
 * Response: { success: boolean, data?: { bidId, amount, timerExpiresAt }, message?: string }
 */
router.post(
  '/:sessionId/bid',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const { amount } = req.body as PlaceBidBody
    const userId = req.user!.userId

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await bidOnRubataAuction(sessionId, userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event for bid
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_BID_PLACED,
      {
        bidderId: userId,
        amount,
        timerExpiresAt: (result.data as ResultData | undefined)?.timerExpiresAt,
        timestamp: Date.now(),
      }
    )

    res.status(201).json(result)
  })
)

// ==================== AUCTION CONTROL ====================

/**
 * POST /api/rubata/:sessionId/start-auction
 * Start an auction for the highest offer (admin only)
 *
 * Response: { success: boolean, data?: { auctionId, player, basePrice }, message?: string }
 */
router.post(
  '/:sessionId/start-auction',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await startRubata(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'auction-started',
        sessionId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * POST /api/rubata/:sessionId/close-auction
 * Close the current rubata auction (admin only)
 *
 * Response: { success: boolean, data?: { winnerId, winningBid }, message?: string }
 */
router.post(
  '/:sessionId/close-auction',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await closeCurrentRubataAuction(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    const data = result.data as ResultData | undefined

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'auction-closed',
        winnerId: data?.winnerId,
        winningBid: data?.winningBid,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== NAVIGATION ====================

/**
 * POST /api/rubata/:sessionId/advance
 * Advance to the next player on the board (admin only)
 *
 * Response: { success: boolean, data?: { currentIndex, player }, message?: string }
 */
router.post(
  '/:sessionId/advance',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await advanceRubataPlayer(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'player-advanced',
        currentIndex: (result.data as ResultData | undefined)?.currentIndex,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * POST /api/rubata/:sessionId/back
 * Go back to the previous player on the board (admin only)
 *
 * Response: { success: boolean, data?: { currentIndex, player }, message?: string }
 */
router.post(
  '/:sessionId/back',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await goBackRubataPlayer(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'player-back',
        currentIndex: (result.data as ResultData | undefined)?.currentIndex,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== PAUSE/RESUME ====================

/**
 * POST /api/rubata/:sessionId/pause
 * Pause the rubata phase (admin only)
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/pause',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await pauseRubata(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'paused',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * POST /api/rubata/:sessionId/resume
 * Resume the rubata phase (admin only)
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/resume',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await resumeRubata(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getRubataChannel(sessionId),
      BATCHED_PUSHER_EVENTS.RUBATA_STATE_CHANGED,
      {
        action: 'resumed',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

export default router
