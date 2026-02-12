export interface PlayerContract {
  salary: number
  duration: number
  rescissionClause?: number
}

export interface Player {
  id: string
  name: string
  team: string
  position: string
  contract?: PlayerContract | null
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: {
    season: string
    appearances: number
    totalMinutes: number
    avgRating: number | null
    totalGoals: number
    totalAssists: number
    startingXI: number
    matchesInSquad: number
  } | null
  statsSyncedAt?: string | null
}

export interface RosterEntry {
  id: string
  player: Player
  acquisitionPrice: number
  memberId?: string
  memberUsername?: string
}

export interface LeagueMember {
  id: string
  currentBudget: number
  user: { username: string }
  annualContractCost?: number
  slotCount?: number
}

export interface TradeOffer {
  id: string
  offeredPlayerIds: string[]
  requestedPlayerIds: string[]
  offeredBudget: number
  requestedBudget: number
  message?: string
  status: string
  createdAt: string
  expiresAt?: string
  fromMember?: { user: { username: string } }
  toMember?: { user: { username: string } }
  sender?: { id: string; username: string }
  receiver?: { id: string; username: string }
  offeredPlayerDetails?: Player[]
  requestedPlayerDetails?: Player[]
  offeredPlayers?: Player[]
  requestedPlayers?: Player[]
}

export interface MarketSession {
  id: string
  currentPhase: string
  status: string
}

export interface TradeMovement {
  id: string
  movementType: string
  player: { id: string; name: string; position: string; team: string }
  fromMember: { id: string; username: string; teamName: string } | null
  toMember: { id: string; username: string; teamName: string } | null
  price: number | null
  oldSalary: number | null
  newSalary: number | null
  createdAt: string
}
