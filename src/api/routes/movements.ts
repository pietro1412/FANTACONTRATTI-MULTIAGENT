import { Router } from 'express'
import type { Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  getLeagueMovements,
  getPlayerHistory,
  addProphecy,
  getPlayerProphecies,
  canMakeProphecy,
} from '../../services/movement.service'
import type { MovementType } from '@prisma/client'

const router = Router()

// GET /api/leagues/:leagueId/movements - Get league movement history
router.get('/leagues/:leagueId/movements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { limit, offset, movementType, playerId } = req.query

    const options: {
      limit?: number
      offset?: number
      movementType?: MovementType
      playerId?: string
    } = {}

    if (limit) options.limit = parseInt(limit as string)
    if (offset) options.offset = parseInt(offset as string)
    if (movementType) options.movementType = movementType as MovementType
    if (playerId) options.playerId = playerId as string

    const result = await getLeagueMovements(leagueId, req.user!.userId, options)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get league movements error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/players/:playerId/history - Get player history in league
router.get('/leagues/:leagueId/players/:playerId/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const playerId = req.params.playerId as string
    const result = await getPlayerHistory(leagueId, playerId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get player history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/players/:playerId/prophecies - Get player prophecies
router.get('/leagues/:leagueId/players/:playerId/prophecies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const playerId = req.params.playerId as string
    const result = await getPlayerProphecies(leagueId, playerId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get player prophecies error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/movements/:movementId/can-prophecy - Check if user can make prophecy
router.get('/movements/:movementId/can-prophecy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const movementId = req.params.movementId as string
    const result = await canMakeProphecy(movementId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Check prophecy eligibility error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/movements/:movementId/prophecy - Add prophecy to movement
router.post('/movements/:movementId/prophecy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const movementId = req.params.movementId as string
    const { content } = req.body as { content?: string }

    if (!content) {
      res.status(400).json({ success: false, message: 'Contenuto profezia richiesto' })
      return
    }

    const result = await addProphecy(movementId, req.user!.userId, content)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Add prophecy error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
