import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  setRubataOrder,
  getRubataOrder,
  getCurrentRubataTurn,
  getRubablePlayers,
  putPlayerOnPlate,
  bidOnRubata,
  closeRubataAuction,
  skipRubataTurn,
  getRubataStatus,
} from '../../services/rubata.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== RUBATA ORDER ====================

// PUT /api/leagues/:leagueId/rubata/order - Set rubata order (Admin)
router.put('/leagues/:leagueId/rubata/order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { memberOrder } = req.body as { memberOrder?: string[] }

    if (!memberOrder || !Array.isArray(memberOrder)) {
      res.status(400).json({ success: false, message: 'memberOrder richiesto (array di ID)' })
      return
    }

    const result = await setRubataOrder(leagueId, req.user!.userId, memberOrder)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set rubata order error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/rubata/order - Get rubata order
router.get('/leagues/:leagueId/rubata/order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataOrder(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata order error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RUBATA STATUS & TURN ====================

// GET /api/leagues/:leagueId/rubata/status - Get full rubata status
router.get('/leagues/:leagueId/rubata/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/rubata/turn - Get current turn
router.get('/leagues/:leagueId/rubata/turn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getCurrentRubataTurn(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata turn error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/rubata/skip - Skip current turn (Admin)
router.put('/leagues/:leagueId/rubata/skip', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await skipRubataTurn(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Skip rubata turn error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RUBABLE PLAYERS ====================

// GET /api/leagues/:leagueId/rubata/players/:memberId - Get rubable players for a member
router.get('/leagues/:leagueId/rubata/players/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const memberId = req.params.memberId as string
    const result = await getRubablePlayers(leagueId, memberId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubable players error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RUBATA AUCTION ====================

// POST /api/leagues/:leagueId/rubata/plate - Put player on plate (start auction)
router.post('/leagues/:leagueId/rubata/plate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { rosterId } = req.body as { rosterId?: string }

    if (!rosterId) {
      res.status(400).json({ success: false, message: 'rosterId richiesto' })
      return
    }

    const result = await putPlayerOnPlate(leagueId, rosterId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Put player on plate error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/rubata/:auctionId/bid - Bid on rubata auction
router.post('/rubata/:auctionId/bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const { amount } = req.body as { amount?: number }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await bidOnRubata(auctionId, req.user!.userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Bid on rubata error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/rubata/:auctionId/close - Close rubata auction (Admin)
router.put('/rubata/:auctionId/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await closeRubataAuction(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close rubata auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
