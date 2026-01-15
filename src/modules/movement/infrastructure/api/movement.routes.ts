/**
 * Movement Module API Routes
 *
 * Provides endpoints for movement/history operations including:
 * - Getting movement history for a league
 * - Getting player's movement history
 * - Creating prophecies
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '@/api/middleware/auth'
import { asyncHandler } from '@/shared/infrastructure/http'
import type { MovementType } from '@prisma/client'

// Import existing service functions
import {
  getLeagueMovements,
  getPlayerHistory,
  addProphecy,
  getPlayerProphecies,
  canMakeProphecy,
} from '@/services/movement.service'

const router = Router()

// ==================== TYPES ====================

interface GetMovementsQuery {
  limit?: string
  offset?: string
  movementType?: MovementType
  playerId?: string
  semester?: string
}

interface CreateProphecyBody {
  movementId: string
  content: string
}

// ==================== MOVEMENT ENDPOINTS ====================

/**
 * GET /api/leagues/:leagueId/movements
 * Get movement history for a league
 *
 * Query: { limit?, offset?, movementType?, playerId?, semester? }
 * Response: { success: boolean, data?: { movements, total }, error?: string }
 */
router.get(
  '/leagues/:leagueId/movements',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId } = req.params
    const { limit, offset, movementType, playerId, semester } = req.query as GetMovementsQuery
    const userId = req.user!.userId

    const options: {
      limit?: number
      offset?: number
      movementType?: MovementType
      playerId?: string
      semester?: number
    } = {}

    if (limit) options.limit = parseInt(limit)
    if (offset) options.offset = parseInt(offset)
    if (movementType) options.movementType = movementType
    if (playerId) options.playerId = playerId
    if (semester) options.semester = parseInt(semester)

    const result = await getLeagueMovements(leagueId, userId, options)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/players/:playerId/movements
 * Get player's movement history
 *
 * Query: { leagueId }
 * Response: { success: boolean, data?: { movements, prophecies }, error?: string }
 */
router.get(
  '/players/:playerId/movements',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId } = req.params
    const leagueId = req.query.leagueId as string
    const userId = req.user!.userId

    if (!leagueId) {
      res.status(400).json({
        success: false,
        error: 'leagueId richiesto come query parameter',
      })
      return
    }

    // Get player history and prophecies in parallel
    const [historyResult, propheciesResult] = await Promise.all([
      getPlayerHistory(leagueId, playerId, userId),
      getPlayerProphecies(leagueId, playerId, userId),
    ])

    if (!historyResult.success) {
      res.status(400).json(historyResult)
      return
    }

    res.json({
      success: true,
      data: {
        movements: historyResult.data,
        prophecies: propheciesResult.success ? propheciesResult.data : [],
      },
    })
  })
)

// ==================== PROPHECY ENDPOINTS ====================

/**
 * POST /api/prophecies
 * Create a prophecy for a movement
 *
 * Body: { movementId: string, content: string }
 * Response: { success: boolean, data?: { prophecy }, error?: string }
 */
router.post(
  '/prophecies',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { movementId, content } = req.body as CreateProphecyBody
    const userId = req.user!.userId

    if (!movementId) {
      res.status(400).json({
        success: false,
        error: 'movementId richiesto',
      })
      return
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Contenuto profezia richiesto',
      })
      return
    }

    // Validate prophecy length
    if (content.length > 500) {
      res.status(400).json({
        success: false,
        error: 'Profezia troppo lunga (max 500 caratteri)',
      })
      return
    }

    const result = await addProphecy(movementId, userId, content)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  })
)

/**
 * GET /api/movements/:movementId/can-prophecy
 * Check if user can make prophecy for a movement
 *
 * Response: { success: boolean, data?: { canProphecy, reason? }, error?: string }
 */
router.get(
  '/movements/:movementId/can-prophecy',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { movementId } = req.params
    const userId = req.user!.userId

    const result = await canMakeProphecy(movementId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

/**
 * GET /api/leagues/:leagueId/players/:playerId/prophecies
 * Get prophecies for a player in a league
 *
 * Response: { success: boolean, data?: { prophecies }, error?: string }
 */
router.get(
  '/leagues/:leagueId/players/:playerId/prophecies',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { leagueId, playerId } = req.params
    const userId = req.user!.userId

    const result = await getPlayerProphecies(leagueId, playerId, userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  })
)

export default router
