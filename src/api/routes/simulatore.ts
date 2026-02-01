import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getCessioneAnalysis,
  getBudgetAnalysis,
  getSostituti,
} from '../../services/simulatore.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/leagues/:leagueId/simulatore/cessioni - Get cessioni analysis for current user
router.get('/leagues/:leagueId/simulatore/cessioni', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getCessioneAnalysis(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get cessioni analysis error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/simulatore/budget - Get budget analysis for current user
router.get('/leagues/:leagueId/simulatore/budget', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getBudgetAnalysis(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get budget analysis error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/simulatore/sostituti/:playerId - Get replacement suggestions for a player
router.get('/leagues/:leagueId/simulatore/sostituti/:playerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const playerId = req.params.playerId as string
    const limitParam = req.query.limit as string | undefined
    const limit = limitParam ? parseInt(limitParam, 10) : 10

    const result = await getSostituti(leagueId, playerId, req.user!.userId, limit)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get sostituti error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
