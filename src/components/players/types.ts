// Shared domain types for the Rose / Giocatori cluster views.

export interface ComputedSeasonStats {
  season: string
  appearances: number
  totalMinutes: number
  avgRating: number | null
  totalGoals: number
  totalAssists: number
  startingXI: number
  matchesInSquad: number
}

/** Statistiche stagionali da fantacalcio.it (fonte primaria mostrata in UI, vedi FantacalcioSeasonStats in fantacalcio-stats.service.ts). */
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

export interface RosterPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
  fantacalcioStats?: FantacalcioSeasonStats | null
  statsSyncedAt?: string | null
  /** PlayerListStatus — 'NOT_IN_LIST' se il giocatore non è più in Serie A. */
  listStatus?: string
  /** Motivo di uscita dalla Serie A (RITIRATO/RETROCESSO/ESTERO), se noto. */
  exitReason?: string | null
}

export interface RosterContract {
  /** Not needed by the row/card presentational components — optional so the
   * "Tutti i giocatori" tab (RoseGiocatori) can build a RosterEntry from the
   * lighter contract shape returned alongside the player database. */
  id?: string
  salary: number
  duration: number
  rescissionClause: number | null
  signedAt?: string
}

export interface RosterEntry {
  id: string
  playerId: string
  acquisitionPrice: number
  acquisitionType: string
  player: RosterPlayer
  contract?: RosterContract | null
}

/**
 * Free-agent / owner status column — shown only when provided. Rose omits it
 * (every entry there is always "in rosa" by definition); the "Tutti i
 * giocatori" tab passes it to distinguish free agents from rostered players.
 * `exitReason`, when set on a free entry, means the player is not a genuine
 * free agent but has left Serie A (ESTERO/RETROCESSO/RITIRATO) — see
 * getExitReasonTag below.
 */
export type RosterRowStatus =
  | { free: true; exitReason?: string | null }
  | { free: false; ownerName: string }

export type ExitReasonTagTone = 'primary' | 'secondary' | 'accent' | 'danger' | 'warning' | 'neutral'

const EXIT_REASON_TAGS: Record<string, { tone: ExitReasonTagTone; label: string }> = {
  ESTERO: { tone: 'accent', label: 'ESTERO' },
  RETROCESSO: { tone: 'primary', label: 'RETROCESSO' },
  RITIRATO: { tone: 'neutral', label: 'RITIRATO' },
}

/** Tone + label for a player's exitReason, or null if not set/unrecognized. */
export function getExitReasonTag(exitReason?: string | null): { tone: ExitReasonTagTone; label: string } | null {
  if (!exitReason) return null
  return EXIT_REASON_TAGS[exitReason] ?? { tone: 'neutral', label: exitReason }
}
