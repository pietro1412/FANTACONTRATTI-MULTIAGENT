/**
 * Trade Module API Routes
 *
 * Provides endpoints for trade operations including:
 * - Listing trades
 * - Creating trade offers
 * - Accepting/rejecting trades
 * - Counter offers
 * - Cancelling trades
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'

// Import existing service functions
import {
  createTradeOffer,
  getReceivedOffers,
  getSentOffers,
  getTradeHistory,
  acceptTrade,
  rejectTrade,
  counterOffer,
  cancelTradeOffer,
} from '@/services/trade.service'

const router = Router()

// ==================== TYPES ====================

interface CreateTradeBody {
  toMemberId: string
  offeredPlayerIds?: string[]
  requestedPlayerIds?: string[]
  offeredBudget?: number
  requestedBudget?: number
  message?: string
  durationHours?: number
}

interface CounterOfferBody {
  offeredPlayerIds?: string[]
  requestedPlayerIds?: string[]
  offeredBudget?: number
  requestedBudget?: number
  message?: string
}

// ==================== TRADE LIST ENDPOINTS ====================

/**
 * GET /api/leagues/:leagueId/trades
 * List all trades for a league (received, sent, and history)
 *
 * Response: { success: boolean, data?: { received, sent, history }, error?: string }
 */
router.get(
  '/leagues/:leagueId/trades',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const userId = req.user!.userId

    // Get all trade data in parallel
    const [receivedResult, sentResult, historyResult] = await Promise.all([
      getReceivedOffers(leagueId, userId),
      getSentOffers(leagueId, userId),
      getTradeHistory(leagueId, userId),
    ])

    if (!receivedResult.success) {
      res.status(400).json(receivedResult)
      return
    }

    res.json({
      success: true,
      data: {
        received: receivedResult.data,
        sent: sentResult.success ? sentResult.data : [],
        history: historyResult.success ? historyResult.data : [],
      },
    })
  })
)

// ==================== TRADE ACTION ENDPOINTS ====================

/**
 * POST /api/trades
 * Create a new trade offer
 *
 * Body: { toMemberId, offeredPlayerIds?, requestedPlayerIds?, offeredBudget?, requestedBudget?, message?, durationHours? }
 * Query: { leagueId }
 * Response: { success: boolean, data?: { trade }, error?: string }
 */
router.post(
  '/trades',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      toMemberId,
      offeredPlayerIds,
      requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      message,
      durationHours,
    } = req.body as CreateTradeBody
    const userId = req.user!.userId
    const leagueId = req.query.leagueId as string

    if (!leagueId) {
      res.status(400).json({
        success: false,
        error: 'leagueId richiesto come query parameter',
      })
      return
    }

    if (!toMemberId) {
      res.status(400).json({
        success: false,
        error: 'toMemberId richiesto',
      })
      return
    }

    // Validate that at least something is being offered or requested
    const hasPlayers = (offeredPlayerIds && offeredPlayerIds.length > 0) ||
                       (requestedPlayerIds && requestedPlayerIds.length > 0)
    const hasBudget = (offeredBudget && offeredBudget > 0) ||
                      (requestedBudget && requestedBudget > 0)

    if (!hasPlayers && !hasBudget) {
      res.status(400).json({
        success: false,
        error: 'Devi offrire o richiedere almeno qualcosa',
      })
      return
    }

    const result = await createTradeOffer(
      leagueId,
      userId,
      toMemberId,
      offeredPlayerIds || [],
      requestedPlayerIds || [],
      offeredBudget || 0,
      requestedBudget || 0,
      message,
      durationHours || 24
    )

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  })
)

/**
 * POST /api/trades/:tradeId/accept
 * Accept a trade offer
 *
 * Response: { success: boolean, data?: { message }, error?: string }
 */
router.post(
  '/trades/:tradeId/accept',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { tradeId } = req.params
    const userId = req.user!.userId

    const result = await acceptTrade(tradeId, userId)

    if (!result.success) {
      const status = result.message === 'Non sei autorizzato ad accettare questa offerta' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/trades/:tradeId/reject
 * Reject a trade offer
 *
 * Response: { success: boolean, data?: { message }, error?: string }
 */
router.post(
  '/trades/:tradeId/reject',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { tradeId } = req.params
    const userId = req.user!.userId

    const result = await rejectTrade(tradeId, userId)

    if (!result.success) {
      const status = result.message === 'Non sei autorizzato a rifiutare questa offerta' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * POST /api/trades/:tradeId/counter
 * Create a counter offer
 *
 * Body: { offeredPlayerIds?, requestedPlayerIds?, offeredBudget?, requestedBudget?, message? }
 * Response: { success: boolean, data?: { trade }, error?: string }
 */
router.post(
  '/trades/:tradeId/counter',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { tradeId } = req.params
    const {
      offeredPlayerIds,
      requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      message,
    } = req.body as CounterOfferBody
    const userId = req.user!.userId

    const result = await counterOffer(
      tradeId,
      userId,
      offeredPlayerIds || [],
      requestedPlayerIds || [],
      offeredBudget || 0,
      requestedBudget || 0,
      message
    )

    if (!result.success) {
      const status = result.message === 'Non sei autorizzato a controffertare' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.status(201).json(result)
  })
)

/**
 * DELETE /api/trades/:tradeId
 * Cancel a trade offer
 *
 * Response: { success: boolean, data?: { message }, error?: string }
 */
router.delete(
  '/trades/:tradeId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { tradeId } = req.params
    const userId = req.user!.userId

    const result = await cancelTradeOffer(tradeId, userId)

    if (!result.success) {
      const status = result.message === 'Non sei autorizzato a cancellare questa offerta' ? 403 : 400
      res.status(status).json(result)
      return
    }

    res.json(result)
  })
)

export default router
