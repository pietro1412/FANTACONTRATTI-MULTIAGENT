import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  initializePrizePhase,
  getPrizePhaseData,
  updateBaseReincrement,
  createPrizeCategory,
  deletePrizeCategory,
  setMemberPrize,
  finalizePrizePhase,
} from '../../services/prize-phase.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== INITIALIZE PRIZE PHASE ====================

// POST /api/sessions/:sessionId/prizes/init - Initialize prize phase for session (Admin)
router.post('/sessions/:sessionId/prizes/init', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await initializePrizePhase(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Initialize prize phase error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== GET PRIZE PHASE DATA ====================

// GET /api/sessions/:sessionId/prizes - Get prize phase data
router.get('/sessions/:sessionId/prizes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getPrizePhaseData(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get prize phase data error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== UPDATE BASE REINCREMENT ====================

// PATCH /api/sessions/:sessionId/prizes/base-reincrement - Update base reincrement (Admin)
router.patch('/sessions/:sessionId/prizes/base-reincrement', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { amount } = req.body as { amount: number }

    if (amount === undefined) {
      res.status(400).json({ success: false, message: 'amount è obbligatorio' })
      return
    }

    const result = await updateBaseReincrement(sessionId, req.user!.userId, amount)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update base reincrement error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== PRIZE CATEGORIES ====================

// POST /api/sessions/:sessionId/prizes/categories - Create prize category (Admin)
router.post('/sessions/:sessionId/prizes/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { name } = req.body as { name: string }

    if (!name) {
      res.status(400).json({ success: false, message: 'name è obbligatorio' })
      return
    }

    const result = await createPrizeCategory(sessionId, req.user!.userId, name)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Create prize category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/prizes/categories/:categoryId - Delete prize category (Admin)
router.delete('/prizes/categories/:categoryId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.categoryId as string
    const result = await deletePrizeCategory(categoryId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Delete prize category error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SET MEMBER PRIZE ====================

// PUT /api/prizes/categories/:categoryId/members/:memberId - Set prize for member (Admin)
router.put('/prizes/categories/:categoryId/members/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { categoryId, memberId } = req.params as { categoryId: string; memberId: string }
    const { amount } = req.body as { amount: number }

    if (amount === undefined) {
      res.status(400).json({ success: false, message: 'amount è obbligatorio' })
      return
    }

    const result = await setMemberPrize(categoryId, memberId, req.user!.userId, amount)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set member prize error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== FINALIZE PRIZE PHASE ====================

// POST /api/sessions/:sessionId/prizes/finalize - Finalize prize phase (Admin)
router.post('/sessions/:sessionId/prizes/finalize', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await finalizePrizePhase(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Finalize prize phase error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
