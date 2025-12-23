import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  createTradeOffer,
  getReceivedOffers,
  getSentOffers,
  acceptTrade,
  rejectTrade,
  counterOffer,
  cancelTradeOffer,
  getTradeHistory,
} from '../../services/trade.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== TRADE OFFERS ====================

// POST /api/leagues/:leagueId/trades - Create trade offer
router.post('/leagues/:leagueId/trades', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const {
      toMemberId,
      offeredPlayerIds,
      requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      message,
      durationHours,
    } = req.body as {
      toMemberId: string
      offeredPlayerIds: string[]
      requestedPlayerIds: string[]
      offeredBudget?: number
      requestedBudget?: number
      message?: string
      durationHours?: number
    }

    if (!toMemberId) {
      res.status(400).json({ success: false, message: 'toMemberId richiesto' })
      return
    }

    if ((!offeredPlayerIds || offeredPlayerIds.length === 0) &&
        (!requestedPlayerIds || requestedPlayerIds.length === 0) &&
        !offeredBudget && !requestedBudget) {
      res.status(400).json({ success: false, message: 'Devi offrire o richiedere almeno qualcosa' })
      return
    }

    const result = await createTradeOffer(
      leagueId,
      req.user!.userId,
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
  } catch (error) {
    console.error('Create trade offer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/trades/received - Get received offers
router.get('/leagues/:leagueId/trades/received', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getReceivedOffers(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get received offers error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/trades/sent - Get sent offers
router.get('/leagues/:leagueId/trades/sent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getSentOffers(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get sent offers error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/trades/history - Get trade history
router.get('/leagues/:leagueId/trades/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getTradeHistory(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get trade history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== TRADE ACTIONS ====================

// PUT /api/trades/:tradeId/accept - Accept trade
router.put('/trades/:tradeId/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tradeId = req.params.tradeId as string
    const result = await acceptTrade(tradeId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Accept trade error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/trades/:tradeId/reject - Reject trade
router.put('/trades/:tradeId/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tradeId = req.params.tradeId as string
    const result = await rejectTrade(tradeId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Reject trade error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/trades/:tradeId/cancel - Cancel trade offer
router.put('/trades/:tradeId/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tradeId = req.params.tradeId as string
    const result = await cancelTradeOffer(tradeId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel trade error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/trades/:tradeId/counter - Counter offer
router.post('/trades/:tradeId/counter', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tradeId = req.params.tradeId as string
    const {
      offeredPlayerIds,
      requestedPlayerIds,
      offeredBudget,
      requestedBudget,
      message,
    } = req.body as {
      offeredPlayerIds: string[]
      requestedPlayerIds: string[]
      offeredBudget?: number
      requestedBudget?: number
      message?: string
    }

    const result = await counterOffer(
      tradeId,
      req.user!.userId,
      offeredPlayerIds || [],
      requestedPlayerIds || [],
      offeredBudget || 0,
      requestedBudget || 0,
      message
    )

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Counter offer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
