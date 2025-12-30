import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  exportAllRosters,
  getAuditLog,
  getLeagueStatistics,
  migrateProphecies,
  resetFirstMarket,
  assignPrize,
  getMembersForPrizes,
  getPrizeHistory,
} from '../../services/admin.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== EXPORT ====================

// GET /api/leagues/:leagueId/admin/export/rosters - Export all rosters (Admin)
router.get('/leagues/:leagueId/admin/export/rosters', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await exportAllRosters(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Export rosters error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== AUDIT LOG ====================

// GET /api/leagues/:leagueId/admin/audit - Get audit log (Admin)
router.get('/leagues/:leagueId/admin/audit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { limit, offset, action } = req.query as {
      limit?: string
      offset?: string
      action?: string
    }

    const result = await getAuditLog(leagueId, req.user!.userId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      action,
    })

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get audit log error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== STATISTICS ====================

// GET /api/leagues/:leagueId/admin/stats - Get league statistics
router.get('/leagues/:leagueId/admin/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getLeagueStatistics(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get statistics error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RESET FIRST MARKET ====================

// POST /api/leagues/:leagueId/admin/reset-first-market - Reset the first market to initial state
router.post('/leagues/:leagueId/admin/reset-first-market', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await resetFirstMarket(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Reset first market error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== MIGRATE PROPHECIES ====================

// POST /api/leagues/:leagueId/admin/migrate-prophecies - Migrate prophecies from AuctionAcknowledgment to Prophecy model
router.post('/leagues/:leagueId/admin/migrate-prophecies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await migrateProphecies(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Migrate prophecies error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== PRIZES ====================

// GET /api/leagues/:leagueId/admin/prizes - Get prize history
router.get('/leagues/:leagueId/admin/prizes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getPrizeHistory(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get prize history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/admin/prizes/members - Get all members for prize assignment
router.get('/leagues/:leagueId/admin/prizes/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getMembersForPrizes(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get members for prizes error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/admin/prizes - Assign a prize to a member
router.post('/leagues/:leagueId/admin/prizes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { memberId, amount, reason } = req.body as {
      memberId: string
      amount: number
      reason?: string
    }

    if (!memberId || !amount) {
      res.status(400).json({ success: false, message: 'memberId e amount sono obbligatori' })
      return
    }

    const result = await assignPrize(leagueId, req.user!.userId, memberId, amount, reason)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Assign prize error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
