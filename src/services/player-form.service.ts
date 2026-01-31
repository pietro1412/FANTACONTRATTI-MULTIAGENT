/**
 * Player Form Service
 * Gestisce lo storico delle performance dei giocatori e calcola la "form" recente
 */

import { prisma } from '../lib/prisma'

// Numero di partite per calcolare la form recente
const FORM_MATCHES = 5

export interface PlayerFormEntry {
  fixtureId: number
  matchDate: Date
  opponent: string
  isHome: boolean
  competition: string | null
  minutesPlayed: number | null
  rating: number | null
  goals: number
  assists: number
  started: boolean
  yellowCards: number
  redCards: number
}

export interface PlayerFormSummary {
  playerId: string
  playerName: string
  recentMatches: PlayerFormEntry[]
  formIndex: number | null      // Media rating ultime N partite
  formTrend: 'up' | 'down' | 'stable' | null  // Trend rispetto a media stagionale
  totalMinutes: number          // Minuti totali ultime N partite
  minutesPercentage: number     // % minuti giocati (su max 90*N)
  goalsRecent: number           // Gol ultime N partite
  assistsRecent: number         // Assist ultime N partite
  starterPercentage: number     // % partite da titolare
}

/**
 * Ottiene lo storico form di un giocatore
 */
export async function getPlayerFormHistory(
  playerId: string,
  limit: number = 10
): Promise<{ success: boolean; data?: PlayerFormEntry[]; message?: string }> {
  try {
    const history = await prisma.playerFormHistory.findMany({
      where: { playerId },
      orderBy: { matchDate: 'desc' },
      take: limit,
    })

    return {
      success: true,
      data: history.map(h => ({
        fixtureId: h.fixtureId,
        matchDate: h.matchDate,
        opponent: h.opponent,
        isHome: h.isHome,
        competition: h.competition,
        minutesPlayed: h.minutesPlayed,
        rating: h.rating,
        goals: h.goals,
        assists: h.assists,
        started: h.started,
        yellowCards: h.yellowCards,
        redCards: h.redCards,
      })),
    }
  } catch (error) {
    console.error('Error getting player form history:', error)
    return { success: false, message: 'Errore nel recupero dello storico' }
  }
}

/**
 * Calcola il riepilogo form di un giocatore
 */
export async function getPlayerFormSummary(
  playerId: string
): Promise<{ success: boolean; data?: PlayerFormSummary; message?: string }> {
  try {
    const player = await prisma.serieAPlayer.findUnique({
      where: { id: playerId },
      select: { id: true, name: true, apiFootballStats: true },
    })

    if (!player) {
      return { success: false, message: 'Giocatore non trovato' }
    }

    const recentMatches = await prisma.playerFormHistory.findMany({
      where: { playerId },
      orderBy: { matchDate: 'desc' },
      take: FORM_MATCHES,
    })

    // Calcola metriche
    const validRatings = recentMatches.filter(m => m.rating !== null).map(m => m.rating!)
    const formIndex = validRatings.length > 0
      ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
      : null

    const totalMinutes = recentMatches.reduce((sum, m) => sum + (m.minutesPlayed || 0), 0)
    const maxMinutes = FORM_MATCHES * 90
    const minutesPercentage = Math.round((totalMinutes / maxMinutes) * 100)

    const goalsRecent = recentMatches.reduce((sum, m) => sum + m.goals, 0)
    const assistsRecent = recentMatches.reduce((sum, m) => sum + m.assists, 0)

    const startersCount = recentMatches.filter(m => m.started).length
    const starterPercentage = recentMatches.length > 0
      ? Math.round((startersCount / recentMatches.length) * 100)
      : 0

    // Calcola trend rispetto a media stagionale
    let formTrend: 'up' | 'down' | 'stable' | null = null
    if (formIndex !== null && player.apiFootballStats) {
      const stats = player.apiFootballStats as { games?: { rating?: string } }
      const seasonRating = stats.games?.rating ? parseFloat(stats.games.rating) : null
      if (seasonRating !== null) {
        const diff = formIndex - seasonRating
        if (diff > 0.3) formTrend = 'up'
        else if (diff < -0.3) formTrend = 'down'
        else formTrend = 'stable'
      }
    }

    return {
      success: true,
      data: {
        playerId: player.id,
        playerName: player.name,
        recentMatches: recentMatches.map(h => ({
          fixtureId: h.fixtureId,
          matchDate: h.matchDate,
          opponent: h.opponent,
          isHome: h.isHome,
          competition: h.competition,
          minutesPlayed: h.minutesPlayed,
          rating: h.rating,
          goals: h.goals,
          assists: h.assists,
          started: h.started,
          yellowCards: h.yellowCards,
          redCards: h.redCards,
        })),
        formIndex: formIndex !== null ? Math.round(formIndex * 10) / 10 : null,
        formTrend,
        totalMinutes,
        minutesPercentage,
        goalsRecent,
        assistsRecent,
        starterPercentage,
      },
    }
  } catch (error) {
    console.error('Error getting player form summary:', error)
    return { success: false, message: 'Errore nel calcolo del riepilogo form' }
  }
}

/**
 * Salva una entry nello storico form (usato dal job di sync)
 */
export async function savePlayerFormEntry(
  playerId: string,
  entry: Omit<PlayerFormEntry, 'fixtureId'> & { fixtureId: number }
): Promise<{ success: boolean; message?: string }> {
  try {
    await prisma.playerFormHistory.upsert({
      where: {
        playerId_fixtureId: {
          playerId,
          fixtureId: entry.fixtureId,
        },
      },
      create: {
        playerId,
        fixtureId: entry.fixtureId,
        matchDate: entry.matchDate,
        opponent: entry.opponent,
        isHome: entry.isHome,
        competition: entry.competition,
        minutesPlayed: entry.minutesPlayed,
        rating: entry.rating,
        goals: entry.goals,
        assists: entry.assists,
        started: entry.started,
        yellowCards: entry.yellowCards,
        redCards: entry.redCards,
      },
      update: {
        matchDate: entry.matchDate,
        opponent: entry.opponent,
        isHome: entry.isHome,
        competition: entry.competition,
        minutesPlayed: entry.minutesPlayed,
        rating: entry.rating,
        goals: entry.goals,
        assists: entry.assists,
        started: entry.started,
        yellowCards: entry.yellowCards,
        redCards: entry.redCards,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error saving player form entry:', error)
    return { success: false, message: 'Errore nel salvataggio' }
  }
}

/**
 * Ottiene il form summary per più giocatori (ottimizzato per liste)
 */
export async function getPlayersFormBatch(
  playerIds: string[]
): Promise<{ success: boolean; data?: Record<string, PlayerFormSummary>; message?: string }> {
  try {
    if (playerIds.length === 0) {
      return { success: true, data: {} }
    }

    // Ottieni tutti i form history in una query
    const allHistory = await prisma.playerFormHistory.findMany({
      where: { playerId: { in: playerIds } },
      orderBy: { matchDate: 'desc' },
    })

    // Ottieni i dati dei giocatori
    const players = await prisma.serieAPlayer.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true, apiFootballStats: true },
    })

    const playerMap = new Map(players.map(p => [p.id, p]))

    // Raggruppa per giocatore
    const historyByPlayer = new Map<string, typeof allHistory>()
    for (const entry of allHistory) {
      const list = historyByPlayer.get(entry.playerId) || []
      if (list.length < FORM_MATCHES) {
        list.push(entry)
      }
      historyByPlayer.set(entry.playerId, list)
    }

    // Calcola summary per ogni giocatore
    const result: Record<string, PlayerFormSummary> = {}

    for (const playerId of playerIds) {
      const player = playerMap.get(playerId)
      if (!player) continue

      const recentMatches = historyByPlayer.get(playerId) || []

      const validRatings = recentMatches.filter(m => m.rating !== null).map(m => m.rating!)
      const formIndex = validRatings.length > 0
        ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
        : null

      const totalMinutes = recentMatches.reduce((sum, m) => sum + (m.minutesPlayed || 0), 0)
      const maxMinutes = FORM_MATCHES * 90
      const minutesPercentage = Math.round((totalMinutes / maxMinutes) * 100)

      const goalsRecent = recentMatches.reduce((sum, m) => sum + m.goals, 0)
      const assistsRecent = recentMatches.reduce((sum, m) => sum + m.assists, 0)

      const startersCount = recentMatches.filter(m => m.started).length
      const starterPercentage = recentMatches.length > 0
        ? Math.round((startersCount / recentMatches.length) * 100)
        : 0

      let formTrend: 'up' | 'down' | 'stable' | null = null
      if (formIndex !== null && player.apiFootballStats) {
        const stats = player.apiFootballStats as { games?: { rating?: string } }
        const seasonRating = stats.games?.rating ? parseFloat(stats.games.rating) : null
        if (seasonRating !== null) {
          const diff = formIndex - seasonRating
          if (diff > 0.3) formTrend = 'up'
          else if (diff < -0.3) formTrend = 'down'
          else formTrend = 'stable'
        }
      }

      result[playerId] = {
        playerId: player.id,
        playerName: player.name,
        recentMatches: recentMatches.map(h => ({
          fixtureId: h.fixtureId,
          matchDate: h.matchDate,
          opponent: h.opponent,
          isHome: h.isHome,
          competition: h.competition,
          minutesPlayed: h.minutesPlayed,
          rating: h.rating,
          goals: h.goals,
          assists: h.assists,
          started: h.started,
          yellowCards: h.yellowCards,
          redCards: h.redCards,
        })),
        formIndex: formIndex !== null ? Math.round(formIndex * 10) / 10 : null,
        formTrend,
        totalMinutes,
        minutesPercentage,
        goalsRecent,
        assistsRecent,
        starterPercentage,
      }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting players form batch:', error)
    return { success: false, message: 'Errore nel recupero batch form' }
  }
}
