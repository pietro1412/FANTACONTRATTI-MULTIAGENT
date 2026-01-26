/**
 * objectives.ts - Auction Objectives API Routes
 *
 * Endpoint per la gestione degli obiettivi pre-asta dei manager.
 *
 * Creato il: 25/01/2026
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getObjectives,
  createObjective,
  updateObjective,
  deleteObjective,
  getObjectivesSummary
} from '../../services/objectives.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== OBJECTIVES ====================

// GET /api/auctions/sessions/:sessionId/objectives - Get my objectives for a session
router.get('/auctions/sessions/:sessionId/objectives', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getObjectives(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get objectives error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/sessions/:sessionId/objectives/summary - Get objectives summary
router.get('/auctions/sessions/:sessionId/objectives/summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getObjectivesSummary(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get objectives summary error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/objectives - Create new objective
router.post('/objectives', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId, playerId, priority, notes, maxPrice } = req.body as {
      sessionId?: string
      playerId?: string
      priority?: number
      notes?: string
      maxPrice?: number
    }

    if (!sessionId || !playerId) {
      res.status(400).json({ success: false, message: 'sessionId e playerId richiesti' })
      return
    }

    const result = await createObjective(req.user!.userId, {
      sessionId,
      playerId,
      priority,
      notes,
      maxPrice
    })

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Create objective error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/objectives/:objectiveId - Update objective
router.put('/objectives/:objectiveId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.objectiveId as string
    const { priority, notes, maxPrice, status } = req.body as {
      priority?: number
      notes?: string
      maxPrice?: number
      status?: 'ACTIVE' | 'ACQUIRED' | 'MISSED' | 'REMOVED'
    }

    const result = await updateObjective(objectiveId, req.user!.userId, {
      priority,
      notes,
      maxPrice,
      status: status as any
    })

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update objective error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/objectives/:objectiveId - Delete objective
router.delete('/objectives/:objectiveId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.objectiveId as string
    const result = await deleteObjective(objectiveId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Delete objective error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
