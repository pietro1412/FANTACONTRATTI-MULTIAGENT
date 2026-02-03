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

  for (const playerId of playerIds) {
    const ratings = ratingsByPlayer.get(playerId) || []

    if (ratings.length === 0) {
      continue // Non aggiungiamo giocatori senza dati
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

export const playerStatsService = {
  computeSeasonStats,
  computeSeasonStatsBatch,
  hasRatingData,
  CURRENT_SEASON,
}

export default playerStatsService
