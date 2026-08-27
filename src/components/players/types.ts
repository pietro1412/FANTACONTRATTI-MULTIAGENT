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

export interface RosterPlayer {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
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
 */
export type RosterRowStatus =
  | { free: true }
  | { free: false; ownerName: string }
