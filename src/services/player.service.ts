import { PrismaClient, Position } from '@prisma/client'

const prisma = new PrismaClient()

export interface PlayerFilters {
  position?: Position
  team?: string
  search?: string
  available?: boolean // Only players not in any roster in this league
  leagueId?: string
}

export async function getPlayers(filters: PlayerFilters = {}) {
  const where: Record<string, unknown> = {
    isActive: true,
  }

  // When searching for available players (for auctions/market),
  // exclude players not in current list
  if (filters.available) {
    where.listStatus = 'IN_LIST'
  }

  if (filters.position) {
    where.position = filters.position
  }

  if (filters.team) {
    where.team = filters.team
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { team: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const players = await prisma.serieAPlayer.findMany({
    where,
    orderBy: [
      { quotation: 'desc' },
      { name: 'asc' },
    ],
  })

  // If filtering by availability in a league, exclude players already in rosters
  if (filters.available && filters.leagueId) {
    const rosteredPlayerIds = await prisma.playerRoster.findMany({
      where: {
        leagueMember: {
          leagueId: filters.leagueId,
        },
        status: 'ACTIVE',
      },
      select: {
        playerId: true,
      },
    })

    const rosteredIds = new Set(rosteredPlayerIds.map(r => r.playerId))
    return players.filter(p => !rosteredIds.has(p.id))
  }

  return players
}

export async function getPlayerById(playerId: string) {
  return prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })
}

export async function getTeams() {
  const teams = await prisma.serieAPlayer.groupBy({
    by: ['team'],
    _count: true,
    orderBy: {
      team: 'asc',
    },
  })

  return teams.map(t => ({
    name: t.team,
    playerCount: t._count,
  }))
}

// ==================== PLAYER STATS ====================

export interface PlayerStatsFilters {
  position?: Position
  team?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export async function getPlayersWithStats(filters: PlayerStatsFilters = {}) {
  const {
    position,
    team,
    search,
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    limit = 50,
  } = filters

  // Debug: check how many players have stats
  const withStatsCount = await prisma.serieAPlayer.count({
    where: { apiFootballStats: { not: { equals: null } } }
  })
  console.log(`[PlayerStats] Players with apiFootballStats: ${withStatsCount}`)

  const where: Record<string, unknown> = {
    isActive: true,
    apiFootballStats: { not: { equals: null } }, // Only players with stats (Prisma JSON syntax)
  }

  if (position) {
    where.position = position
  }

  if (team) {
    where.team = team
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { team: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Build orderBy based on sortBy
  const orderByMap: Record<string, object[]> = {
    name: [{ name: sortOrder }],
    team: [{ team: sortOrder }, { name: 'asc' }],
    position: [{ position: sortOrder }, { name: 'asc' }],
    quotation: [{ quotation: sortOrder }, { name: 'asc' }],
  }
  const orderBy = orderByMap[sortBy] || [{ name: 'asc' }]

  // Get total count for pagination
  const total = await prisma.serieAPlayer.count({ where })

  // Get players with stats
  const players = await prisma.serieAPlayer.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
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
  })

  // Transform stats for frontend
  const transformedPlayers = players.map(player => {
    const stats = player.apiFootballStats as Record<string, unknown> | null

    return {
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position,
      quotation: player.quotation,
      apiFootballId: player.apiFootballId,
      statsSyncedAt: player.statsSyncedAt,
      stats: stats ? {
        appearances: (stats.games as Record<string, unknown>)?.appearences ?? 0,
        minutes: (stats.games as Record<string, unknown>)?.minutes ?? 0,
        rating: (stats.games as Record<string, unknown>)?.rating ?? null,
        goals: (stats.goals as Record<string, unknown>)?.total ?? 0,
        assists: (stats.goals as Record<string, unknown>)?.assists ?? 0,
        yellowCards: (stats.cards as Record<string, unknown>)?.yellow ?? 0,
        redCards: (stats.cards as Record<string, unknown>)?.red ?? 0,
        passesTotal: (stats.passes as Record<string, unknown>)?.total ?? 0,
        passesKey: (stats.passes as Record<string, unknown>)?.key ?? 0,
        passAccuracy: (stats.passes as Record<string, unknown>)?.accuracy ?? null,
        shotsTotal: (stats.shots as Record<string, unknown>)?.total ?? 0,
        shotsOn: (stats.shots as Record<string, unknown>)?.on ?? 0,
        tacklesTotal: (stats.tackles as Record<string, unknown>)?.total ?? 0,
        interceptions: (stats.tackles as Record<string, unknown>)?.interceptions ?? 0,
        dribblesAttempts: (stats.dribbles as Record<string, unknown>)?.attempts ?? 0,
        dribblesSuccess: (stats.dribbles as Record<string, unknown>)?.success ?? 0,
        penaltyScored: (stats.penalty as Record<string, unknown>)?.scored ?? 0,
        penaltyMissed: (stats.penalty as Record<string, unknown>)?.missed ?? 0,
      } : null,
    }
  })

  return {
    players: transformedPlayers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
