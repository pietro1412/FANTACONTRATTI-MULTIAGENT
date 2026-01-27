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
  // Nuove funzioni a turni
  setSvincolatiTurnOrder,
  getSvincolatiBoard,
  nominateFreeAgent,
  confirmSvincolatiNomination,
  cancelSvincolatiNomination,
  markReadyForSvincolati,
  passSvincolatiTurn,
  forceAllReadyForSvincolati,
  closeSvincolatiAuction,
  acknowledgeSvincolatiAuction,
  forceAllSvincolatiAck,
  setSvincolatiTimer,
  completeSvincolatiPhase,
  // Bot simulation functions
  botNominateSvincolati,
  botConfirmSvincolatiNomination,
  botBidSvincolati,
  // Finished phase
  declareSvincolatiFinished,
  undoSvincolatiFinished,
  forceAllSvincolatiFinished,
  // Connection tracking
  registerSvincolatiHeartbeat,
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

// ===========================================================================
// ==================== NUOVE API A TURNI SVINCOLATI =========================
// ===========================================================================

// GET /api/leagues/:leagueId/svincolati/board - Get svincolati board state
router.get('/leagues/:leagueId/svincolati/board', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getSvincolatiBoard(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get svincolati board error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/turn-order - Set turn order (Admin)
router.post('/leagues/:leagueId/svincolati/turn-order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { memberIds } = req.body as { memberIds?: string[] }

    if (!memberIds || !Array.isArray(memberIds)) {
      res.status(400).json({ success: false, message: 'memberIds richiesto (array)' })
      return
    }

    const result = await setSvincolatiTurnOrder(leagueId, req.user!.userId, memberIds)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Set svincolati turn order error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/nominate - Nominate a free agent
router.post('/leagues/:leagueId/svincolati/nominate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { playerId } = req.body as { playerId?: string }

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await nominateFreeAgent(leagueId, req.user!.userId, playerId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Nominate free agent error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/svincolati/confirm - Confirm nomination
router.put('/leagues/:leagueId/svincolati/confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await confirmSvincolatiNomination(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Confirm nomination error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:leagueId/svincolati/nomination - Cancel nomination
router.delete('/leagues/:leagueId/svincolati/nomination', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await cancelSvincolatiNomination(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel nomination error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/ready - Mark ready
router.post('/leagues/:leagueId/svincolati/ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await markReadyForSvincolati(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Mark ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/pass - Pass turn
router.post('/leagues/:leagueId/svincolati/pass', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await passSvincolatiTurn(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Pass turn error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/force-ready - Force all ready (Admin)
router.post('/leagues/:leagueId/svincolati/force-ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await forceAllReadyForSvincolati(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/svincolati/:auctionId/close-turn - Close svincolati auction (turn-based)
router.put('/svincolati/:auctionId/close-turn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await closeSvincolatiAuction(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close svincolati auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/acknowledge - Acknowledge auction result
router.post('/leagues/:leagueId/svincolati/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await acknowledgeSvincolatiAuction(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Acknowledge auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/force-ack - Force all acks (Admin)
router.post('/leagues/:leagueId/svincolati/force-ack', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await forceAllSvincolatiAck(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force ack error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/svincolati/timer - Set timer (Admin)
router.put('/leagues/:leagueId/svincolati/timer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { timerSeconds } = req.body as { timerSeconds?: number }

    if (!timerSeconds || typeof timerSeconds !== 'number') {
      res.status(400).json({ success: false, message: 'timerSeconds richiesto' })
      return
    }

    const result = await setSvincolatiTimer(leagueId, req.user!.userId, timerSeconds)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set timer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/svincolati/complete - Complete svincolati phase (Admin)
router.put('/leagues/:leagueId/svincolati/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await completeSvincolatiPhase(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Complete phase error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ===========================================================================
// ==================== BOT SIMULATION (ADMIN TEST) ==========================
// ===========================================================================

// POST /api/leagues/:leagueId/svincolati/bot-nominate - Bot nominate random player (Admin)
router.post('/leagues/:leagueId/svincolati/bot-nominate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await botNominateSvincolati(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot nominate error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/bot-confirm - Bot confirm nomination (Admin)
router.post('/leagues/:leagueId/svincolati/bot-confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await botConfirmSvincolatiNomination(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot confirm error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/svincolati/:auctionId/bot-bid-turn - Bot bid on svincolati auction (Admin)
router.post('/svincolati/:auctionId/bot-bid-turn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await botBidSvincolati(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot bid error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== DECLARE FINISHED ====================

// POST /api/leagues/:leagueId/svincolati/finished - Declare finished with phase
router.post('/leagues/:leagueId/svincolati/finished', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await declareSvincolatiFinished(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Declare finished error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:leagueId/svincolati/finished - Undo declare finished
router.delete('/leagues/:leagueId/svincolati/finished', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await undoSvincolatiFinished(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Undo finished error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/svincolati/force-all-finished - Force all managers as finished (Admin)
router.post('/leagues/:leagueId/svincolati/force-all-finished', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await forceAllSvincolatiFinished(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all finished error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// POST /api/leagues/:leagueId/svincolati/heartbeat - Register heartbeat for connection tracking
router.post('/leagues/:leagueId/svincolati/heartbeat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { memberId } = req.body as { memberId?: string }

    if (!memberId) {
      res.status(400).json({ success: false, message: 'memberId richiesto' })
      return
    }

    registerSvincolatiHeartbeat(leagueId, memberId)

    res.json({ success: true })
  } catch (error) {
    console.error('Svincolati heartbeat error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
