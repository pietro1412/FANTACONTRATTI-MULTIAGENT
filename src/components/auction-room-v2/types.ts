import type {
  Auction, Membership, MarketProgress, ReadyStatus,
  PendingAcknowledgment, MyRosterSlots, ManagersStatusData,
  ManagerData, FirstMarketStatus, Player,
} from '../../types/auctionroom.types'

export interface AuctionViewProps {
  // Auction state
  auction: Auction | null
  timeLeft: number | null
  timerSetting: number
  isTimerExpired: boolean

  // User
  membership: Membership | null
  isAdmin: boolean
  isMyTurn: boolean
  isUserWinning: boolean
  currentUsername: string | undefined

  // Managers
  managersStatus: ManagersStatusData | null
  currentTurnManager: { memberId?: string; username: string; index?: number } | null
  firstMarketStatus: FirstMarketStatus | null

  // Roster
  myRosterSlots: MyRosterSlots | null

  // Progress
  marketProgress: MarketProgress | null

  // Bid
  bidAmount: string
  setBidAmount: (amount: string) => void
  onPlaceBid: () => void

  // Connection
  isConnected: boolean
  connectionStatus: string

  // Ready check
  readyStatus: ReadyStatus | null
  onMarkReady: () => void
  onConfirmNomination: () => void
  onCancelNomination: () => void
  markingReady: boolean

  // Acknowledgment
  pendingAck: PendingAcknowledgment | null
  onAcknowledge: () => void
  ackSubmitting: boolean

  // Nomination
  players: Player[]
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTeam: string
  onTeamChange: (team: string) => void
  availableTeams: Array<{ name: string; playerCount: number }>
  teamDropdownOpen: boolean
  setTeamDropdownOpen: (open: boolean) => void
  onNominatePlayer: (playerId: string) => void

  // Actions
  onSelectManager: (manager: ManagerData) => void
  onCloseAuction?: () => void

  // Admin Controls
  onUpdateTimer?: (seconds: number) => void
  onBotNominate?: () => void
  onBotConfirmNomination?: () => void
  onBotBid?: () => void
  onForceAllReady?: () => void
  onForceAcknowledgeAll?: () => void
  onCompleteAllSlots?: () => void
  onResetFirstMarket?: () => void
  onPauseAuction?: () => void
  onResumeAuction?: () => void

  // Session info
  isPrimoMercato: boolean
}

export type AuctionPhase = 'nomination' | 'readyCheck' | 'bidding' | 'acknowledgment' | 'waiting'

export const PHASE_COLORS: Record<AuctionPhase, { bg: string; border: string; text: string; label: string }> = {
  nomination: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/40',
    text: 'text-violet-400',
    label: 'NOMINA',
  },
  readyCheck: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    label: 'VERIFICA',
  },
  bidding: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    label: 'ASTA',
  },
  acknowledgment: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/40',
    text: 'text-teal-400',
    label: 'CONFERMA',
  },
  waiting: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    label: 'ATTESA',
  },
}
