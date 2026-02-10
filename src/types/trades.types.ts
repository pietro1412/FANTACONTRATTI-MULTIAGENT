export interface TradesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  highlightOfferId?: string
}

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
  // Financial data from getFinancials API
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
  // API returns these for sent offers and history:
  sender?: { id: string; username: string }
  receiver?: { id: string; username: string }
  offeredPlayerDetails?: Player[]
  requestedPlayerDetails?: Player[]
  // API returns these for received offers:
  offeredPlayers?: Player[]
  requestedPlayers?: Player[]
}

export interface MarketSession {
  id: string
  currentPhase: string
  status: string
}

// ============================================================================
// TradeMovement interface
// ============================================================================
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

export interface ReceivedPlayerForModification {
  rosterId: string
  contractId?: string
  playerId: string
  playerName: string
  playerTeam: string
  playerPosition: string
  contract: {
    salary: number
    duration: number
    initialSalary: number
    rescissionClause: number
  } | null
}

// Helper per calcolare il tempo rimanente
export function getTimeRemaining(expiresAt: string | undefined): { text: string; isUrgent: boolean; isExpired: boolean } {
  if (!expiresAt) return { text: 'Nessuna scadenza', isUrgent: false, isExpired: false }

  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduta', isUrgent: true, isExpired: true }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { text: `${days}g ${hours % 24}h`, isUrgent: false, isExpired: false }
  } else if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, isUrgent: hours < 6, isExpired: false }
  } else {
    return { text: `${minutes}m`, isUrgent: true, isExpired: false }
  }
}

// Helper per ottenere il colore del ruolo
export function getRoleStyle(position: string) {
  switch (position) {
    case 'P': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40', label: 'POR' }
    case 'D': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'DIF' }
    case 'C': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'CEN' }
    case 'A': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', label: 'ATT' }
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', label: position }
  }
}

export function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}
