import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getSessionContractHistory,
  getFullSessionContractHistory,
  getManagerSessionSummary,
  getContractPhaseProspetto,
  getHistoricalSessionSummaries,
} from '../../services/contract-history.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/leagues/:leagueId/sessions/:sessionId/contract-history
// Get contract history for the authenticated user's session
router.get(
  '/leagues/:leagueId/sessions/:sessionId/contract-history',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string
      const { memberId } = req.query

      // If memberId is provided, validate admin access
      // Otherwise use the authenticated user's member
      const targetMemberId = memberId as string | undefined

      if (!targetMemberId) {
        res.status(400).json({ success: false, message: 'memberId richiesto' })
        return
      }

      const result = await getSessionContractHistory(
        sessionId,
        targetMemberId,
        req.user!.userId
      )

      if (!result.success) {
        res.status(400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Get contract history error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

// GET /api/leagues/:leagueId/sessions/:sessionId/contract-history/full
// Get full contract history for a session (admin only)
router.get(
  '/leagues/:leagueId/sessions/:sessionId/contract-history/full',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string
      const sessionId = req.params.sessionId as string

      const result = await getFullSessionContractHistory(
        sessionId,
        req.user!.userId,
        leagueId
      )

      if (!result.success) {
        res.status(result.message?.includes('admin') ? 403 : 400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Get full contract history error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

// GET /api/leagues/:leagueId/sessions/:sessionId/manager-snapshot
// Get manager session summary
router.get(
  '/leagues/:leagueId/sessions/:sessionId/manager-snapshot',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string
      const { memberId } = req.query

      if (!memberId) {
        res.status(400).json({ success: false, message: 'memberId richiesto' })
        return
      }

      const result = await getManagerSessionSummary(
        sessionId,
        memberId as string,
        req.user!.userId
      )

      if (!result.success) {
        res.status(400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Get manager snapshot error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

// GET /api/leagues/:leagueId/contract-prospetto
// Get contract phase prospetto (real-time summary during CONTRATTI)
router.get(
  '/leagues/:leagueId/contract-prospetto',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string

      const result = await getContractPhaseProspetto(leagueId, req.user!.userId)

      if (!result.success) {
        res.status(400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Get contract prospetto error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

// GET /api/leagues/:leagueId/contract-history/historical
// Get historical session summaries
router.get(
  '/leagues/:leagueId/contract-history/historical',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const leagueId = req.params.leagueId as string

      const result = await getHistoricalSessionSummaries(leagueId, req.user!.userId)

      if (!result.success) {
        res.status(400).json(result)
        return
      }

      res.json(result)
    } catch (error) {
      console.error('Get historical summaries error:', error)
      res.status(500).json({ success: false, message: 'Errore interno del server' })
    }
  }
)

export default router
