import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getFreeAgents,
  getTeams,
  startFreeAgentAuction,
  bidOnFreeAgent,
  closeFreeAgentAuction,
  getCurrentFreeAgentAuction,
  getFreeAgentsHistory,
} from '../../services/svincolati.service'
import { simulateBotBidding, getBotMembers } from '../../services/bot.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== FREE AGENTS LIST ====================

// GET /api/leagues/:leagueId/svincolati - Get free agents pool
router.get('/leagues/:leagueId/svincolati', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { position, team, search, minQuotation, maxQuotation } = req.query as {
      position?: string
      team?: string
      search?: string
      minQuotation?: string
      maxQuotation?: string
    }

    const filters = {
      position: position as 'P' | 'D' | 'C' | 'A' | undefined,
      team,
      search,
      minQuotation: minQuotation ? parseInt(minQuotation) : undefined,
      maxQuotation: maxQuotation ? parseInt(maxQuotation) : undefined,
    }

    const result = await getFreeAgents(leagueId, req.user!.userId, filters)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get free agents error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/svincolati/teams - Get list of teams
router.get('/svincolati/teams', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await getTeams()
    res.json(result)
  } catch (error) {
    console.error('Get teams error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== AUCTION STATUS ====================

// GET /api/leagues/:leagueId/svincolati/current - Get current auction status
router.get('/leagues/:leagueId/svincolati/current', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getCurrentFreeAgentAuction(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get current auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/svincolati/history - Get auction history
router.get('/leagues/:leagueId/svincolati/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getFreeAgentsHistory(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get auction history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== AUCTION MANAGEMENT ====================

// POST /api/leagues/:leagueId/svincolati/auction - Start auction for a free agent (Admin)
router.post('/leagues/:leagueId/svincolati/auction', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { playerId, basePrice } = req.body as { playerId?: string; basePrice?: number }

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await startFreeAgentAuction(leagueId, playerId, req.user!.userId, basePrice)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Start free agent auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/svincolati/:auctionId/bid - Bid on free agent auction
router.post('/svincolati/:auctionId/bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const { amount } = req.body as { amount?: number }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await bidOnFreeAgent(auctionId, req.user!.userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Bid on free agent error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/svincolati/:auctionId/close - Close free agent auction (Admin)
router.put('/svincolati/:auctionId/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await closeFreeAgentAuction(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close free agent auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== BOT SIMULATION ====================

// POST /api/svincolati/:auctionId/bot-bid - Trigger bot bidding simulation
router.post('/svincolati/:auctionId/bot-bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await simulateBotBidding(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot bidding simulation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/bots - Get bot members info
router.get('/leagues/:leagueId/bots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getBotMembers(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get bot members error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
