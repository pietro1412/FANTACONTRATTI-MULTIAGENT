/**
 * Fantacalcio.it Stats Service
 *
 * Calcola statistiche giocatore da FantacalcioMatchRating. Servizio
 * completamente isolato da player-stats.service.ts (API-Football): non
 * consumato dal game-core (auction/contract/league/svincolati/trade/rubata),
 * solo da routes/UI. Interfaccia con nome diverso da ComputedSeasonStats
 * per non aggiungersi alla duplicazione gia' esistente tra backend e
 * frontend (vedi src/types/rubata.types.ts, src/types/svincolati.types.ts).
 */

import { prisma } from '@/lib/prisma'

const CURRENT_SEASON = '2025-2026'

export interface FantacalcioSeasonStats {
  season: string
  presenze: number
  titolare: number
  subentrato: number
  avgMv: number | null
  avgFm: number | null
  golSegnati: number
  golSubiti: number
  autoreti: number
  rigoriSegnati: number
  rigoriSbagliati: number
  rigoriParati: number
  assist: number
  potm: number
}

export interface FantacalcioMatchHistoryItem {
  giornata: number
  season: string
  matchDate: string | null
  opponent: string | null
  homeAway: string | null
  mv: number | null
  fm: number | null
  status: string | null
  golSegnati: number
  golSubiti: number
  autoreti: number
  rigoriSegnati: number
  rigoriSbagliati: number
  rigoriParati: number
  assist: number
  potm: number
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100
}

/**
 * Calcola le statistiche stagionali fantacalcio.it per un singolo giocatore.
 * Ritorna null se non ci sono righe per quel player+season (nessun fallback:
 * a differenza di player-stats.service.ts non esiste un blob stantio da
 * cui recuperare, l'assenza di dati e' semplicemente assenza di dati).
 */
export async function computeFantacalcioSeasonStats(
  playerId: string,
  season: string = CURRENT_SEASON
): Promise<FantacalcioSeasonStats | null> {
  const ratings = await prisma.fantacalcioMatchRating.findMany({
    where: { playerId, season },
    select: {
      mv: true,
      fm: true,
      status: true,
      golSegnati: true,
      golSubiti: true,
      autoreti: true,
      rigoriSegnati: true,
      rigoriSbagliati: true,
      rigoriParati: true,
      assist: true,
      potm: true,
    },
  })

  if (ratings.length === 0) return null

  return {
    season,
    presenze: ratings.length,
    titolare: ratings.filter((r) => r.status !== 'Subentrato').length,
    subentrato: ratings.filter((r) => r.status === 'Subentrato').length,
    avgMv: avg(ratings.map((r) => r.mv)),
    avgFm: avg(ratings.map((r) => r.fm)),
    golSegnati: ratings.reduce((s, r) => s + r.golSegnati, 0),
    golSubiti: ratings.reduce((s, r) => s + r.golSubiti, 0),
    autoreti: ratings.reduce((s, r) => s + r.autoreti, 0),
    rigoriSegnati: ratings.reduce((s, r) => s + r.rigoriSegnati, 0),
    rigoriSbagliati: ratings.reduce((s, r) => s + r.rigoriSbagliati, 0),
    rigoriParati: ratings.reduce((s, r) => s + r.rigoriParati, 0),
    assist: ratings.reduce((s, r) => s + r.assist, 0),
    potm: ratings.reduce((s, r) => s + r.potm, 0),
  }
}

/**
 * Batch: calcola le statistiche stagionali fantacalcio.it per piu' giocatori
 * in una singola query (evita N+1).
 */
export async function computeFantacalcioSeasonStatsBatch(
  playerIds: string[],
  season: string = CURRENT_SEASON
): Promise<Map<string, FantacalcioSeasonStats>> {
  if (playerIds.length === 0) return new Map()

  const allRatings = await prisma.fantacalcioMatchRating.findMany({
    where: { playerId: { in: playerIds }, season },
    select: {
      playerId: true,
      mv: true,
      fm: true,
      status: true,
      golSegnati: true,
      golSubiti: true,
      autoreti: true,
      rigoriSegnati: true,
      rigoriSbagliati: true,
      rigoriParati: true,
      assist: true,
      potm: true,
    },
  })

  const byPlayer = new Map<string, typeof allRatings>()
  for (const r of allRatings) {
    const arr = byPlayer.get(r.playerId) || []
    arr.push(r)
    byPlayer.set(r.playerId, arr)
  }

  const result = new Map<string, FantacalcioSeasonStats>()
  for (const [playerId, ratings] of byPlayer) {
    result.set(playerId, {
      season,
      presenze: ratings.length,
      titolare: ratings.filter((r) => r.status !== 'Subentrato').length,
      subentrato: ratings.filter((r) => r.status === 'Subentrato').length,
      avgMv: avg(ratings.map((r) => r.mv)),
      avgFm: avg(ratings.map((r) => r.fm)),
      golSegnati: ratings.reduce((s, r) => s + r.golSegnati, 0),
      golSubiti: ratings.reduce((s, r) => s + r.golSubiti, 0),
      autoreti: ratings.reduce((s, r) => s + r.autoreti, 0),
      rigoriSegnati: ratings.reduce((s, r) => s + r.rigoriSegnati, 0),
      rigoriSbagliati: ratings.reduce((s, r) => s + r.rigoriSbagliati, 0),
      rigoriParati: ratings.reduce((s, r) => s + r.rigoriParati, 0),
      assist: ratings.reduce((s, r) => s + r.assist, 0),
      potm: ratings.reduce((s, r) => s + r.potm, 0),
    })
  }

  return result
}

/**
 * Storico partite fantacalcio.it per un giocatore, tutte le stagioni
 * disponibili, ordinato dalla piu' recente. Usato dal nuovo endpoint
 * dedicato (keyed su playerId interno, non su apiFootballId).
 */
export async function getFantacalcioMatchHistory(playerId: string): Promise<FantacalcioMatchHistoryItem[]> {
  const ratings = await prisma.fantacalcioMatchRating.findMany({
    where: { playerId },
    orderBy: { matchDate: 'desc' },
    select: {
      giornata: true,
      season: true,
      matchDate: true,
      opponent: true,
      homeAway: true,
      mv: true,
      fm: true,
      status: true,
      golSegnati: true,
      golSubiti: true,
      autoreti: true,
      rigoriSegnati: true,
      rigoriSbagliati: true,
      rigoriParati: true,
      assist: true,
      potm: true,
    },
  })

  return ratings.map((r) => ({
    ...r,
    matchDate: r.matchDate ? r.matchDate.toISOString() : null,
  }))
}

export const fantacalcioStatsService = {
  computeFantacalcioSeasonStats,
  computeFantacalcioSeasonStatsBatch,
  getFantacalcioMatchHistory,
  CURRENT_SEASON,
}

export default fantacalcioStatsService
