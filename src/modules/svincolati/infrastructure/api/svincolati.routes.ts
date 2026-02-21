/**
 * Svincolati Module API Routes
 *
 * Provides endpoints for the "Svincolati" (free agents) phase operations including:
 * - Getting svincolati state
 * - Nominating free agent players (atomic)
 * - Passing turns
 * - Getting available players
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
  getSvincolatiBoard,
  getFreeAgents,
  nominateFreeAgent,
  confirmSvincolatiNomination,
  cancelSvincolatiNomination,
  passSvincolatiTurn,
  markReadyForSvincolati,
  forceAllReadyForSvincolati,
  acknowledgeSvincolatiAuction,
  forceAllSvincolatiAck,
  bidOnFreeAgent,
  closeSvincolatiAuction,
  setSvincolatiTimer,
  declareSvincolatiFinished,
  undoSvincolatiFinished,
  forceAllSvincolatiFinished,
} from '@/services/svincolati.service'

const router = Router()

// ==================== TYPES ====================

// Type helper for accessing dynamic properties on service result data
type ResultData = Record<string, unknown>

interface NominateBody {
  playerId: string
}

interface PlaceBidBody {
  amount: number
}

interface SetTimerBody {
  timerSeconds: number
}

interface FiltersQuery {
  position?: 'P' | 'D' | 'C' | 'A'
  team?: string
  search?: string
  minQuotation?: string
  maxQuotation?: string
}

// ==================== HELPER ====================

/**
 * Get the svincolati channel name for a session
 */
function getSvincolatiChannel(sessionId: string): string {
  return `svincolati-${sessionId}`
}

// ==================== STATE ENDPOINTS ====================

/**
 * GET /api/svincolati/:sessionId
 * Get the current svincolati state for a session
 *
 * Response: {
 *   success: boolean,
 *   data?: {
 *     turnOrder: { memberId, order, hasFinished }[],
 *     currentTurnMemberId: string,
 *     currentTurnIndex: number,
 *     phase: 'WAITING' | 'NOMINATING' | 'BIDDING' | 'ACKNOWLEDGING' | 'COMPLETED',
 *     pendingNomination?: { playerId, nominatorId },
 *     activeAuction?: { auctionId, playerId, currentBid },
 *     timerSeconds: number
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

    const result = await getSvincolatiBoard(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/svincolati/:sessionId/available
 * Get available free agent players
 *
 * Query: { position?, team?, search?, minQuotation?, maxQuotation? }
 * Response: { success: boolean, data?: { players: Player[] }, message?: string }
 */
router.get(
  '/:sessionId/available',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId
    const {
      position,
      team,
      search,
      minQuotation,
      maxQuotation,
    } = req.query as FiltersQuery

    const filters = {
      position,
      team,
      search,
      minQuotation: minQuotation ? parseInt(minQuotation) : undefined,
      maxQuotation: maxQuotation ? parseInt(maxQuotation) : undefined,
    }

    const result = await getFreeAgents(sessionId, userId, filters)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== NOMINATION ENDPOINTS ====================

/**
 * POST /api/svincolati/:sessionId/nominate
 * Nominate a free agent player (atomic operation)
 *
 * Body: { playerId: string }
 * Response: {
 *   success: boolean,
 *   data?: { nominationId, player, nominatorId },
 *   message?: string
 * }
 */
router.post(
  '/:sessionId/nominate',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const { playerId } = req.body as NominateBody
    const userId = req.user!.userId

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await nominateFreeAgent(sessionId, userId, playerId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_NOMINATION,
      {
        action: 'pending',
        playerId,
        nominatorId: userId,
        timestamp: Date.now(),
      }
    )

    res.status(201).json(result)
  })
)

/**
 * PUT /api/svincolati/:sessionId/confirm
 * Confirm a pending nomination
 *
 * Response: { success: boolean, data?: { auctionId, player }, message?: string }
 */
router.put(
  '/:sessionId/confirm',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await confirmSvincolatiNomination(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_NOMINATION,
      {
        action: 'confirmed',
        auctionId: (result.data as ResultData | undefined)?.auctionId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * DELETE /api/svincolati/:sessionId/nomination
 * Cancel a pending nomination
 *
 * Response: { success: boolean, message?: string }
 */
router.delete(
  '/:sessionId/nomination',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await cancelSvincolatiNomination(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_NOMINATION,
      {
        action: 'cancelled',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== TURN MANAGEMENT ====================

/**
 * POST /api/svincolati/:sessionId/pass
 * Pass the current turn
 *
 * Response: { success: boolean, data?: { nextMemberId }, message?: string }
 */
router.post(
  '/:sessionId/pass',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await passSvincolatiTurn(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'turn-passed',
        memberId: userId,
        nextMemberId: (result.data as ResultData | undefined)?.nextMemberId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== READY STATUS ====================

/**
 * POST /api/svincolati/:sessionId/ready
 * Mark the current user as ready
 *
 * Response: { success: boolean, data?: { readyCount, totalCount }, message?: string }
 */
router.post(
  '/:sessionId/ready',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await markReadyForSvincolati(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    const data = result.data as ResultData | undefined

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_READY_CHANGED,
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
 * POST /api/svincolati/:sessionId/force-ready
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

    const result = await forceAllReadyForSvincolati(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_READY_CHANGED,
      {
        action: 'force-all-ready',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== BIDDING ====================

/**
 * POST /api/svincolati/:sessionId/bid
 * Place a bid on the active svincolati auction
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

    // Get the active auction ID from the board state
    const boardResult = await getSvincolatiBoard(sessionId, userId)
    const boardData = boardResult.data as ResultData | undefined
    const auctionId = boardData?.activeAuctionId as string | undefined

    if (!auctionId) {
      res.status(400).json({ success: false, message: 'Nessuna asta attiva' })
      return
    }

    const result = await bidOnFreeAgent(auctionId, userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_BID_PLACED,
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

// ==================== ACKNOWLEDGMENT ====================

/**
 * POST /api/svincolati/:sessionId/acknowledge
 * Acknowledge an auction result
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/acknowledge',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await acknowledgeSvincolatiAuction(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'acknowledged',
        memberId: userId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * POST /api/svincolati/:sessionId/force-ack
 * Force all acknowledgments (admin only)
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/force-ack',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await forceAllSvincolatiAck(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'force-all-ack',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

// ==================== AUCTION CONTROL ====================

/**
 * POST /api/svincolati/:sessionId/close-auction
 * Close the current svincolati auction (admin only)
 *
 * Response: { success: boolean, data?: { winnerId, winningBid }, message?: string }
 */
router.post(
  '/:sessionId/close-auction',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    // Get the active auction ID from the board state
    const boardResult = await getSvincolatiBoard(sessionId, userId)
    const boardData = boardResult.data as ResultData | undefined
    const auctionId = boardData?.activeAuctionId as string | undefined

    if (!auctionId) {
      res.status(400).json({ success: false, message: 'Nessuna asta attiva' })
      return
    }

    const result = await closeSvincolatiAuction(auctionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    const data = result.data as ResultData | undefined

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
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

// ==================== TIMER CONFIGURATION ====================

/**
 * PUT /api/svincolati/:sessionId/timer
 * Set the timer seconds for svincolati auctions (admin only)
 *
 * Body: { timerSeconds: number }
 * Response: { success: boolean, message?: string }
 */
router.put(
  '/:sessionId/timer',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const { timerSeconds } = req.body as SetTimerBody
    const userId = req.user!.userId

    if (!timerSeconds || typeof timerSeconds !== 'number') {
      res.status(400).json({ success: false, message: 'timerSeconds richiesto' })
      return
    }

    const result = await setSvincolatiTimer(sessionId, userId, timerSeconds)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

// ==================== FINISHED STATUS ====================

/**
 * POST /api/svincolati/:sessionId/finished
 * Declare that the user has finished with svincolati phase
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/finished',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await declareSvincolatiFinished(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'member-finished',
        memberId: userId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * DELETE /api/svincolati/:sessionId/finished
 * Undo the finished declaration
 *
 * Response: { success: boolean, message?: string }
 */
router.delete(
  '/:sessionId/finished',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await undoSvincolatiFinished(sessionId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'member-unfinished',
        memberId: userId,
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

/**
 * POST /api/svincolati/:sessionId/force-all-finished
 * Force all members as finished (admin only)
 *
 * Response: { success: boolean, message?: string }
 */
router.post(
  '/:sessionId/force-all-finished',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string
    const userId = req.user!.userId

    const result = await forceAllSvincolatiFinished(sessionId, userId)

    if (!result.success) {
      const status = result.message === 'Non autorizzato' ? 403 : 400
      res.status(status).json(result)
      return
    }

    // Queue real-time event
    batchedPusherService.queueEvent(
      getSvincolatiChannel(sessionId),
      BATCHED_PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
      {
        action: 'force-all-finished',
        timestamp: Date.now(),
      }
    )

    res.json(result)
  })
)

export default router
