/**
 * types.ts - Tipi condivisi per i layout asta
 *
 * Creato il: 24/01/2026
 */

export interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
  apiFootballId?: number | null
}

export interface Bid {
  id: string
  amount: number
  placedAt: string
  bidder: {
    user: { username: string }
  }
}

export interface Auction {
  id: string
  basePrice: number
  currentPrice: number
  status: string
  timerExpiresAt: string | null
  timerSeconds: number | null
  player: Player
  bids: Bid[]
  winner?: {
    user: { username: string }
  }
}

export interface Membership {
  id: string
  role: string
  currentBudget: number
}

export interface ManagerRosterPlayer {
  id: string
  playerId: string
  playerName: string
  playerTeam: string
  position: string
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface ManagerData {
  id: string
  username: string
  teamName: string | null
  role: string
  currentBudget: number
  slotsFilled: number
  totalSlots: number
  isConnected?: boolean
  slotsByPosition: {
    P: { filled: number; total: number }
    D: { filled: number; total: number }
    C: { filled: number; total: number }
    A: { filled: number; total: number }
  }
  isCurrentTurn: boolean
  roster: ManagerRosterPlayer[]
}

export interface ManagersStatusData {
  managers: ManagerData[]
  currentTurnManager: ManagerData | null
  currentRole: string
  slotLimits: { P: number; D: number; C: number; A: number }
  myId: string
  allConnected?: boolean
}

export interface RosterSlot {
  id: string
  playerId: string
  playerName: string
  playerTeam: string
  acquisitionPrice: number
  contract?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

export interface MyRosterSlots {
  slots: {
    P: { filled: number; total: number; players: RosterSlot[] }
    D: { filled: number; total: number; players: RosterSlot[] }
    C: { filled: number; total: number; players: RosterSlot[] }
    A: { filled: number; total: number; players: RosterSlot[] }
  }
  currentRole: string
  budget: number
}

export interface MarketProgress {
  currentRole: string
  currentRoleName: string
  roleSequence: string[]
  filledSlots: number
  totalSlots: number
  slotLimits: { P: number; D: number; C: number; A: number }
}

// Player per nomination
export interface NominationPlayer {
  id: string
  name: string
  team: string
  position: string
  quotation?: number
  apiFootballId?: number | null
}

// Props comuni per tutti i layout
export interface AuctionLayoutProps {
  // Stato asta
  auction: Auction | null
  timeLeft: number | null
  timerSetting: number
  isTimerExpired: boolean

  // Utente
  membership: Membership | null
  isAdmin: boolean
  isMyTurn: boolean
  isUserWinning: boolean
  currentUsername: string | undefined

  // Manager
  managersStatus: ManagersStatusData | null
  currentTurnManager: { username: string } | null

  // Rosa
  myRosterSlots: MyRosterSlots | null

  // Progress
  marketProgress: MarketProgress | null

  // Offerta
  bidAmount: string
  setBidAmount: (amount: string) => void
  onPlaceBid: () => void

  // Connessione
  isConnected: boolean
  connectionStatus: string

  // Azioni
  onSelectManager: (manager: ManagerData) => void
  onCloseAuction?: () => void

  // Nomination (opzionale, per stato attesa)
  players?: NominationPlayer[]
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onNominatePlayer?: (playerId: string) => void

  // Admin Controls (opzionale)
  onUpdateTimer?: (seconds: number) => void
  onBotNominate?: () => void
  onBotConfirmNomination?: () => void
  onBotBid?: () => void
  onForceAllReady?: () => void
  onForceAcknowledgeAll?: () => void
  onCompleteAllSlots?: () => void
  onResetFirstMarket?: () => void
}

// Costanti condivise
export const POSITION_NAMES: Record<string, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti'
}

// Re-exported from canonical source
export { POSITION_GRADIENTS as POSITION_COLORS } from '@/components/ui/PositionBadge'

export const POSITION_BG: Record<string, string> = {
  P: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  D: 'bg-green-500/20 text-green-400 border-green-500/50',
  C: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  A: 'bg-red-500/20 text-red-400 border-red-500/50'
}
