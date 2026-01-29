import { Router } from 'express'
import type { Request, Response } from 'express'
import { Position, PrismaClient } from '@prisma/client'
import { getPlayers, getPlayerById, getTeams } from '../../services/player.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

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

// GET /api/players/stats - Get players with Serie A statistics
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position, team, search, sortBy, sortOrder, page, limit } = req.query

    // Build where clause
    const where: Parameters<typeof prisma.serieAPlayer.findMany>[0]['where'] = {
      isActive: true,
      apiFootballStats: { not: null }, // Only players with stats
    }

    if (position && ['P', 'D', 'C', 'A'].includes(position as string)) {
      where.position = position as Position
    }

    if (team) {
      where.team = team as string
    }

    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string) || 50))
    const skip = (pageNum - 1) * limitNum

    // Get total count
    const total = await prisma.serieAPlayer.count({ where })

    // Get players with stats
    const players = await prisma.serieAPlayer.findMany({
      where,
      select: {
        id: true,
        name: true,
        team: true,
        position: true,
        quotation: true,
        apiFootballId: true,
        apiFootballStats: true,
        statsSyncedAt: true,
      },
      orderBy: sortBy === 'quotation' ? { quotation: sortOrder === 'asc' ? 'asc' : 'desc' }
        : sortBy === 'team' ? { team: sortOrder === 'asc' ? 'asc' : 'desc' }
        : sortBy === 'position' ? { position: sortOrder === 'asc' ? 'asc' : 'desc' }
        : { name: 'asc' },
      skip,
      take: limitNum,
    })

    // Parse stats and flatten for easier frontend use
    const playersWithStats = players.map((p) => {
      const stats = p.apiFootballStats as {
        games?: { appearences?: number; minutes?: number; rating?: number }
        goals?: { total?: number; assists?: number }
        cards?: { yellow?: number; red?: number }
        passes?: { total?: number; key?: number; accuracy?: number }
        shots?: { total?: number; on?: number }
        tackles?: { total?: number; interceptions?: number }
        dribbles?: { attempts?: number; success?: number }
        penalty?: { scored?: number; missed?: number }
      } | null

      return {
        id: p.id,
        name: p.name,
        team: p.team,
        position: p.position,
        quotation: p.quotation,
        apiFootballId: p.apiFootballId,
        statsSyncedAt: p.statsSyncedAt,
        stats: stats ? {
          appearances: stats.games?.appearences ?? 0,
          minutes: stats.games?.minutes ?? 0,
          rating: stats.games?.rating ?? null,
          goals: stats.goals?.total ?? 0,
          assists: stats.goals?.assists ?? 0,
          yellowCards: stats.cards?.yellow ?? 0,
          redCards: stats.cards?.red ?? 0,
          passesTotal: stats.passes?.total ?? 0,
          passesKey: stats.passes?.key ?? 0,
          passAccuracy: stats.passes?.accuracy ?? null,
          shotsTotal: stats.shots?.total ?? 0,
          shotsOn: stats.shots?.on ?? 0,
          tacklesTotal: stats.tackles?.total ?? 0,
          interceptions: stats.tackles?.interceptions ?? 0,
          dribblesAttempts: stats.dribbles?.attempts ?? 0,
          dribblesSuccess: stats.dribbles?.success ?? 0,
          penaltyScored: stats.penalty?.scored ?? 0,
          penaltyMissed: stats.penalty?.missed ?? 0,
        } : null,
      }
    })

    res.json({
      success: true,
      data: {
        players: playersWithStats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    })
  } catch (error) {
    console.error('Get player stats error:', error)
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
