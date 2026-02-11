/**
 * Player Stats Service
 *
 * Calcola statistiche giocatori da PlayerMatchRating invece di apiFootballStats.
 * Fonte dati accurata e sempre aggiornata.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CURRENT_SEASON = '2025-2026'

export interface ComputedSeasonStats {
  season: string
  appearances: number      // Presenze (minutesPlayed > 0)
  totalMinutes: number     // Somma minuti
  avgRating: number | null // Media rating (null se nessuna presenza)
  totalGoals: number       // Somma gol
  totalAssists: number     // Somma assist
  startingXI: number       // Titolarità (minutesPlayed >= 60)
  matchesInSquad: number   // Convocazioni totali (tutti i record)
}

// ==================== AUTO TAGS ====================

export type AutoTagId =
  | 'TITOLARE'
  | 'RIGORISTA'
  | 'IN_CRESCITA'
  | 'IN_CALO'
  | 'GIOVANE'
  | 'ANZIANO'
  | 'TOP_PERFORMER'
  | 'GOLEADOR'
  | 'INFORTUNATO'

export interface AutoTag {
  id: AutoTagId
  label: string
  icon: string
  color: string     // Tailwind color class
  description: string
}

/**
 * Calcola le statistiche stagionali per un singolo giocatore
 */
export async function computeSeasonStats(
  playerId: string,
  season: string = CURRENT_SEASON
): Promise<ComputedSeasonStats | null> {
  const ratings = await prisma.playerMatchRating.findMany({
    where: {
      playerId,
      season,
    },
    select: {
      rating: true,
      minutesPlayed: true,
      goals: true,
      assists: true,
    },
  })

  if (ratings.length === 0) {
    // Fallback to apiFootballStats if no match ratings available
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: playerId },
      select: { apiFootballStats: true },
    })

    const s = player?.apiFootballStats as {
      games?: { appearences?: number; minutes?: number; rating?: number }
      goals?: { total?: number; assists?: number }
    } | null

    if (s?.games?.appearences && s.games.appearences > 0) {
      return {
        season: '2024-2025',
        appearances: s.games.appearences ?? 0,
        totalMinutes: s.games.minutes ?? 0,
        avgRating: s.games.rating ? Math.round(s.games.rating * 100) / 100 : null,
        totalGoals: s.goals?.total ?? 0,
        totalAssists: s.goals?.assists ?? 0,
        startingXI: 0,
        matchesInSquad: s.games.appearences ?? 0,
      }
    }

    return null
  }

  // Filtra solo le partite effettivamente giocate
  const playedMatches = ratings.filter(r => r.minutesPlayed && r.minutesPlayed > 0)

  // Calcola media rating (solo per partite giocate con rating valido)
  const ratingsWithValue = playedMatches.filter(r => r.rating != null && r.rating > 0)
  const avgRating = ratingsWithValue.length > 0
    ? ratingsWithValue.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValue.length
    : null

  return {
    season,
    appearances: playedMatches.length,
    totalMinutes: playedMatches.reduce((sum, r) => sum + (r.minutesPlayed || 0), 0),
    avgRating: avgRating ? Math.round(avgRating * 100) / 100 : null,
    totalGoals: playedMatches.reduce((sum, r) => sum + (r.goals || 0), 0),
    totalAssists: playedMatches.reduce((sum, r) => sum + (r.assists || 0), 0),
    startingXI: playedMatches.filter(r => (r.minutesPlayed || 0) >= 60).length,
    matchesInSquad: ratings.length,
  }
}

/**
 * Calcola le statistiche stagionali per più giocatori in batch
 * Ottimizzato per evitare N+1 queries
 */
export async function computeSeasonStatsBatch(
  playerIds: string[],
  season: string = CURRENT_SEASON
): Promise<Map<string, ComputedSeasonStats>> {
  if (playerIds.length === 0) {
    return new Map()
  }

  // Query singola per tutti i giocatori
  const allRatings = await prisma.playerMatchRating.findMany({
    where: {
      playerId: { in: playerIds },
      season,
    },
    select: {
      playerId: true,
      rating: true,
      minutesPlayed: true,
      goals: true,
      assists: true,
    },
  })

  // Raggruppa per playerId
  const ratingsByPlayer = new Map<string, typeof allRatings>()
  for (const rating of allRatings) {
    const existing = ratingsByPlayer.get(rating.playerId) || []
    existing.push(rating)
    ratingsByPlayer.set(rating.playerId, existing)
  }

  // Calcola stats per ogni giocatore
  const result = new Map<string, ComputedSeasonStats>()

  // Collect IDs without match ratings for apiFootballStats fallback
  const missingIds: string[] = []

  for (const playerId of playerIds) {
    const ratings = ratingsByPlayer.get(playerId) || []

    if (ratings.length === 0) {
      missingIds.push(playerId)
      continue
    }

    const playedMatches = ratings.filter(r => r.minutesPlayed && r.minutesPlayed > 0)
    const ratingsWithValue = playedMatches.filter(r => r.rating != null && r.rating > 0)
    const avgRating = ratingsWithValue.length > 0
      ? ratingsWithValue.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValue.length
      : null

    result.set(playerId, {
      season,
      appearances: playedMatches.length,
      totalMinutes: playedMatches.reduce((sum, r) => sum + (r.minutesPlayed || 0), 0),
      avgRating: avgRating ? Math.round(avgRating * 100) / 100 : null,
      totalGoals: playedMatches.reduce((sum, r) => sum + (r.goals || 0), 0),
      totalAssists: playedMatches.reduce((sum, r) => sum + (r.assists || 0), 0),
      startingXI: playedMatches.filter(r => (r.minutesPlayed || 0) >= 60).length,
      matchesInSquad: ratings.length,
    })
  }

  // Fallback: for players without PlayerMatchRating data, use apiFootballStats JSON
  if (missingIds.length > 0) {
    const fallbackPlayers = await prisma.serieAPlayer.findMany({
      where: { id: { in: missingIds }, apiFootballStats: { not: null } },
      select: { id: true, apiFootballStats: true },
    })

    for (const p of fallbackPlayers) {
      const s = p.apiFootballStats as {
        games?: { appearences?: number; minutes?: number; rating?: number }
        goals?: { total?: number; assists?: number }
      } | null

      if (s?.games?.appearences && s.games.appearences > 0) {
        result.set(p.id, {
          season: '2024-2025',
          appearances: s.games.appearences ?? 0,
          totalMinutes: s.games.minutes ?? 0,
          avgRating: s.games.rating ? Math.round(s.games.rating * 100) / 100 : null,
          totalGoals: s.goals?.total ?? 0,
          totalAssists: s.goals?.assists ?? 0,
          startingXI: 0,
          matchesInSquad: s.games.appearences ?? 0,
        })
      }
    }
  }

  return result
}

/**
 * Verifica se un giocatore ha dati di rating disponibili
 */
export async function hasRatingData(playerId: string, season: string = CURRENT_SEASON): Promise<boolean> {
  const count = await prisma.playerMatchRating.count({
    where: { playerId, season },
  })
  return count > 0
}

// ==================== AUTO TAG DEFINITIONS ====================

export const AUTO_TAG_DEFS: Record<AutoTagId, Omit<AutoTag, 'id'>> = {
  TITOLARE:       { label: 'Titolare',       icon: '11', color: 'text-green-400',   description: 'Titolare nella maggior parte delle partite (>= 60 min in 70%+ presenze)' },
  RIGORISTA:      { label: 'Rigorista',      icon: 'P',  color: 'text-blue-400',    description: 'Ha segnato rigori in stagione' },
  IN_CRESCITA:    { label: 'In Crescita',    icon: '+',  color: 'text-emerald-400', description: 'Rating ultime 3 partite superiore alla media stagionale' },
  IN_CALO:        { label: 'In Calo',        icon: '-',  color: 'text-red-400',     description: 'Rating ultime 3 partite inferiore alla media stagionale' },
  GIOVANE:        { label: 'Giovane',        icon: 'G',  color: 'text-cyan-400',    description: 'Eta inferiore a 25 anni' },
  ANZIANO:        { label: 'Veterano',       icon: 'V',  color: 'text-amber-400',   description: 'Eta superiore a 30 anni' },
  TOP_PERFORMER:  { label: 'Top Performer',  icon: '*',  color: 'text-yellow-400',  description: 'Rating medio stagionale >= 7.0' },
  GOLEADOR:       { label: 'Goleador',       icon: 'F',  color: 'text-orange-400',  description: 'Gol superiori alla media del ruolo' },
  INFORTUNATO:    { label: 'Infortunato',    icon: 'X',  color: 'text-red-500',     description: 'Attualmente infortunato' },
}

export function getAutoTagDef(id: AutoTagId): AutoTag {
  return { id, ...AUTO_TAG_DEFS[id] }
}

// ==================== AUTO TAG COMPUTATION ====================

interface PlayerTagInput {
  playerId: string
  age: number | null
  position: string
  apiFootballStats: Record<string, unknown> | null
}

/**
 * Computes auto-tags for a batch of players.
 * Uses existing match rating data + player metadata.
 */
export async function computeAutoTagsBatch(
  players: PlayerTagInput[],
  season: string = CURRENT_SEASON
): Promise<Map<string, AutoTagId[]>> {
  const playerIds = players.map(p => p.playerId)
  if (playerIds.length === 0) return new Map()

  // Fetch all match ratings ordered by date for trend detection
  const allRatings = await prisma.playerMatchRating.findMany({
    where: { playerId: { in: playerIds }, season },
    select: {
      playerId: true,
      rating: true,
      minutesPlayed: true,
      goals: true,
      matchDate: true,
    },
    orderBy: { matchDate: 'asc' },
  })

  // Group by player
  const ratingsByPlayer = new Map<string, typeof allRatings>()
  for (const r of allRatings) {
    const arr = ratingsByPlayer.get(r.playerId) || []
    arr.push(r)
    ratingsByPlayer.set(r.playerId, arr)
  }

  // Compute position-based goal averages for GOLEADOR tag
  const goalsByPosition: Record<string, number[]> = {}
  for (const p of players) {
    const ratings = ratingsByPlayer.get(p.playerId) || []
    const totalGoals = ratings.filter(r => r.minutesPlayed && r.minutesPlayed > 0)
      .reduce((sum, r) => sum + (r.goals || 0), 0)
    if (!goalsByPosition[p.position]) goalsByPosition[p.position] = []
    goalsByPosition[p.position].push(totalGoals)
  }
  const avgGoalsByPosition: Record<string, number> = {}
  for (const [pos, goals] of Object.entries(goalsByPosition)) {
    avgGoalsByPosition[pos] = goals.length > 0 ? goals.reduce((a, b) => a + b, 0) / goals.length : 0
  }

  // Compute tags for each player
  const result = new Map<string, AutoTagId[]>()

  for (const player of players) {
    const tags: AutoTagId[] = []
    const ratings = ratingsByPlayer.get(player.playerId) || []
    const playedMatches = ratings.filter(r => r.minutesPlayed && r.minutesPlayed > 0)
    const ratingsWithValue = playedMatches.filter(r => r.rating != null && r.rating > 0)

    // TITOLARE: >= 60 min in 70%+ of played matches
    if (playedMatches.length >= 3) {
      const startingXI = playedMatches.filter(r => (r.minutesPlayed || 0) >= 60).length
      if (startingXI / playedMatches.length >= 0.7) {
        tags.push('TITOLARE')
      }
    }

    // TOP_PERFORMER: avg rating >= 7.0
    if (ratingsWithValue.length >= 3) {
      const avgRating = ratingsWithValue.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValue.length
      if (avgRating >= 7.0) tags.push('TOP_PERFORMER')

      // IN_CRESCITA / IN_CALO: last 3 vs season average
      const last3 = ratingsWithValue.slice(-3)
      if (last3.length === 3) {
        const last3Avg = last3.reduce((sum, r) => sum + (r.rating || 0), 0) / 3
        if (last3Avg > avgRating + 0.2) tags.push('IN_CRESCITA')
        else if (last3Avg < avgRating - 0.3) tags.push('IN_CALO')
      }
    }

    // GOLEADOR: goals > 1.5x position average
    const totalGoals = playedMatches.reduce((sum, r) => sum + (r.goals || 0), 0)
    const posAvg = avgGoalsByPosition[player.position] || 0
    if (totalGoals > 0 && posAvg > 0 && totalGoals >= posAvg * 1.5) {
      tags.push('GOLEADOR')
    }

    // GIOVANE / ANZIANO
    if (player.age != null) {
      if (player.age < 25) tags.push('GIOVANE')
      else if (player.age > 30) tags.push('ANZIANO')
    }

    // RIGORISTA: from apiFootballStats
    const stats = player.apiFootballStats as Record<string, unknown> | null
    if (stats) {
      const penalty = stats.penalty as { scored?: number } | undefined
      if (penalty && (penalty.scored || 0) > 0) tags.push('RIGORISTA')

      // INFORTUNATO: from apiFootballStats
      if (stats.injured === true) tags.push('INFORTUNATO')
    }

    if (tags.length > 0) {
      result.set(player.playerId, tags)
    }
  }

  return result
}

export const playerStatsService = {
  computeSeasonStats,
  computeSeasonStatsBatch,
  computeAutoTagsBatch,
  hasRatingData,
  CURRENT_SEASON,
  AUTO_TAG_DEFS,
  getAutoTagDef,
}

export default playerStatsService
