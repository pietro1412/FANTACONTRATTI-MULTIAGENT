import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  getSessionsOverview,
  getSessionDetails,
  getFirstMarketHistory,
  getSessionTrades,
  getSessionPrizes,
  getSessionRubataHistory,
  getSessionSvincolatiHistory,
  getTimelineEvents,
  getPlayerCareer,
  searchPlayersForHistory,
} from '../../services/history.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ==================== SESSIONS OVERVIEW ====================

// GET /api/leagues/:leagueId/history/sessions - Get all sessions with event counts
router.get('/leagues/:leagueId/history/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const result = await getSessionsOverview(leagueId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get sessions overview error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SESSION DETAILS ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId - Get session details
router.get('/leagues/:leagueId/history/sessions/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const result = await getSessionDetails(leagueId, sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get session details error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== FIRST MARKET ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId/first-market - Get first market history
router.get('/leagues/:leagueId/history/sessions/:sessionId/first-market', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const result = await getFirstMarketHistory(leagueId, sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get first market history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== TRADES ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId/trades - Get session trades
router.get('/leagues/:leagueId/history/sessions/:sessionId/trades', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const { status, limit, offset } = req.query as {
      status?: 'ALL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'COUNTERED'
      limit?: string
      offset?: string
    }

    const options: {
      status?: 'ALL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'COUNTERED'
      limit?: number
      offset?: number
    } = {}

    if (status) options.status = status
    if (limit) options.limit = parseInt(limit)
    if (offset) options.offset = parseInt(offset)

    const result = await getSessionTrades(leagueId, sessionId, req.user!.userId, options)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get session trades error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== PRIZES ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId/prizes - Get session prizes
router.get('/leagues/:leagueId/history/sessions/:sessionId/prizes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const result = await getSessionPrizes(leagueId, sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get session prizes error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== RUBATA ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId/rubata - Get rubata auction history
router.get('/leagues/:leagueId/history/sessions/:sessionId/rubata', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const result = await getSessionRubataHistory(leagueId, sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get rubata history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SVINCOLATI ====================

// GET /api/leagues/:leagueId/history/sessions/:sessionId/svincolati - Get svincolati auction history
router.get('/leagues/:leagueId/history/sessions/:sessionId/svincolati', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, sessionId } = req.params as { leagueId: string; sessionId: string }
    const result = await getSessionSvincolatiHistory(leagueId, sessionId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get svincolati history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== TIMELINE ====================

// GET /api/leagues/:leagueId/history/timeline - Get chronological timeline events
router.get('/leagues/:leagueId/history/timeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { limit, offset, eventTypes, sessionId, playerId, startDate, endDate } = req.query as {
      limit?: string
      offset?: string
      eventTypes?: string
      sessionId?: string
      playerId?: string
      startDate?: string
      endDate?: string
    }

    const options: {
      limit?: number
      offset?: number
      eventTypes?: string[]
      sessionId?: string
      playerId?: string
      startDate?: Date
      endDate?: Date
    } = {}

    if (limit) options.limit = parseInt(limit)
    if (offset) options.offset = parseInt(offset)
    if (eventTypes) options.eventTypes = eventTypes.split(',')
    if (sessionId) options.sessionId = sessionId
    if (playerId) options.playerId = playerId
    if (startDate) options.startDate = new Date(startDate)
    if (endDate) options.endDate = new Date(endDate)

    const result = await getTimelineEvents(leagueId, req.user!.userId, options)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get timeline events error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== SEARCH PLAYERS ====================
// NOTE: This route MUST come before /players/:playerId to avoid "search" being matched as playerId

// GET /api/leagues/:leagueId/history/players/search - Search players for history filter
router.get('/leagues/:leagueId/history/players/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId as string
    const { search, includeReleased, limit } = req.query as {
      search?: string
      includeReleased?: string
      limit?: string
    }

    const options: {
      includeReleased?: boolean
      limit?: number
    } = {}

    if (includeReleased === 'true') options.includeReleased = true
    if (limit) options.limit = parseInt(limit)

    const result = await searchPlayersForHistory(leagueId, req.user!.userId, search, options)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Search players for history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// ==================== PLAYER CAREER ====================

// GET /api/leagues/:leagueId/history/players/:playerId - Get player career in league
router.get('/leagues/:leagueId/history/players/:playerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leagueId, playerId } = req.params as { leagueId: string; playerId: string }
    const result = await getPlayerCareer(leagueId, playerId, req.user!.userId)

    if (!result.success) {
      res.status(result.message === 'Non sei membro di questa lega' ? 403 : 400).json(result)
      return
    }

    res.json(result)
  } catch (error) {
    console.error('Get player career error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
