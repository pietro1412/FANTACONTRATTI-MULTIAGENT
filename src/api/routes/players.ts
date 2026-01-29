import { Router } from 'express'
import type { Request, Response } from 'express'
import { Position } from '@prisma/client'
import { getPlayers, getPlayerById, getTeams, getPlayersWithStats } from '../../services/player.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/players - List all players with filters
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position, team, search, available, leagueId } = req.query

    const filters: {
      position?: Position
      team?: string
      search?: string
      available?: boolean
      leagueId?: string
    } = {}

    if (position && ['P', 'D', 'C', 'A'].includes(position as string)) {
      filters.position = position as Position
    }

    if (team) {
      filters.team = team as string
    }

    if (search) {
      filters.search = search as string
    }

    if (available === 'true' && leagueId) {
      filters.available = true
      filters.leagueId = leagueId as string
    }

    const players = await getPlayers(filters)

    res.json({
      success: true,
      data: players,
    })
  } catch (error) {
    console.error('Get players error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/players/teams - Get all teams
router.get('/teams', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const teams = await getTeams()

    res.json({
      success: true,
      data: teams,
    })
  } catch (error) {
    console.error('Get teams error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/players/stats - Get players with stats (for PlayerStats page)
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position, team, search, sortBy, sortOrder, page, limit } = req.query

    const filters: {
      position?: Position
      team?: string
      search?: string
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      page?: number
      limit?: number
    } = {}

    if (position && ['P', 'D', 'C', 'A'].includes(position as string)) {
      filters.position = position as Position
    }
    if (team) filters.team = team as string
    if (search) filters.search = search as string
    if (sortBy) filters.sortBy = sortBy as string
    if (sortOrder === 'asc' || sortOrder === 'desc') filters.sortOrder = sortOrder
    if (page) filters.page = parseInt(page as string, 10)
    if (limit) filters.limit = parseInt(limit as string, 10)

    const result = await getPlayersWithStats(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Get players with stats error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/players/:id - Get player by ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const player = await getPlayerById(id)

    if (!player) {
      res.status(404).json({ success: false, message: 'Giocatore non trovato' })
      return
    }

    res.json({
      success: true,
      data: player,
    })
  } catch (error) {
    console.error('Get player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
