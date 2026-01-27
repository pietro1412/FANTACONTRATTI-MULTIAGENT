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
  // New board-based rubata functions
  generateRubataBoard,
  getRubataBoard,
  startRubata,
  updateRubataTimers,
  makeRubataOffer,
  bidOnRubataAuction,
  advanceRubataPlayer,
  goBackRubataPlayer,
  closeCurrentRubataAuction,
  pauseRubata,
  resumeRubata,
  // Ready check and acknowledgment
  getRubataReadyStatus,
  setRubataReady,
  forceAllRubataReady,
  getRubataPendingAck,
  acknowledgeRubataTransaction,
  forceAllRubataAcknowledge,
  // Admin simulation
  simulateRubataOffer,
  simulateRubataBid,
  completeRubataWithTransactions,
  // Rubata preferences (preview mode)
  getRubataPreferences,
  setRubataPreference,
  deleteRubataPreference,
  getRubataPreviewBoard,
  setRubataToPreview,
  // Year-round strategies
  getAllPlayersForStrategies,
  getAllSvincolatiForStrategies,
  // Connection tracking
  registerRubataHeartbeat,
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

// ==================== RUBATA BOARD (Timer-based) ====================

// GET /api/leagues/:leagueId/rubata/board - Get rubata board with current state
router.get('/leagues/:leagueId/rubata/board', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataBoard(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata board error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/board/generate - Generate the rubata board (Admin)
router.post('/leagues/:leagueId/rubata/board/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await generateRubataBoard(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Generate rubata board error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/start - Start rubata (Admin)
router.post('/leagues/:leagueId/rubata/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await startRubata(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Start rubata error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/rubata/timers - Update rubata timers (Admin)
router.put('/leagues/:leagueId/rubata/timers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { offerTimerSeconds, auctionTimerSeconds } = req.body as {
      offerTimerSeconds?: number
      auctionTimerSeconds?: number
    }

    const result = await updateRubataTimers(leagueId, req.user!.userId, offerTimerSeconds, auctionTimerSeconds)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Update rubata timers error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/offer - Make initial offer on current player
router.post('/leagues/:leagueId/rubata/offer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await makeRubataOffer(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Make rubata offer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/auction/bid - Bid on active rubata auction
router.post('/leagues/:leagueId/rubata/auction/bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { amount } = req.body as { amount?: number }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Importo non valido' })
      return
    }

    const result = await bidOnRubataAuction(leagueId, req.user!.userId, amount)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Bid on rubata auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/advance - Advance to next player (Admin)
router.post('/leagues/:leagueId/rubata/advance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await advanceRubataPlayer(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Advance rubata player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/back - Go back to previous player (Admin)
router.post('/leagues/:leagueId/rubata/back', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await goBackRubataPlayer(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Go back rubata player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/close-auction - Close current auction and transfer player (Admin)
router.post('/leagues/:leagueId/rubata/close-auction', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await closeCurrentRubataAuction(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Close current rubata auction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/pause - Pause rubata (Admin)
router.post('/leagues/:leagueId/rubata/pause', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await pauseRubata(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Pause rubata error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/resume - Resume rubata (Admin)
router.post('/leagues/:leagueId/rubata/resume', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await resumeRubata(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Resume rubata error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== READY CHECK ====================

// GET /api/leagues/:leagueId/rubata/ready-status - Get ready status
router.get('/leagues/:leagueId/rubata/ready-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataReadyStatus(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata ready status error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/ready - Set member as ready
router.post('/leagues/:leagueId/rubata/ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await setRubataReady(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set rubata ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/force-ready - Force all ready (Admin)
router.post('/leagues/:leagueId/rubata/force-ready', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await forceAllRubataReady(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all rubata ready error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== TRANSACTION ACKNOWLEDGMENT ====================

// GET /api/leagues/:leagueId/rubata/pending-ack - Get pending acknowledgment
router.get('/leagues/:leagueId/rubata/pending-ack', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataPendingAck(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata pending ack error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/acknowledge - Acknowledge transaction
router.post('/leagues/:leagueId/rubata/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { prophecy } = req.body as { prophecy?: string }
    const result = await acknowledgeRubataTransaction(leagueId, req.user!.userId, prophecy)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Acknowledge rubata transaction error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/force-acknowledge - Force all acknowledge (Admin)
router.post('/leagues/:leagueId/rubata/force-acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await forceAllRubataAcknowledge(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Force all rubata acknowledge error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== ADMIN SIMULATION ====================

// POST /api/leagues/:leagueId/rubata/simulate-offer - Simulate offer from another manager (Admin)
router.post('/leagues/:leagueId/rubata/simulate-offer', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { targetMemberId } = req.body as { targetMemberId?: string }

    if (!targetMemberId) {
      res.status(400).json({ success: false, message: 'targetMemberId richiesto' })
      return
    }

    const result = await simulateRubataOffer(leagueId, req.user!.userId, targetMemberId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Simulate rubata offer error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/simulate-bid - Simulate bid from another manager (Admin)
router.post('/leagues/:leagueId/rubata/simulate-bid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { targetMemberId, amount } = req.body as { targetMemberId?: string; amount?: number }

    if (!targetMemberId || !amount) {
      res.status(400).json({ success: false, message: 'targetMemberId e amount richiesti' })
      return
    }

    const result = await simulateRubataBid(leagueId, req.user!.userId, targetMemberId, amount)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.status(201).json(result)
  } catch (error) {
    console.error('Simulate rubata bid error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/complete-with-transactions - Complete rubata with random transactions (Admin)
router.post('/leagues/:leagueId/rubata/complete-with-transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { stealProbability } = req.body

    const result = await completeRubataWithTransactions(
      leagueId,
      req.user!.userId,
      stealProbability ?? 0.3
    )

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.status(200).json(result)
  } catch (error) {
    console.error('Complete rubata with transactions error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RUBATA PREFERENCES (PREVIEW MODE) ====================

// GET /api/leagues/:leagueId/rubata/preferences - Get my preferences
router.get('/leagues/:leagueId/rubata/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataPreferences(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata preferences error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// PUT /api/leagues/:leagueId/rubata/preferences/:playerId - Set preference for a player
router.put('/leagues/:leagueId/rubata/preferences/:playerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const playerId = req.params.playerId as string
    const { isWatchlist, isAutoPass, maxBid, priority, notes } = req.body

    const result = await setRubataPreference(leagueId, req.user!.userId, playerId, {
      isWatchlist,
      isAutoPass,
      maxBid,
      priority,
      notes,
    })

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set rubata preference error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// DELETE /api/leagues/:leagueId/rubata/preferences/:playerId - Delete preference
router.delete('/leagues/:leagueId/rubata/preferences/:playerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const playerId = req.params.playerId as string

    const result = await deleteRubataPreference(leagueId, req.user!.userId, playerId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Delete rubata preference error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/rubata/preview - Get preview board with preferences
router.get('/leagues/:leagueId/rubata/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getRubataPreviewBoard(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata preview board error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// POST /api/leagues/:leagueId/rubata/preview - Set rubata to preview mode (Admin)
router.post('/leagues/:leagueId/rubata/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await setRubataToPreview(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non autorizzato' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Set rubata to preview error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== YEAR-ROUND STRATEGIES ====================

// GET /api/leagues/:leagueId/rubata/strategies - Get all players with strategies (year-round)
router.get('/leagues/:leagueId/rubata/strategies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAllPlayersForStrategies(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all players for strategies error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/leagues/:leagueId/rubata/svincolati-strategies - Get all svincolati with strategies (year-round)
router.get('/leagues/:leagueId/rubata/svincolati-strategies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getAllSvincolatiForStrategies(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get all svincolati for strategies error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== HEARTBEAT / CONNECTION STATUS ====================

// POST /api/leagues/:leagueId/rubata/heartbeat - Register heartbeat for connection tracking
router.post('/leagues/:leagueId/rubata/heartbeat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { memberId } = req.body as { memberId?: string }

    if (!memberId) {
      res.status(400).json({ success: false, message: 'memberId richiesto' })
      return
    }

    registerRubataHeartbeat(leagueId, memberId)

    res.json({ success: true })
  } catch (error) {
    console.error('Rubata heartbeat error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
