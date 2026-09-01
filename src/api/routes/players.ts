import { Router } from 'express'
import type { Request, Response } from 'express'
import type { Position, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma'
import { getPlayers, getPlayerById, getTeams } from '../../services/player.service'
import { computeSeasonStatsBatch } from '../../services/player-stats.service'
import {
  computeFantacalcioSeasonStats,
  computeFantacalcioSeasonStatsBatch,
  getFantacalcioMatchHistory,
} from '../../services/fantacalcio-stats.service'
import type { FantacalcioSeasonStats } from '../../services/fantacalcio-stats.service'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Colonne statistiche fantacalcio.it ordinabili in /api/players/stats: il valore
// non e' una colonna su SerieAPlayer ma un aggregato calcolato da FantacalcioMatchRating,
// quindi non puo' finire in un Prisma orderBy — va calcolato per l'intero dataset
// filtrato e poi ordinato/paginato in memoria (vedi uso sotto).
const FC_STAT_SORT_KEYS: Record<string, (fc: FantacalcioSeasonStats | null) => number> = {
  appearances: fc => fc?.presenze ?? 0,
  rating: fc => fc?.avgFm ?? 0,
  mv: fc => fc?.avgMv ?? 0,
  goals: fc => fc?.golSegnati ?? 0,
  assists: fc => fc?.assist ?? 0,
  ga: fc => (fc ? fc.golSegnati + fc.assist : 0),
  goalsConceded: fc => fc?.golSubiti ?? 0,
  penaltyScored: fc => fc?.rigoriSegnati ?? 0,
  penaltyMissed: fc => fc?.rigoriSbagliati ?? 0,
  penaltySaved: fc => fc?.rigoriParati ?? 0,
  ownGoals: fc => fc?.autoreti ?? 0,
  potm: fc => fc?.potm ?? 0,
}

const PLAYER_STATS_SELECT = {
  id: true,
  name: true,
  team: true,
  position: true,
  quotation: true,
  apiFootballId: true,
  apiFootballStats: true,
  statsSyncedAt: true,
  listStatus: true,
  exitReason: true,
} satisfies Prisma.SerieAPlayerSelect

type PlayerStatsRow = Prisma.SerieAPlayerGetPayload<{ select: typeof PLAYER_STATS_SELECT }>

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

    // Compute season stats from PlayerMatchRating (single batch query)
    const statsMap = await computeSeasonStatsBatch(players.map(p => p.id))
    // Fantacalcio.it stats — fonte primaria mostrata in UI (vedi mini-stats sotto)
    const fcStatsMap = await computeFantacalcioSeasonStatsBatch(players.map(p => p.id))

    // Mini-stats (appearances/goals/assists/avgRating) da fantacalcio.it, non
    // piu' dal blob apiFootballStats — stessi nomi campo per non toccare i
    // consumer frontend (NominationPanel, PlayerCard, BiddingPanel).
    const enrichedPlayers = players.map((p: Record<string, unknown>) => {
      const fc = fcStatsMap.get(p.id as string) || null

      return {
        ...p,
        appearances: fc?.presenze ?? null,
        goals: fc?.golSegnati ?? null,
        assists: fc?.assist ?? null,
        avgRating: fc?.avgFm ?? null,
        computedStats: statsMap.get(p.id as string) || null,
        fantacalcioStats: fc,
      }
    })

    res.json({
      success: true,
      data: enrichedPlayers,
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
    const { position, team, search, sortBy, sortOrder, page, limit, leagueId, status } = req.query

    // Build where clause
    const where: Prisma.SerieAPlayerWhereInput = {
      isActive: true,
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

    // Un giocatore uscito da Serie A (ESTERO/RETROCESSO/RITIRATO) non è
    // realmente disponibile a meno che non sia ancora in una rosa di questa
    // lega (indennizzo non ancora accettato, o tenuto dal manager) — stessa
    // regola già applicata a "Tutti i giocatori" (vedi RoseGiocatori.tsx).
    const rosteredIds = leagueId
      ? (await prisma.playerRoster.findMany({
          where: { leagueMember: { leagueId: leagueId as string }, status: 'ACTIVE' },
          select: { playerId: true },
        })).map(r => r.playerId)
      : null

    if (status === 'free') {
      where.exitReason = null
      if (rosteredIds) where.id = { notIn: rosteredIds }
    } else if (status === 'rostered') {
      where.id = { in: rosteredIds ?? [] }
    } else if (status === 'exited') {
      where.id = { in: rosteredIds ?? [] }
      where.exitReason = { not: null }
    } else {
      where.OR = rosteredIds
        ? [{ exitReason: null }, { id: { in: rosteredIds } }]
        : [{ exitReason: null }]
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string) || 50))
    const skip = (pageNum - 1) * limitNum

    // Le colonne statistiche fantacalcio.it non sono colonne su SerieAPlayer
    // (sono un aggregato calcolato da FantacalcioMatchRating): non possono
    // finire in un Prisma orderBy, quindi per queste si ordina l'intero
    // dataset filtrato in memoria e si pagina dopo — altrimenti l'ordinamento
    // varrebbe solo dentro la singola pagina gia' recuperata dal DB.
    const fcSortKey = typeof sortBy === 'string' ? FC_STAT_SORT_KEYS[sortBy] : undefined

    let players: PlayerStatsRow[]
    let total: number
    let fantacalcioStatsMap: Map<string, FantacalcioSeasonStats>

    if (fcSortKey) {
      const allPlayers = await prisma.serieAPlayer.findMany({
        where,
        select: PLAYER_STATS_SELECT,
        orderBy: [{ position: 'asc' }, { name: 'asc' }], // tiebreaker stabile, il vero ordine e' applicato sotto
      })
      const allFcStatsMap = await computeFantacalcioSeasonStatsBatch(allPlayers.map(p => p.id))
      const dir = sortOrder === 'asc' ? 1 : -1
      const sorted = [...allPlayers].sort((a, b) => {
        const av = fcSortKey(allFcStatsMap.get(a.id) ?? null)
        const bv = fcSortKey(allFcStatsMap.get(b.id) ?? null)
        return av !== bv ? (av - bv) * dir : a.name.localeCompare(b.name)
      })
      total = sorted.length
      players = sorted.slice(skip, skip + limitNum)
      fantacalcioStatsMap = allFcStatsMap
    } else {
      total = await prisma.serieAPlayer.count({ where })
      players = await prisma.serieAPlayer.findMany({
        where,
        select: PLAYER_STATS_SELECT,
        // Keep the user-selected criterion; add role+name as coherent tiebreaker
        orderBy: sortBy === 'quotation'
          ? [{ quotation: sortOrder === 'asc' ? 'asc' : 'desc' }, { position: 'asc' }, { name: 'asc' }]
          : sortBy === 'team'
          ? [{ team: sortOrder === 'asc' ? 'asc' : 'desc' }, { position: 'asc' }, { name: 'asc' }]
          : sortBy === 'position'
          ? [{ position: sortOrder === 'asc' ? 'asc' : 'desc' }, { name: 'asc' }]
          : [{ name: sortOrder === 'asc' ? 'asc' : 'desc' }, { position: 'asc' }],
        skip,
        take: limitNum,
      })
      fantacalcioStatsMap = await computeFantacalcioSeasonStatsBatch(players.map(p => p.id))
    }

    // Compute season stats from PlayerMatchRating (single batch query) — solo per la pagina corrente
    const statsMap = await computeSeasonStatsBatch(players.map(p => p.id))

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
        listStatus: p.listStatus,
        exitReason: p.exitReason,
        computedStats: statsMap.get(p.id) || null,
        fantacalcioStats: fantacalcioStatsMap.get(p.id) || null,
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

// GET /api/players/:apiFootballId/match-history - Get player match history
router.get('/:apiFootballId/match-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const apiFootballId = parseInt(req.params.apiFootballId!)

    if (isNaN(apiFootballId)) {
      res.status(400).json({ success: false, message: 'apiFootballId non valido' })
      return
    }

    // Find the player by apiFootballId
    const player = await prisma.serieAPlayer.findFirst({
      where: { apiFootballId },
      select: { id: true },
    })

    if (!player) {
      res.status(404).json({ success: false, message: 'Giocatore non trovato' })
      return
    }

    const matches = await prisma.playerMatchRating.findMany({
      where: { playerId: player.id },
      orderBy: { matchDate: 'desc' },
      select: {
        matchDate: true,
        round: true,
        rating: true,
        minutesPlayed: true,
        goals: true,
        assists: true,
      },
    })

    res.json({
      success: true,
      data: matches.map(m => ({
        matchDate: m.matchDate.toISOString().split('T')[0],
        round: m.round ?? '',
        rating: m.rating,
        minutesPlayed: m.minutesPlayed ?? 0,
        goals: m.goals ?? 0,
        assists: m.assists ?? 0,
      })),
    })
  } catch (error) {
    console.error('Get player match history error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

// GET /api/players/:id/fantacalcio-history - Storico voti fantacalcio.it, keyed
// su id interno SerieAPlayer (non su apiFootballId): copre anche i giocatori
// non ancora matchati con API-Football per le foto.
router.get('/:id/fantacalcio-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const history = await getFantacalcioMatchHistory(id)

    res.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('Get player fantacalcio history error:', error)
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

    const fantacalcioStats = await computeFantacalcioSeasonStats(id)

    res.json({
      success: true,
      data: { ...player, fantacalcioStats },
    })
  } catch (error) {
    console.error('Get player error:', error)
    res.status(500).json({ success: false, message: 'Errore interno del server' })
  }
})

export default router
