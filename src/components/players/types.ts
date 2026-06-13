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
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
  statsSyncedAt?: string | null
}

export interface RosterContract {
  id: string
  salary: number
  duration: number
  rescissionClause: number | null
  signedAt: string
}

export interface RosterEntry {
  id: string
  playerId: string
  acquisitionPrice: number
  acquisitionType: string
  player: RosterPlayer
  contract?: RosterContract | null
}
