export interface League {
  id: string
  name: string
  description?: string
  maxParticipants: number
  minParticipants: number
  requireEvenNumber: boolean
  initialBudget: number
  status: string
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
}

export interface Member {
  id: string
  role: string
  status: string
  currentBudget: number
  teamName?: string
  user: { id: string; username: string; email: string }
}

export interface MarketSession {
  id: string
  type: string
  status: string
  currentPhase: string | null
  season: number
  semester: number
  createdAt: string
}

export interface Invite {
  id: string
  email: string
  status: string
  createdAt: string
  expiresAt: string
}

export interface ConsolidationManager {
  memberId: string
  username: string
  playerCount: number
  isConsolidated: boolean
  consolidatedAt: string | null
}

export interface ConsolidationStatus {
  inContrattiPhase: boolean
  sessionId?: string
  managers: ConsolidationManager[]
  consolidatedCount: number
  totalCount: number
  allConsolidated: boolean
}

export interface Appeal {
  id: string
  content: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  resolutionNote?: string
  createdAt: string
  resolvedAt?: string
  auction: {
    id: string
    currentPrice: number
    basePrice: number
    player: { id: string; name: string; team: string; position: string }
    winner?: { user: { username: string } }
    bids: Array<{ amount: number; bidder: { user: { username: string } } }>
  }
  member: { user: { username: string } }
  resolvedBy?: { user: { username: string } }
}

export interface PrizeHistoryItem {
  id: string
  teamName: string
  username: string
  adminUsername: string
  amount: number
  reason: string | null
  createdAt: string
}
