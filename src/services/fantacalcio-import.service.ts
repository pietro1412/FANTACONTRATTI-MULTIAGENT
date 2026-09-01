/**
 * Import statistiche fantacalcio.it in FantacalcioMatchRating.
 *
 * Fonte separata da API-Football (PlayerMatchRating), vedi
 * prisma/schemas/player.prisma per il modello dedicato. Servizio a se'
 * stante, non consumato dal game-core (auction/contract/league/svincolati/
 * trade/rubata) in questa fase.
 */

import { prisma } from '@/lib/prisma'

// ==================== TYPES (shape dei JSON prodotti da scripts/_scrape-fantacalcio-voti.mjs) ====================

export interface RawMatchInfo {
  matchId: string | null
  matchDate: string | null
  opponent: string | null
  homeAway: string | null
  scoreFor: number | null
  scoreAgainst: number | null
  stadium: string | null
}

export interface RawVoto {
  voto: number | null
  fantavoto: number | null
}

export interface RawPlayerRow {
  squadra: string
  playerId: number | null
  nome: string
  ruolo: string | null
  status: string | null
  match: RawMatchInfo | null
  voti: RawVoto[]
  bonus: Record<string, number>
}

export interface RawGiornataData {
  giornata: number
  season: string // "2025-26"
  players: RawPlayerRow[]
}

export interface ImportGiornataResult {
  giornata: number
  upserted: number
  skippedUnmatched: number
  skippedNoMatchId: number
}

/** Valori noti per il campo status (documentati, non enforced come Prisma enum). */
export const KNOWN_STATUS_VALUES = ['Sostituito', 'Subentrato'] as const

// ==================== NORMALIZZAZIONE ====================

/**
 * "2025-26" -> "2025-2026". Coerente col formato usato da
 * player-stats.service.ts (CURRENT_SEASON = '2025-2026').
 */
export function normalizeSeasonString(season: string): string {
  const m = season.match(/^(\d{4})-(\d{2})$/)
  if (!m) return season // gia' nel formato lungo o formato inatteso, non alterare
  const startYear = m[1]!
  const endYearShort = m[2]!
  const endYear = startYear.slice(0, 2) + endYearShort
  return `${startYear}-${endYear}`
}

// ==================== APPLY MATCHES (persiste fantacalcioId su SerieAPlayer) ====================

export interface ApplyMatchesResult {
  updated: number
  errors: Array<{ dbId: string; fantacalcioPlayerId: number; error: string }>
}

export async function applyMatches(
  matches: Array<{ dbId: string; fantacalcioPlayerId: number }>
): Promise<ApplyMatchesResult> {
  let updated = 0
  const errors: ApplyMatchesResult['errors'] = []

  for (const m of matches) {
    try {
      await prisma.serieAPlayer.update({
        where: { id: m.dbId },
        data: { fantacalcioId: m.fantacalcioPlayerId },
      })
      updated++
    } catch (e) {
      errors.push({ dbId: m.dbId, fantacalcioPlayerId: m.fantacalcioPlayerId, error: (e as Error).message })
    }
  }

  return { updated, errors }
}

// ==================== IMPORT GIORNATA ====================

/**
 * Importa una giornata: upsert vero (non skip-duplicates) perche'
 * fantacalcio.it corregge i voti a posteriori — un reimport deve
 * propagare le correzioni, non ignorarle.
 */
export async function importGiornata(data: RawGiornataData, dryRun = false): Promise<ImportGiornataResult> {
  const season = normalizeSeasonString(data.season)

  const fcPlayerIds = data.players.map((p) => p.playerId).filter((id): id is number => id != null)
  const dbPlayers = await prisma.serieAPlayer.findMany({
    where: { fantacalcioId: { in: fcPlayerIds } },
    select: { id: true, fantacalcioId: true },
  })
  const playerIdByFcId = new Map(dbPlayers.map((p) => [p.fantacalcioId!, p.id]))

  let upserted = 0
  let skippedUnmatched = 0
  let skippedNoMatchId = 0

  for (const row of data.players) {
    if (row.playerId == null || !playerIdByFcId.has(row.playerId)) {
      skippedUnmatched++
      continue
    }
    if (!row.match?.matchId) {
      skippedNoMatchId++
      continue
    }

    const playerId = playerIdByFcId.get(row.playerId)!
    // Il primo elemento di voti[] e' sempre la Redazione Fantacalcio (icona
    // ico-fc.svg, prima colonna della tabella su fantacalcio.it); gli altri
    // due sono "Voto Statistico" e "Voto Italia" — panel diversi, non vanno
    // mediati col voto ufficiale fantacalcio.it. Verificato: 12500/12500
    // righe scrapate hanno esattamente 3 voti, voti[0] mai nullo.
    const mv = row.voti[0]?.voto ?? null
    const fm = row.voti[0]?.fantavoto ?? null

    if (dryRun) {
      upserted++
      continue
    }

    await prisma.fantacalcioMatchRating.upsert({
      where: { playerId_matchId: { playerId, matchId: row.match.matchId } },
      create: {
        playerId,
        fantacalcioPlayerId: row.playerId,
        matchId: row.match.matchId,
        giornata: data.giornata,
        season,
        matchDate: row.match.matchDate ? new Date(row.match.matchDate) : null,
        opponent: row.match.opponent,
        homeAway: row.match.homeAway,
        mv,
        fm,
        status: row.status,
        golSegnati: row.bonus['Gol segnati'] ?? 0,
        golSubiti: row.bonus['Gol subiti'] ?? 0,
        autoreti: row.bonus['Autoreti'] ?? 0,
        rigoriSegnati: row.bonus['Rigori segnati'] ?? 0,
        rigoriSbagliati: row.bonus['Rigori sbagliati'] ?? 0,
        rigoriParati: row.bonus['Rigori parati'] ?? 0,
        assist: row.bonus['Assist'] ?? 0,
        potm: row.bonus['Player of the match'] ?? 0,
      },
      update: {
        matchDate: row.match.matchDate ? new Date(row.match.matchDate) : null,
        opponent: row.match.opponent,
        homeAway: row.match.homeAway,
        mv,
        fm,
        status: row.status,
        golSegnati: row.bonus['Gol segnati'] ?? 0,
        golSubiti: row.bonus['Gol subiti'] ?? 0,
        autoreti: row.bonus['Autoreti'] ?? 0,
        rigoriSegnati: row.bonus['Rigori segnati'] ?? 0,
        rigoriSbagliati: row.bonus['Rigori sbagliati'] ?? 0,
        rigoriParati: row.bonus['Rigori parati'] ?? 0,
        assist: row.bonus['Assist'] ?? 0,
        potm: row.bonus['Player of the match'] ?? 0,
      },
    })
    upserted++
  }

  return { giornata: data.giornata, upserted, skippedUnmatched, skippedNoMatchId }
}
