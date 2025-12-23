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
    where.name = {
      contains: filters.search,
      mode: 'insensitive',
    }
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
