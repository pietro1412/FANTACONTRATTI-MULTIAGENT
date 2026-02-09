import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  createAuctionSession,
  getAuctionSessions,
  setMarketPhase,
  updateSessionTimer,
  closeAuctionSession,
  nominatePlayer,
  getCurrentAuction,
  placeBid,
  closeAuction,
  getRoster,
  getLeagueRosters,
  setFirstMarketTurnOrder,
  getFirstMarketStatus,
  advanceToNextRole,
  advanceToNextTurn,
  nominatePlayerByManager,
  cancelLastBid,
  acknowledgeAuction,
  getPendingAcknowledgment,
  setPendingNomination,
  confirmNomination,
  cancelNomination,
  markReady,
  getReadyStatus,
  cancelPendingNomination,
  getMyRosterSlots,
  getManagersStatus,
  forceAcknowledgeAll,
  forceAllReady,
  registerHeartbeat,
  submitAppeal,
  getAppeals,
  resolveAppeal,
  simulateAppeal,
  acknowledgeAppealDecision,
  markReadyToResume,
  forceAllReadyToResume,
  forceAllAppealDecisionAcks,
  getAppealStatus,
  completeAllRosterSlots,
  pauseAuction,
  resumeAuction,
  cancelActiveAuction,
  rectifyTransaction,
} from '../../services/auction.service'
import { simulateFirstMarketBotBidding, completeBotTurn, botNominate, botConfirmNomination } from '../../services/bot.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== AUCTION SESSIONS ====================

// POST /api/leagues/:leagueId/auctions - Create auction session (Admin)
// Body: { isRegularMarket?: boolean } - if true, creates regular market and decrements contracts
router.post('/leagues/:leagueId/auctions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { isRegularMarket, auctionMode } = req.body as { isRegularMarket?: boolean, auctionMode?: 'REMOTE' | 'IN_PRESENCE' }
    const result = await createAuctionSession(leagueId, req.user!.userId, isRegularMarket ?? false, auctionMode ?? 'REMOTE')

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Create auction session error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/auctions - List auction sessions
router.get('/leagues/:leagueId/auctions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAuctionSessions(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get auction sessions error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/phase - Set market phase (Admin)
router.put('/auctions/sessions/:sessionId/phase', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { phase } = req.body as { phase?: string }

    if (!phase) {
      res.status(400).json({ success: false, message: 'phase richiesto' })
      return
    }

    const result = await setMarketPhase(sessionId, req.user!.userId, phase)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set market phase error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/timer - Update timer seconds (Admin)
router.put('/auctions/sessions/:sessionId/timer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { timerSeconds } = req.body as { timerSeconds?: number }

    if (!timerSeconds || typeof timerSeconds !== 'number') {
      res.status(400).json({ success: false, message: 'timerSeconds richiesto' })
      return
    }

    const result = await updateSessionTimer(sessionId, req.user!.userId, timerSeconds)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update timer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/close - Close auction session (Admin)
router.put('/auctions/sessions/:sessionId/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await closeAuctionSession(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close auction session error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== AUCTION ITEMS ====================

// POST /api/auctions/sessions/:sessionId/nominate - Nominate player (Admin)
router.post('/auctions/sessions/:sessionId/nominate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { playerId, basePrice } = req.body as { playerId?: string; basePrice?: number }

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await nominatePlayer(sessionId, playerId, req.user!.userId, basePrice)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Nominate player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/sessions/:sessionId/current - Get current auction
router.get('/auctions/sessions/:sessionId/current', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getCurrentAuction(sessionId, req.user!.userId)

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

// ==================== BIDDING ====================

// POST /api/auctions/:auctionId/bid - Place bid
router.post('/auctions/:auctionId/bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const { amount } = req.body as { amount?: number }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await placeBid(auctionId, req.user!.userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Place bid error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/:auctionId/close - Close auction (Admin)
router.put('/auctions/:auctionId/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await closeAuction(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ROSTER ====================

// GET /api/leagues/:leagueId/roster - Get my roster
router.get('/leagues/:leagueId/roster', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRoster(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get roster error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/roster/:memberId - Get member roster
router.get('/leagues/:leagueId/roster/:memberId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const memberId = req.params.memberId as string
    const result = await getRoster(leagueId, req.user!.userId, memberId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get member roster error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/rosters - Get all rosters in league
router.get('/leagues/:leagueId/rosters', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getLeagueRosters(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get league rosters error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== FIRST MARKET ====================

// PUT /api/auctions/sessions/:sessionId/turn-order - Set turn order (Admin)
router.put('/auctions/sessions/:sessionId/turn-order', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { memberOrder } = req.body as { memberOrder?: string[] }

    if (!memberOrder || !Array.isArray(memberOrder)) {
      res.status(400).json({ success: false, message: 'memberOrder richiesto (array di ID)' })
      return
    }

    const result = await setFirstMarketTurnOrder(sessionId, req.user!.userId, memberOrder)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set turn order error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/sessions/:sessionId/first-market-status - Get first market status
router.get('/auctions/sessions/:sessionId/first-market-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getFirstMarketStatus(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get first market status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/advance-role - Advance to next role (Admin)
router.put('/auctions/sessions/:sessionId/advance-role', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await advanceToNextRole(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Advance role error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/advance-turn - Advance to next turn (Admin)
router.put('/auctions/sessions/:sessionId/advance-turn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await advanceToNextTurn(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Advance turn error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/manager-nominate - Nominate player (current turn manager)
router.post('/auctions/sessions/:sessionId/manager-nominate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { playerId } = req.body as { playerId?: string }

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await nominatePlayerByManager(sessionId, playerId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Manager nominate error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/:auctionId/cancel-bid - Cancel last winning bid (Admin)
router.put('/auctions/:auctionId/cancel-bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await cancelLastBid(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel bid error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== AUCTION ACKNOWLEDGMENT ====================

// GET /api/auctions/sessions/:sessionId/pending-acknowledgment - Get pending acknowledgment info
router.get('/auctions/sessions/:sessionId/pending-acknowledgment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getPendingAcknowledgment(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get pending acknowledgment error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/acknowledge - Acknowledge auction completion
router.post('/auctions/:auctionId/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const { prophecy } = req.body as { prophecy?: string }

    const result = await acknowledgeAuction(auctionId, req.user!.userId, prophecy)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Acknowledge auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== READY CHECK ====================

// POST /api/auctions/sessions/:sessionId/nominate-pending - Set pending nomination
router.post('/auctions/sessions/:sessionId/nominate-pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { playerId } = req.body as { playerId?: string }

    if (!playerId) {
      res.status(400).json({ success: false, message: 'playerId richiesto' })
      return
    }

    const result = await setPendingNomination(sessionId, playerId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Set pending nomination error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/confirm-nomination - Confirm nomination (nominator only)
router.post('/auctions/sessions/:sessionId/confirm-nomination', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await confirmNomination(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Confirm nomination error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/auctions/sessions/:sessionId/nomination - Cancel nomination (nominator or admin)
router.delete('/auctions/sessions/:sessionId/nomination', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await cancelNomination(sessionId, req.user!.userId)

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

// POST /api/auctions/sessions/:sessionId/ready - Mark as ready
router.post('/auctions/sessions/:sessionId/ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await markReady(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Mark ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/sessions/:sessionId/ready-status - Get ready check status
router.get('/auctions/sessions/:sessionId/ready-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getReadyStatus(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get ready status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/auctions/sessions/:sessionId/cancel-nomination - Cancel pending nomination (Admin)
router.put('/auctions/sessions/:sessionId/cancel-nomination', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await cancelPendingNomination(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel nomination error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ROSTER & MANAGERS STATUS ====================

// GET /api/auctions/sessions/:sessionId/my-roster-slots - Get my roster slots
router.get('/auctions/sessions/:sessionId/my-roster-slots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getMyRosterSlots(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get my roster slots error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/sessions/:sessionId/managers-status - Get all managers status
router.get('/auctions/sessions/:sessionId/managers-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await getManagersStatus(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get managers status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// POST /api/auctions/sessions/:sessionId/heartbeat - Register heartbeat for connection tracking
router.post('/auctions/sessions/:sessionId/heartbeat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const { memberId } = req.body as { memberId?: string }

    if (!memberId) {
      res.status(400).json({ success: false, message: 'memberId richiesto' })
      return
    }

    registerHeartbeat(sessionId, memberId)

    res.json({ success: true })
  } catch (error) {
    console.error('Heartbeat error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== TEST UTILITIES (ADMIN ONLY) ====================

// POST /api/auctions/sessions/:sessionId/force-acknowledge-all - Force all managers to acknowledge (TEST)
router.post('/auctions/sessions/:sessionId/force-acknowledge-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await forceAcknowledgeAll(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force acknowledge all error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/force-all-ready - Force all managers ready (TEST)
router.post('/auctions/sessions/:sessionId/force-all-ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await forceAllReady(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/bot-bid - Trigger bot bidding for first market (TEST)
router.post('/auctions/:auctionId/bot-bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await simulateFirstMarketBotBidding(auctionId, req.user!.userId)

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

// POST /api/auctions/sessions/:sessionId/bot-turn - Complete a bot turn (nominate, ready, bid) (TEST)
router.post('/auctions/sessions/:sessionId/bot-turn', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await completeBotTurn(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot turn simulation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/bot-nominate - Simulate bot nominating a player (TEST)
router.post('/auctions/sessions/:sessionId/bot-nominate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await botNominate(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot nominate simulation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/bot-confirm-nomination - Simulate bot confirming nomination (TEST)
router.post('/auctions/sessions/:sessionId/bot-confirm-nomination', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await botConfirmNomination(sessionId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Bot confirm nomination simulation error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/sessions/:sessionId/complete-all-slots - Complete auction filling all roster slots (TEST)
router.post('/auctions/sessions/:sessionId/complete-all-slots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string
    const result = await completeAllRosterSlots(sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Complete all slots error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== APPEALS / RICORSI ====================

// POST /api/auctions/:auctionId/appeal - Submit an appeal for an auction
router.post('/auctions/:auctionId/appeal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const { content } = req.body as { content?: string }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Contenuto del ricorso richiesto' })
      return
    }

    const result = await submitAppeal(auctionId, req.user!.userId, content)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Submit appeal error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/appeals - Get appeals for a league (Admin)
router.get('/leagues/:leagueId/appeals', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const status = req.query.status as 'PENDING' | 'ACCEPTED' | 'REJECTED' | undefined

    const result = await getAppeals(leagueId, req.user!.userId, status)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get appeals error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/appeals/:appealId/resolve - Resolve an appeal (Admin)
router.put('/appeals/:appealId/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const appealId = req.params.appealId as string
    const { decision, resolutionNote } = req.body as { decision?: 'ACCEPTED' | 'REJECTED'; resolutionNote?: string }

    if (!decision || !['ACCEPTED', 'REJECTED'].includes(decision)) {
      res.status(400).json({ success: false, message: 'Decisione richiesta (ACCEPTED o REJECTED)' })
      return
    }

    const result = await resolveAppeal(appealId, req.user!.userId, decision, resolutionNote)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Resolve appeal error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/auctions/:auctionId/appeal-status - Get appeal status for an auction
router.get('/auctions/:auctionId/appeal-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await getAppealStatus(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get appeal status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/acknowledge-appeal-decision - Acknowledge appeal decision
router.post('/auctions/:auctionId/acknowledge-appeal-decision', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await acknowledgeAppealDecision(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Acknowledge appeal decision error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/ready-to-resume - Mark ready to resume after appeal accepted
router.post('/auctions/:auctionId/ready-to-resume', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await markReadyToResume(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Mark ready to resume error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/force-all-appeal-acks - Force all appeal decision acknowledgments (TEST/ADMIN)
router.post('/auctions/:auctionId/force-all-appeal-acks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await forceAllAppealDecisionAcks(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all appeal acks error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/auctions/:auctionId/force-all-ready-resume - Force all ready to resume (TEST/ADMIN)
router.post('/auctions/:auctionId/force-all-ready-resume', authMiddleware, async (req: Request, res: Response) => {
  try {
    const auctionId = req.params.auctionId as string
    const result = await forceAllReadyToResume(auctionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all ready to resume error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/appeals/simulate - Simulate a random appeal (TEST)
router.post('/leagues/:leagueId/appeals/simulate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { auctionId } = req.body as { auctionId?: string }
    const result = await simulateAppeal(leagueId, req.user!.userId, auctionId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Simulate appeal error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ADMIN: PAUSE / RESUME ====================

router.post('/:leagueId/auctions/pause', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params
    const result = await pauseAuction(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Pause auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

router.post('/:leagueId/auctions/resume', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params
    const result = await resumeAuction(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Resume auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ADMIN: CANCEL / RECTIFY ====================

router.post('/:leagueId/auctions/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params
    const { auctionId } = req.body as { auctionId: string }
    const result = await cancelActiveAuction(leagueId, req.user!.userId, auctionId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Cancel auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

router.post('/:leagueId/auctions/rectify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params
    const { auctionId, newWinnerId, newPrice } = req.body as {
      auctionId: string
      newWinnerId?: string
      newPrice?: number
    }
    const result = await rectifyTransaction(leagueId, req.user!.userId, auctionId, newWinnerId, newPrice)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Rectify transaction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
