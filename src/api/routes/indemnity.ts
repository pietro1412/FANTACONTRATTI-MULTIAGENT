import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getAffectedPlayersForLeague,
  getMyAffectedPlayers,
  submitPlayerDecisions,
  getAllDecisionsStatus,
} from '../../services/indemnity-phase.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== GET AFFECTED PLAYERS FOR LEAGUE ====================

// GET /api/leagues/:leagueId/indemnity/affected - Get all affected players for the league
router.get('/leagues/:leagueId/indemnity/affected', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAffectedPlayersForLeague(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get affected players error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET MY AFFECTED PLAYERS ====================

// GET /api/leagues/:leagueId/indemnity/my-affected - Get affected players for the current user
router.get('/leagues/:leagueId/indemnity/my-affected', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getMyAffectedPlayers(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(403).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get my affected players error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SUBMIT PLAYER DECISIONS ====================

// POST /api/leagues/:leagueId/indemnity/decisions - Submit decisions for affected players
router.post('/leagues/:leagueId/indemnity/decisions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { decisions } = req.body as {
      decisions: Array<{ rosterId: string; decision: 'KEEP' | 'RELEASE' }>
    }

    if (!decisions || !Array.isArray(decisions)) {
      res.status(400).json({ success: false, message: 'Decisioni mancanti o formato non valido' })
      return
    }

    // Validate each decision
    const validDecisions = ['KEEP', 'RELEASE']
    for (const d of decisions) {
      if (!d.rosterId || !d.decision) {
        res.status(400).json({ success: false, message: 'Ogni decisione deve avere rosterId e decision' })
        return
      }
      if (!validDecisions.includes(d.decision)) {
        res.status(400).json({ success: false, message: `Decisione non valida: ${d.decision}` })
        return
      }
    }

    const result = await submitPlayerDecisions(leagueId, req.user!.userId, decisions)

    if (!result.success) {
      res.status(result.message?.includes('Non sei membro') ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Submit decisions error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET ALL DECISIONS STATUS ====================

// GET /api/leagues/:leagueId/indemnity/status - Get decision status for all members (admin)
router.get('/leagues/:leagueId/indemnity/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAllDecisionsStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message?.includes('Non autorizzato') ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all decisions status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
