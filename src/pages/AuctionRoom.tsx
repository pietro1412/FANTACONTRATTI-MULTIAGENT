import { useState, useEffect, useCallback, useRef } from 'react'
import { auctionApi, playerApi, firstMarketApi, adminApi, contractApi } from '../services/api'
import { usePusherAuction } from '../services/pusher.client'
import { useServerTime } from '../hooks/useServerTime'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import haptic from '../utils/haptics'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS, POSITION_NAMES } from '../components/ui/PositionBadge'
import { ContractModifierModal } from '../components/ContractModifier'
/**
 * NUOVO COMPONENTE TIMER v2 - 24/01/2026
 * Per rollback: rimuovere questo import e ripristinare il vecchio timer inline
 * (cercare "OLD_TIMER_START" e "OLD_TIMER_END" nei commenti)
 */
import { AuctionTimer } from '../components/AuctionTimer'
/**
 * LAYOUT ASTA v2 - Layouts alternativi - 24/01/2026
 * Per rollback: rimuovere questi import e il selettore, mantenere solo layout classic
 */
import {
  AuctionLayoutSelector,
  useAuctionLayout,
  LayoutMobile,
  LayoutDesktop,
  LayoutPro
} from '../components/auction'
import type { AuctionLayout, ManagerData as LayoutManagerData } from '../components/auction/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface AuctionRoomProps {
  sessionId: string
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
  quotation: number
}

interface Bid {
  id: string
  amount: number
  placedAt: string
  bidder: {
    user: { username: string }
  }
}

interface Auction {
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

interface Membership {
  id: string
  role: string
  currentBudget: number
}

interface SessionInfo {
  id: string
  type: string
  currentRole: string | null
  currentPhase: string | null
  auctionTimerSeconds: number
  auctionMode?: string
}

interface MarketProgress {
  currentRole: string
  currentRoleName: string
  filledSlots: number
  totalSlots: number
  roleSequence: string[]
  slotLimits: { P: number; D: number; C: number; A: number }
}

interface PendingAcknowledgment {
  id: string
  player: Player
  winner: { id: string; username: string } | null
  finalPrice: number
  status: string
  userAcknowledged: boolean
  acknowledgedMembers: { id: string; username: string }[]
  pendingMembers: { id: string; username: string }[]
  totalMembers: number
  totalAcknowledged: number
  contractInfo?: {
    salary: number
    duration: number
    rescissionClause: number
  } | null
}

interface ReadyStatus {
  hasPendingNomination: boolean
  nominatorConfirmed: boolean
  player: Player | null
  nominatorId: string | null
  nominatorUsername: string
  readyMembers: { id: string; username: string }[]
  pendingMembers: { id: string; username: string }[]
  totalMembers: number
  readyCount: number
  userIsReady: boolean
  userIsNominator: boolean
}

interface AppealStatus {
  auctionId: string
  auctionStatus: string
  hasActiveAppeal: boolean
  appeal: {
    id: string
    status: string
    reason: string
    adminNotes: string | null
    submittedBy: { username: string }
  } | null
  player: Player | null
  winner: { username: string } | null
  finalPrice: number | null
  appealDecisionAcks: string[]
  resumeReadyMembers: string[]
  allMembers: { id: string; username: string }[]
  userHasAcked: boolean
  userIsReady: boolean
  allAcked: boolean
  allReady: boolean
}

interface RosterSlot {
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

interface MyRosterSlots {
  slots: {
    P: { filled: number; total: number; players: RosterSlot[] }
    D: { filled: number; total: number; players: RosterSlot[] }
    C: { filled: number; total: number; players: RosterSlot[] }
    A: { filled: number; total: number; players: RosterSlot[] }
  }
  currentRole: string
  budget: number
}

interface ManagerRosterPlayer {
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

interface ManagerData {
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

interface ManagersStatusData {
  managers: ManagerData[]
  currentTurnManager: ManagerData | null
  currentRole: string
  slotLimits: { P: number; D: number; C: number; A: number }
  myId: string
  allConnected?: boolean
}

interface FirstMarketStatus {
  currentRole: string
  currentTurnIndex: number
  currentNominator: { memberId: string; username: string; index: number } | null
  allCompletedCurrentRole: boolean
  memberStatus: Array<{
    memberId: string
    username: string
    teamName: string | null
    rosterByRole: { P: number; D: number; C: number; A: number }
    slotsNeeded: { P: number; D: number; C: number; A: number }
    isComplete: boolean
    isCurrentRoleComplete: boolean
  }>
  turnOrder: string[] | null
  roleSequence: string[]
  isUserTurn: boolean
}

// Sortable item component for drag & drop
function SortableManagerItem({ id, member, index }: { id: string; member: { username: string; teamName: string | null }; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isDragging
          ? 'bg-primary-900/50 border-primary-500 shadow-glow scale-105 z-50'
          : 'bg-surface-200 border-surface-50/20 hover:border-primary-500/40'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-primary-400 p-1"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-glow">
        {index + 1}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-gray-100">{member.username}</p>
        {member.teamName && (
          <p className="text-sm text-gray-400">{member.teamName}</p>
        )}
      </div>

      <div className="text-right text-sm text-gray-500">
        #{index + 1}
      </div>
    </div>
  )
}

// Alias for backward compatibility
const POSITION_COLORS = POSITION_GRADIENTS
const POSITION_BG = POSITION_FILTER_COLORS

export function AuctionRoom({ sessionId, leagueId, onNavigate }: AuctionRoomProps) {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [bidAmount, setBidAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [availableTeams, setAvailableTeams] = useState<Array<{ name: string; playerCount: number }>>([])
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [marketProgress, setMarketProgress] = useState<MarketProgress | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [timerSetting, setTimerSetting] = useState(30)

  // Server time synchronization for accurate timer display
  const { getRemainingSeconds, isCalibrating: isTimeSyncing, error: timeSyncError, offset: serverTimeOffset } = useServerTime()

  const [firstMarketStatus, setFirstMarketStatus] = useState<FirstMarketStatus | null>(null)
  const [turnOrderDraft, setTurnOrderDraft] = useState<string[]>([])

  const [readyStatus, setReadyStatus] = useState<ReadyStatus | null>(null)
  const [markingReady, setMarkingReady] = useState(false)

  const [pendingAck, setPendingAck] = useState<PendingAcknowledgment | null>(null)
  const pendingAckLockedRef = useRef<string | null>(null) // Holds auctionId when locally created
  const [prophecyContent, setProphecyContent] = useState('')
  const [ackSubmitting, setAckSubmitting] = useState(false)
  const [isAppealMode, setIsAppealMode] = useState(false)
  const [appealContent, setAppealContent] = useState('')

  const [myRosterSlots, setMyRosterSlots] = useState<MyRosterSlots | null>(null)
  const [managersStatus, setManagersStatus] = useState<ManagersStatusData | null>(null)
  const [selectedManager, setSelectedManager] = useState<ManagerData | null>(null)

  const [appealStatus, setAppealStatus] = useState<AppealStatus | null>(null)

  // Layout asta - Nuovo selettore layout 24/01/2026
  const [auctionLayout, setAuctionLayout] = useAuctionLayout()

  // Contract modification after winning auction
  interface ContractForModification {
    contractId: string
    rosterId: string
    playerId: string
    playerName: string
    playerTeam: string
    playerPosition: string
    salary: number
    duration: number
    initialSalary: number
    rescissionClause: number
  }
  const [pendingContractModification, setPendingContractModification] = useState<ContractForModification | null>(null)

  // Pusher real-time updates - update state directly from Pusher data (no HTTP calls)
  const { connectionStatus, isConnected } = usePusherAuction(sessionId, {
    onBidPlaced: (data) => {
      console.log('[Pusher] Bid placed:', data)
      // Update auction state directly with Pusher data - INSTANT!
      setAuction(prev => {
        if (!prev || prev.id !== data.auctionId) return prev

        // Create new bid object from Pusher data
        const newBid: Bid = {
          id: `pusher-${Date.now()}`,
          amount: data.amount,
          placedAt: data.timestamp,
          bidder: {
            user: { username: data.memberName }
          }
        }

        return {
          ...prev,
          currentPrice: data.amount,
          bids: [newBid, ...prev.bids],
          // Update timer immediately from Pusher data - NO DELAY!
          timerExpiresAt: data.timerExpiresAt,
          timerSeconds: data.timerSeconds
        }
      })
      // Note: loadManagersStatus() removed - polling handles budget updates
      // This eliminates API call delay after each bid
    },
    onNominationPending: (data) => {
      console.log('[Pusher] Nomination pending:', data)
      // Update ready status directly
      setReadyStatus(prev => prev ? {
        ...prev,
        hasPendingNomination: true,
        player: {
          id: data.playerId,
          name: data.playerName,
          team: '',
          position: data.playerRole,
          quotation: data.startingPrice
        },
        nominatorId: data.nominatorId,
        nominatorUsername: data.nominatorName
      } : null)
      loadFirstMarketStatus()
    },
    onNominationConfirmed: (data) => {
      console.log('[Pusher] Nomination confirmed:', data)
      // Nomination confirmed - load current auction to get full auction data
      loadCurrentAuction()
      loadReadyStatus()
    },
    onMemberReady: (data) => {
      console.log('[Pusher] Member ready:', data)
      // Update ready status directly with full lists from Pusher
      setReadyStatus(prev => prev ? {
        ...prev,
        readyMembers: data.readyMembers || prev.readyMembers,
        pendingMembers: data.pendingMembers || prev.pendingMembers,
        totalMembers: data.totalMembers
      } : null)
    },
    onAuctionStarted: (data) => {
      console.log('[Pusher] Auction started:', data)
      loadCurrentAuction()
      loadReadyStatus()
    },
    onAuctionClosed: (data) => {
      console.log('[Pusher] Auction closed:', data)
      // Update auction state to show winner immediately
      setAuction(prev => {
        if (!prev || prev.id !== data.auctionId) return prev
        return {
          ...prev,
          status: 'CLOSED',
          winner: data.winnerId ? { user: { username: data.winnerName || '' } } : undefined,
          currentPrice: data.finalPrice || prev.currentPrice
        }
      })
      loadPendingAcknowledgment()
      loadFirstMarketStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    },
  })

  const isAdmin = membership?.role === 'ADMIN'
  const isPrimoMercato = sessionInfo?.type === 'PRIMO_MERCATO'
  const hasTurnOrder = firstMarketStatus?.turnOrder && firstMarketStatus.turnOrder.length > 0

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Close team dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (teamDropdownOpen && !target.closest('[data-team-dropdown]')) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [teamDropdownOpen])

  const loadCurrentAuction = useCallback(async (): Promise<boolean> => {
    const result = await auctionApi.getCurrentAuction(sessionId)
    let auctionJustCompleted = false
    if (result.success && result.data) {
      const data = result.data as {
        auction: Auction | null;
        userMembership: Membership;
        session: SessionInfo;
        marketProgress: MarketProgress | null;
        justCompleted?: { playerId: string; playerName: string; winnerId: string; winnerName: string; amount: number } | null
      }
      if (data.auction) {
        const newMinBid = data.auction.currentPrice + 1
        setBidAmount(prev => (parseInt(prev) || 0) <= data.auction!.currentPrice ? String(newMinBid) : prev)
      } else {
        setBidAmount('')
      }
      setAuction(data.auction)
      setMembership(data.userMembership)
      setSessionInfo(data.session)
      setMarketProgress(data.marketProgress)
      if (data.session?.auctionTimerSeconds) setTimerSetting(data.session.auctionTimerSeconds)
      if (data.session?.type === 'PRIMO_MERCATO' && data.marketProgress?.currentRole) {
        setSelectedPosition(data.marketProgress.currentRole)
      }
      // If auction just completed, signal to immediately load pending acknowledgment
      if (data.justCompleted) {
        auctionJustCompleted = true
      }
    }
    setIsLoading(false)
    return auctionJustCompleted
  }, [sessionId])

  const loadFirstMarketStatus = useCallback(async () => {
    const result = await firstMarketApi.getStatus(sessionId)
    if (result.success && result.data) {
      const data = result.data as FirstMarketStatus
      setFirstMarketStatus(data)
      if (!data.turnOrder && data.memberStatus.length > 0 && turnOrderDraft.length === 0) {
        setTurnOrderDraft(data.memberStatus.map(m => m.memberId))
      }
    }
  }, [sessionId, turnOrderDraft.length])

  const loadPendingAcknowledgment = useCallback(async () => {
    const result = await auctionApi.getPendingAcknowledgment(sessionId)
    if (result.success && result.data) {
      const serverPendingAck = (result.data as { pendingAuction: PendingAcknowledgment | null }).pendingAuction

      // If we have a locked local pendingAck, only update if server has same auction or valid data
      if (pendingAckLockedRef.current) {
        if (serverPendingAck && serverPendingAck.id === pendingAckLockedRef.current) {
          // Server confirmed our local auction - unlock and update with full data
          pendingAckLockedRef.current = null
          setPendingAck(serverPendingAck)
        }
        // If server returns null or different auction, keep our locked state (don't update)
      } else {
        // No lock - update normally
        setPendingAck(serverPendingAck)
      }
    }
  }, [sessionId])

  const loadReadyStatus = useCallback(async () => {
    const result = await auctionApi.getReadyStatus(sessionId)
    if (result.success && result.data) setReadyStatus(result.data as ReadyStatus)
  }, [sessionId])

  const loadMyRosterSlots = useCallback(async () => {
    const result = await auctionApi.getMyRosterSlots(sessionId)
    if (result.success && result.data) setMyRosterSlots(result.data as MyRosterSlots)
  }, [sessionId])

  const loadManagersStatus = useCallback(async () => {
    const result = await auctionApi.getManagersStatus(sessionId)
    if (result.success && result.data) setManagersStatus(result.data as ManagersStatusData)
  }, [sessionId])

  const loadAppealStatus = useCallback(async () => {
    // Carica lo stato del ricorso se c'è un'asta pendente o con appeal attivo
    if (pendingAck?.id) {
      const result = await auctionApi.getAppealStatus(pendingAck.id)
      if (result.success && result.data) {
        setAppealStatus(result.data as AppealStatus)
      } else {
        setAppealStatus(null)
      }
    } else {
      setAppealStatus(null)
    }
  }, [pendingAck?.id])

  const loadPlayers = useCallback(async () => {
    const filters: { available: boolean; leagueId: string; position?: string; search?: string; team?: string } = { available: true, leagueId }
    if (selectedPosition) filters.position = selectedPosition
    if (searchQuery) filters.search = searchQuery
    if (selectedTeam) filters.team = selectedTeam
    const result = await playerApi.getAll(filters)
    if (result.success && result.data) {
      // Ordina alfabeticamente per nome
      const sortedPlayers = (result.data as Player[]).sort((a, b) => a.name.localeCompare(b.name))
      setPlayers(sortedPlayers)
    }
  }, [leagueId, selectedPosition, searchQuery, selectedTeam])

  const loadTeams = useCallback(async () => {
    const result = await playerApi.getTeams()
    if (result.success && result.data) {
      setAvailableTeams(result.data as Array<{ name: string; playerCount: number }>)
    }
  }, [])

  // Timer countdown - when hits 0, immediately refresh data
  useEffect(() => {
    if (!auction?.timerExpiresAt) {
      setTimeLeft(null)
      return
    }
    let hasTriggeredZero = false
    let lastWarningAt: number | null = null
    const updateTimer = () => {
      // Use server-synchronized time for accurate countdown
      const remaining = getRemainingSeconds(auction.timerExpiresAt)
      setTimeLeft(remaining)

      // Haptic feedback for timer warnings (only trigger once per threshold)
      if (remaining <= 5 && remaining > 0 && lastWarningAt !== remaining) {
        lastWarningAt = remaining
        haptic.warning() // Rapid vibration for danger zone
      } else if (remaining === 10 && lastWarningAt !== remaining) {
        lastWarningAt = remaining
        haptic.light() // Light vibration for warning zone
      }

      // When timer hits 0, IMMEDIATELY show the acknowledgment modal with current data
      if (remaining === 0 && !hasTriggeredZero) {
        hasTriggeredZero = true

        // Create immediate pendingAck from current auction data - NO API WAIT!
        const currentAuction = auction // capture current state
        if (currentAuction) {
          const winningBid = currentAuction.bids[0]
          const immediatePendingAck: PendingAcknowledgment = {
            id: currentAuction.id,
            player: currentAuction.player,
            winner: winningBid ? {
              id: winningBid.bidder.user.username, // temporary, will be updated
              username: winningBid.bidder.user.username,
            } : null,
            finalPrice: currentAuction.currentPrice,
            status: winningBid ? 'COMPLETED' : 'NO_BIDS',
            userAcknowledged: false,
            acknowledgedMembers: [],
            pendingMembers: [],
            totalMembers: managersStatus?.managers.length || 1,
            totalAcknowledged: 0,
          }
          // Lock this auction so polling doesn't overwrite it
          pendingAckLockedRef.current = currentAuction.id
          setPendingAck(immediatePendingAck)
          setAuction(null) // Clear auction immediately
        }

        // Sync with backend in background (just to close the auction server-side)
        // Then fetch full data including contract info after a short delay
        loadCurrentAuction().then(() => {
          // Small delay to ensure contract is created on server
          setTimeout(() => loadPendingAcknowledgment(), 500)
        })
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [auction?.timerExpiresAt, loadCurrentAuction, loadPendingAcknowledgment, getRemainingSeconds])

  useEffect(() => {
    loadCurrentAuction()
    loadFirstMarketStatus()
    loadPendingAcknowledgment()
    loadReadyStatus()
    loadMyRosterSlots()
    loadManagersStatus()
    loadTeams()
    // Polling at 1.5s as fallback - real-time updates come from Pusher
    // Reduced from 3s for faster sync when Pusher events are missed
    const interval = setInterval(() => {
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadPendingAcknowledgment()
      loadReadyStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    }, 1500)
    return () => clearInterval(interval)
  }, [loadCurrentAuction, loadFirstMarketStatus, loadPendingAcknowledgment, loadReadyStatus, loadMyRosterSlots, loadManagersStatus, loadTeams])

  // Carica stato ricorso quando cambia pendingAck
  useEffect(() => {
    loadAppealStatus()
    // Polling at 1.5s as fallback - real-time updates come from Pusher
    const interval = setInterval(loadAppealStatus, 1500)
    return () => clearInterval(interval)
  }, [loadAppealStatus])

  useEffect(() => {
    // Wait until sessionInfo is loaded to know the session type
    if (!sessionInfo) return

    if (sessionInfo.type !== 'PRIMO_MERCATO') {
      // Not PRIMO_MERCATO: load all players (no position filter required)
      loadPlayers()
    } else if (selectedPosition) {
      // PRIMO_MERCATO: only load when we have the position filter from currentRole
      loadPlayers()
    }
  }, [selectedPosition, searchQuery, selectedTeam, loadPlayers, sessionInfo])

  // Send heartbeat every 3 seconds to track connection status
  useEffect(() => {
    if (!managersStatus?.myId) return

    const sendHeartbeat = async () => {
      try {
        await auctionApi.sendHeartbeat(sessionId, managersStatus.myId)
      } catch (err) {
        console.error('Heartbeat error:', err)
      }
    }

    // Send immediately on mount
    sendHeartbeat()

    // Then send every 3 seconds
    const interval = setInterval(sendHeartbeat, 3000)

    return () => clearInterval(interval)
  }, [sessionId, managersStatus?.myId])

  // Drag end handler
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTurnOrderDraft((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  async function handleSetTurnOrder() {
    if (turnOrderDraft.length === 0) return
    setError('')
    const result = await firstMarketApi.setTurnOrder(sessionId, turnOrderDraft)
    if (result.success) {
      setSuccessMessage('Ordine turni impostato!')
      loadFirstMarketStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleNominatePlayer(playerId: string) {
    setError('')
    setSuccessMessage('')
    const result = await auctionApi.setPendingNomination(sessionId, playerId)
    if (result.success) {
      setSuccessMessage('Giocatore selezionato! Conferma o cambia.')
      loadReadyStatus()
      loadPlayers()
    } else {
      setError(result.message || 'Errore nella nomina')
    }
  }

  async function handleConfirmNomination() {
    setError('')
    setMarkingReady(true)
    const result = await auctionApi.confirmNomination(sessionId)
    setMarkingReady(false)
    if (result.success) {
      setSuccessMessage('Scelta confermata!')
      loadReadyStatus()
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleCancelNomination() {
    setError('')
    const result = await auctionApi.cancelNomination(sessionId)
    if (result.success) {
      setSuccessMessage('Nomination annullata, scegli un altro giocatore.')
      loadReadyStatus()
      loadPlayers()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleMarkReady() {
    setError('')
    setMarkingReady(true)
    const result = await auctionApi.markReady(sessionId)
    setMarkingReady(false)
    if (result.success) {
      loadReadyStatus()
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllReady() {
    const result = await auctionApi.forceAllReady(sessionId)
    if (result.success) {
      setSuccessMessage('Asta avviata!')
      loadReadyStatus()
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleBotBid() {
    if (!auction) return
    const result = await auctionApi.triggerBotBid(auction.id)
    if (result.success) {
      const data = result.data as { hasBotBid: boolean; winningBot: string | null; newCurrentPrice: number }
      if (data.hasBotBid) {
        setSuccessMessage(`${data.winningBot} ha offerto ${data.newCurrentPrice}!`)
      } else {
        setSuccessMessage('Nessun bot ha fatto offerte')
      }
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleBotNominate() {
    setError('')
    const result = await auctionApi.botNominate(sessionId)
    if (result.success) {
      const data = result.data as { player?: { name: string } }
      setSuccessMessage(`Bot ha scelto ${data.player?.name}`)
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadReadyStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleBotConfirmNomination() {
    setError('')
    const result = await auctionApi.botConfirmNomination(sessionId)
    if (result.success) {
      const data = result.data as { player?: { name: string } }
      setSuccessMessage(`Scelta confermata: ${data.player?.name}`)
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadReadyStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAcknowledgeAll() {
    const result = await auctionApi.forceAcknowledgeAll(sessionId)
    if (result.success) {
      setSuccessMessage('Conferme forzate!')
      loadPendingAcknowledgment()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleSimulateAppeal() {
    const result = await auctionApi.simulateAppeal(leagueId, pendingAck?.id)
    if (result.success) {
      setSuccessMessage('Ricorso simulato! Vai nel pannello Admin per gestirlo.')
    } else {
      setError(result.message || 'Errore nella simulazione')
    }
  }

  async function handleAcknowledgeAppealDecision() {
    if (!appealStatus?.auctionId) return
    setAckSubmitting(true)
    const result = await auctionApi.acknowledgeAppealDecision(appealStatus.auctionId)
    setAckSubmitting(false)
    if (result.success) {
      loadAppealStatus()
      loadPendingAcknowledgment()
    } else {
      setError(result.message || 'Errore nella conferma')
    }
  }

  async function handleReadyToResume() {
    if (!appealStatus?.auctionId) return
    setMarkingReady(true)
    const result = await auctionApi.markReadyToResume(appealStatus.auctionId)
    setMarkingReady(false)
    if (result.success) {
      loadAppealStatus()
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllAppealAcks() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllAppealAcks(appealStatus.auctionId)
    if (result.success) {
      setSuccessMessage('Conferme forzate!')
      loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllReadyResume() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllReadyResume(appealStatus.auctionId)
    if (result.success) {
      setSuccessMessage('Pronti forzati!')
      loadAppealStatus()
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleResetFirstMarket() {
    if (!confirm('Sei sicuro di voler resettare il Primo Mercato? Tutti i dati verranno cancellati!')) return
    const result = await adminApi.resetFirstMarket(leagueId)
    if (result.success) {
      setSuccessMessage('Primo Mercato resettato!')
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadMyRosterSlots()
      loadManagersStatus()
      loadPlayers()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handlePauseAuction() {
    setError('')
    const res = await auctionApi.pauseAuction(leagueId)
    if (res.success) {
      loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
  }

  async function handleResumeAuction() {
    setError('')
    const res = await auctionApi.resumeAuction(leagueId)
    if (res.success) {
      loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
  }

  async function handleCompleteAllSlots() {
    if (!sessionId) return
    if (!confirm('Sei sicuro di voler completare l\'asta riempiendo tutti gli slot di tutti i Direttori Generali?')) return
    const result = await auctionApi.completeAllSlots(sessionId)
    if (result.success) {
      const data = result.data as { totalPlayersAdded: number; totalContractsCreated: number; memberResults: string[] }
      setSuccessMessage(`Asta completata! ${data.totalPlayersAdded} giocatori, ${data.totalContractsCreated} contratti.`)
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadMyRosterSlots()
      loadManagersStatus()
      loadPlayers()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handlePlaceBid() {
    if (!auction) return
    setError('')
    const amount = parseInt(bidAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Importo non valido')
      haptic.error()
      return
    }
    const result = await auctionApi.placeBid(auction.id, amount)
    if (result.success) {
      setSuccessMessage(`Offerta di ${amount} registrata!`)
      setBidAmount(String(amount + 1))
      haptic.bid() // Haptic feedback for successful bid
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
      haptic.error()
    }
  }

  async function handleCloseAuction() {
    if (!auction) return
    const result = await auctionApi.closeAuction(auction.id)
    if (result.success) {
      const data = result.data as { winner?: { username: string; amount: number }; player: Player }
      setSuccessMessage(data.winner ? `${data.player.name} a ${data.winner.username} per ${data.winner.amount}!` : 'Asta chiusa')
      setTimeout(() => { loadCurrentAuction(); loadPlayers(); loadMyRosterSlots(); loadManagersStatus() }, 2000)
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleUpdateTimer(seconds?: number) {
    const value = seconds ?? timerSetting
    const result = await auctionApi.updateSessionTimer(sessionId, value)
    if (result.success) {
      setTimerSetting(value)
      setSuccessMessage(`Timer: ${value}s`)
    }
    else setError(result.message || 'Errore')
  }

  async function handleAcknowledge(withProphecy: boolean, isAppeal: boolean = false) {
    if (!pendingAck) return
    setAckSubmitting(true)

    if (isAppeal && appealContent.trim()) {
      // Invia ricorso tramite endpoint dedicato
      const appealResult = await auctionApi.submitAppeal(pendingAck.id, appealContent.trim())
      if (!appealResult.success) {
        setError(appealResult.message || 'Errore nell\'invio del ricorso')
        setAckSubmitting(false)
        return
      }
      setSuccessMessage('Ricorso inviato! L\'admin della lega valuterà la tua richiesta.')
    }

    // Conferma comunque la visione dell'asta (anche con ricorso)
    const prophecy = withProphecy ? prophecyContent.trim() : undefined
    const result = await auctionApi.acknowledgeAuction(pendingAck.id, prophecy)
    setAckSubmitting(false)
    if (result.success) {
      setProphecyContent('')
      setAppealContent('')
      setIsAppealMode(false)

      // Check if there's contract info for modification (winner only)
      const data = result.data as { winnerContractInfo?: ContractForModification } | undefined
      if (data?.winnerContractInfo) {
        setPendingContractModification(data.winnerContractInfo)
      }

      loadPendingAcknowledgment()
      loadPlayers()
      loadMyRosterSlots()
      loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  // ========== CONTRACT MODIFICATION (Post-Primo Mercato Win) ==========

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!pendingContractModification?.contractId) return

    const res = await contractApi.modify(pendingContractModification.contractId, newSalary, newDuration)
    if (res.success) {
      setPendingContractModification(null)
      loadPlayers()
      loadMyRosterSlots()
    } else {
      setError(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    setPendingContractModification(null)
  }

  const isMyTurn = firstMarketStatus?.isUserTurn || false
  const currentTurnManager = firstMarketStatus?.currentNominator

  function getTimerClass() {
    if (timeLeft === null) return 'text-gray-500'
    if (timeLeft <= 5) return 'timer-value timer-value-danger'
    if (timeLeft <= 10) return 'timer-value timer-value-warning'
    return 'timer-value text-secondary-400'
  }

  function getTimerContainerClass() {
    if (timeLeft === null) return 'timer-container'
    if (timeLeft <= 5) return 'timer-container timer-container-danger'
    if (timeLeft <= 10) return 'timer-container timer-container-warning'
    return 'timer-container'
  }

  // Check if current user is winning the auction
  const currentUsername = managersStatus?.managers.find(m => m.id === managersStatus?.myId)?.username
  const isUserWinning = auction?.bids?.[0]?.bidder?.user?.username === currentUsername

  // Check if timer is expired
  const isTimerExpired = timeLeft !== null && timeLeft <= 0

  // Keyboard shortcuts for auction
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        // Only handle Enter inside bid input
        if (e.key === 'Enter' && target.getAttribute('data-bid-input')) {
          e.preventDefault()
          handlePlaceBid()
        }
        return
      }

      if (!auction) return

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handlePlaceBid()
          break
        case '+':
        case '=':
          e.preventDefault()
          setBidAmount(prev => String((parseInt(prev) || auction.currentPrice) + 1))
          break
        case '-':
          e.preventDefault()
          setBidAmount(prev => {
            const current = parseInt(prev) || auction.currentPrice + 1
            return String(Math.max(auction.currentPrice + 1, current - 1))
          })
          break
        case 'Escape':
          e.preventDefault()
          setBidAmount('')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [auction, bidAmount])

  // Calculate budget percentage for progress bars
  const getBudgetPercentage = (current: number, initial: number = 500) => {
    return Math.min(100, Math.max(0, (current / initial) * 100))
  }

  const getBudgetBarClass = (percentage: number) => {
    if (percentage <= 20) return 'budget-progress-bar budget-progress-bar-critical'
    if (percentage <= 40) return 'budget-progress-bar budget-progress-bar-low'
    return 'budget-progress-bar'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento sala asta...</p>
        </div>
      </div>
    )
  }

  // ==================== SETUP: Turn Order with Drag & Drop ====================
  if (isPrimoMercato && !hasTurnOrder && isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300">
        <header className="fm-header py-6">
          <div className="max-w-2xl mx-auto px-4">
            <button onClick={() => onNavigate('leagueDetail', { leagueId })} className="text-primary-400 hover:text-primary-300 text-sm mb-2 flex items-center gap-1">
              <span>←</span> Torna alla lega
            </button>
            <h1 className="text-3xl font-bold text-white">Ordine di Chiamata</h1>
            <p className="text-gray-400 mt-1">Trascina i Direttori Generali per definire l'ordine dei turni</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg mb-6">{error}</div>}
          {successMessage && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-4 rounded-lg mb-6">{successMessage}</div>}

          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                <span className="text-xl">👔</span>
              </div>
              <div>
                <h2 className="font-bold text-white">Direttori Generali in Sala</h2>
                <p className="text-sm text-gray-400">{turnOrderDraft.length} partecipanti</p>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={turnOrderDraft} strategy={verticalListSortingStrategy}>
                  {turnOrderDraft.map((memberId, index) => {
                    const member = firstMarketStatus?.memberStatus.find(m => m.memberId === memberId)
                    if (!member) return null
                    return <SortableManagerItem key={memberId} id={memberId} member={member} index={index} />
                  })}
                </SortableContext>
              </DndContext>
            </div>

            <div className="p-4 border-t border-surface-50/20">
              <Button onClick={handleSetTurnOrder} className="w-full btn-accent py-3 text-lg font-bold">
                Conferma e Inizia Aste
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Non-admin waiting
  if (isPrimoMercato && !hasTurnOrder && !isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="bg-surface-200 rounded-xl p-8 text-center max-w-md border border-surface-50/20">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Sala Riunioni</h2>
          <p className="text-gray-400">L'admin sta definendo l'ordine dei turni...</p>
        </div>
      </div>
    )
  }

  // ==================== MAIN AUCTION ROOM ====================
  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="auction" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Auction Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center shadow-glow">
                <span className="text-2xl">🔨</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Sala Asta</h1>
                <div className="flex items-center gap-2">
                  <p className="text-gray-400 text-sm">Primo Mercato</p>
                  {sessionInfo?.auctionMode === 'IN_PRESENCE' && (
                    <span className="text-xs bg-accent-500/20 text-accent-400 px-2 py-0.5 rounded-full">In Presenza</span>
                  )}
                  {/* Pusher connection status */}
                  <div className={`text-xs ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                    {isConnected ? '🟢 Real-time' : '🟡 ' + connectionStatus}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Layout Selector Compatto - Sempre visibile per permettere cambio layout */}
              <AuctionLayoutSelector
                currentLayout={auctionLayout}
                onLayoutChange={setAuctionLayout}
                compact={true}
              />
              <div className="text-right bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
                <p className="text-3xl font-bold gradient-text-gold">{membership?.currentBudget || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Turn Banner */}
        {currentTurnManager && (
          <div className={`px-4 py-3 ${isMyTurn ? 'bg-accent-500/20 border-y border-accent-500/40' : 'bg-primary-500/10 border-y border-primary-500/30'}`}>
            <div className="max-w-full mx-auto flex items-center justify-center gap-3">
              {isMyTurn ? (
                <>
                  <span className="text-2xl">🎯</span>
                  <span className="text-lg font-bold text-accent-400 text-glow-gold">È IL TUO TURNO!</span>
                  <span className="text-2xl">🎯</span>
                </>
              ) : (
                <span className="text-gray-300">Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {isPrimoMercato && marketProgress && (
          <div className="bg-dark-400/50 px-4 py-3">
            <div className="max-w-full mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                {marketProgress.roleSequence.map((role) => (
                  <span key={role} className={`px-3 py-1 rounded-full text-xs font-bold border ${role === marketProgress.currentRole ? POSITION_BG[role] : 'bg-surface-300 text-gray-500 border-surface-50/20'}`}>
                    {POSITION_NAMES[role]}
                  </span>
                ))}
              </div>
              <div className="text-sm flex items-center gap-4">
                <div>
                  <span className="text-gray-400">{POSITION_NAMES[marketProgress.currentRole]}: </span>
                  <span className="font-bold text-white">{marketProgress.filledSlots}/{marketProgress.totalSlots}</span>
                </div>
                <div className="text-gray-500">
                  (slot/DG: {marketProgress.slotLimits[marketProgress.currentRole as keyof typeof marketProgress.slotLimits]})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className={`max-w-full mx-auto px-4 py-4 lg:py-6 ${auction ? 'auction-room-mobile' : ''}`}>
        {/* Error/Success Messages - Fixed on mobile */}
        <div className="space-y-2 mb-4">
          {error && (
            <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}
        </div>

        {/*
         * =======================================================
         * LAYOUT SELECTOR v2 - Layout alternativi asta - 24/01/2026
         * =======================================================
         * Per ROLLBACK: rimuovere questo blocco e il wrapper condizionale,
         * lasciare solo il grid classico sotto
         * =======================================================
         */}
        {/* Layout Pro - Completo con obiettivi, ready check, acknowledgment */}
        {auctionLayout === 'pro' && (
          <div className="mb-4">
            <LayoutPro
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              readyStatus={readyStatus as any}
              onMarkReady={handleMarkReady}
              markingReady={markingReady}
              pendingAck={pendingAck as any}
              onAcknowledge={() => handleAcknowledge(false)}
              ackSubmitting={ackSubmitting}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Layout Mobile - Card stack con tab, touch-friendly */}
        {auctionLayout === 'mobile' && (
          <div className="mb-4">
            <LayoutMobile
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Layout Desktop - Best mix responsive (default) */}
        {auctionLayout === 'desktop' && (
          <div className="mb-4">
            <LayoutDesktop
              auction={auction}
              timeLeft={timeLeft}
              timerSetting={timerSetting}
              isTimerExpired={isTimerExpired}
              membership={membership}
              isAdmin={isAdmin}
              isMyTurn={isMyTurn}
              isUserWinning={isUserWinning}
              currentUsername={currentUsername}
              managersStatus={managersStatus as any}
              currentTurnManager={currentTurnManager}
              myRosterSlots={myRosterSlots as any}
              marketProgress={marketProgress}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              onPlaceBid={handlePlaceBid}
              isConnected={isConnected}
              connectionStatus={connectionStatus}
              onSelectManager={(m: LayoutManagerData) => setSelectedManager(m as any)}
              onCloseAuction={handleCloseAuction}
              sessionId={sessionId}
              players={players}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNominatePlayer={handleNominatePlayer}
              onUpdateTimer={handleUpdateTimer}
              onBotNominate={handleBotNominate}
              onBotConfirmNomination={handleBotConfirmNomination}
              onBotBid={handleBotBid}
              onForceAllReady={handleForceAllReady}
              onForceAcknowledgeAll={handleForceAcknowledgeAll}
              onCompleteAllSlots={handleCompleteAllSlots}
              onResetFirstMarket={handleResetFirstMarket}
            />
          </div>
        )}

        {/* Mobile-first grid layout - Classic Layout (nascosto quando un layout consolidato è selezionato) */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${auctionLayout !== 'classic' && auction ? 'hidden' : ''}`}>
          {/* LEFT: My Roster - Hidden on mobile during active auction, collapsible */}
          <div className={`lg:col-span-3 space-y-4 ${auction ? 'hidden lg:block' : ''}`}>
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-3 border-b border-surface-50/20 flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h3 className="font-bold text-white">La Mia Rosa</h3>
              </div>
              {myRosterSlots && (
                <div className="divide-y divide-surface-50/10">
                  {(['P', 'D', 'C', 'A'] as const).map(pos => {
                    const slot = myRosterSlots.slots[pos]
                    const isCurrent = myRosterSlots.currentRole === pos
                    return (
                      <div key={pos} className={`p-2 ${isCurrent ? 'bg-primary-500/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-xs font-bold text-white`}>{pos}</span>
                            <span className="text-sm text-gray-300">{POSITION_NAMES[pos]}</span>
                          </div>
                          <span className={`text-sm font-bold ${slot.filled >= slot.total ? 'text-secondary-400' : 'text-gray-500'}`}>{slot.filled}/{slot.total}</span>
                        </div>
                        {slot.players.length > 0 && (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 text-[10px] uppercase">
                                <th className="text-left font-medium pb-1">Giocatore</th>
                                <th className="text-center font-medium pb-1 w-12">Prezzo</th>
                                <th className="text-center font-medium pb-1 w-10">Ing.</th>
                                <th className="text-center font-medium pb-1 w-8">Dur.</th>
                                <th className="text-center font-medium pb-1 w-12">Claus.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {slot.players.map(p => (
                                <tr key={p.id} className="border-t border-surface-50/10">
                                  <td className="py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-4 h-4 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                        <img src={getTeamLogo(p.playerTeam)} alt={p.playerTeam} className="w-3 h-3 object-contain" />
                                      </div>
                                      <span className="text-gray-200 truncate">{p.playerName}</span>
                                    </div>
                                  </td>
                                  <td className="text-center text-accent-400 font-bold">{p.acquisitionPrice}</td>
                                  <td className="text-center text-white">{p.contract?.salary ?? '-'}</td>
                                  <td className="text-center text-white">{p.contract?.duration ?? '-'}</td>
                                  <td className="text-center text-primary-400">{p.contract?.rescissionClause ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {slot.players.length === 0 && (
                          <p className="text-xs text-gray-600 italic ml-8">Nessun giocatore</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-3 border-b border-surface-50/20">
                  <h3 className="font-bold text-white text-sm">Controlli Admin</h3>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Timer Asta</p>
                    <div className="flex flex-wrap gap-1">
                      {[5, 10, 15, 20, 25, 30, 45, 60].map(sec => (
                        <button
                          key={sec}
                          onClick={() => handleUpdateTimer(sec)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            timerSetting === sec
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-300 text-gray-400 hover:bg-surface-50/20 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Pause / Resume */}
                  {auction && (
                    <div className="pt-2 border-t border-surface-50/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePauseAuction}
                        className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
                      >
                        Pausa Asta
                      </Button>
                    </div>
                  )}
                  {!auction && firstMarketStatus?.currentPhase === 'PAUSED' && (
                    <div className="pt-2 border-t border-surface-50/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResumeAuction}
                        className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10"
                      >
                        Riprendi Asta
                      </Button>
                    </div>
                  )}
                  <div className="pt-2 border-t border-surface-50/20 space-y-2">
                    <p className="text-xs text-accent-500 font-bold uppercase">Test Mode</p>
                    <Button size="sm" variant="outline" onClick={handleBotNominate} className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10">
                      🎯 Simula Scelta Giocatore
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBotConfirmNomination} className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10">
                      ✅ Simula Conferma Scelta
                    </Button>
                    {auction && (
                      <Button size="sm" variant="outline" onClick={handleBotBid} className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10">
                        💰 Simula Offerta Bot
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleForceAllReady} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Tutti Pronti</Button>
                    <Button size="sm" variant="outline" onClick={handleForceAcknowledgeAll} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Conferme</Button>
                    <Button size="sm" variant="outline" onClick={handleCompleteAllSlots} className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10">
                      ✅ Completa Tutti Slot
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleResetFirstMarket} className="w-full text-xs">Reset Asta</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Auction - Full width on mobile, primary focus */}
          <div className="lg:col-span-5 space-y-4 order-first lg:order-none">
            {/* Ready Check */}
            {readyStatus?.hasPendingNomination && !auction && (
              <div className="bg-surface-200 rounded-xl border-2 border-accent-500/50 overflow-hidden animate-pulse-slow">
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">{readyStatus.userIsNominator && !readyStatus.nominatorConfirmed ? '🎯' : '⏳'}</div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed
                      ? 'Conferma la tua scelta'
                      : `${readyStatus.nominatorUsername} ha chiamato`}
                  </h2>
                  {readyStatus.player && (
                    <div className="inline-flex items-center gap-3 bg-surface-300 rounded-lg p-4 mb-4">
                      <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${POSITION_COLORS[readyStatus.player.position]} flex items-center justify-center text-white font-bold text-lg`}>{readyStatus.player.position}</span>
                      <div className="w-10 h-10 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                        <img
                          src={getTeamLogo(readyStatus.player.team)}
                          alt={readyStatus.player.team}
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-xl text-white">{readyStatus.player.name}</p>
                        <p className="text-gray-400">{readyStatus.player.team}</p>
                      </div>
                    </div>
                  )}

                  {/* Nominator: Confirm/Cancel buttons (before confirmation) */}
                  {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <div className="flex gap-3 justify-center">
                        <Button onClick={handleConfirmNomination} disabled={markingReady} className="btn-accent px-8 py-3 text-lg font-bold">
                          {markingReady ? 'Attendi...' : '✓ CONFERMA'}
                        </Button>
                        <Button onClick={handleCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
                          Cambia
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">Dopo la conferma, gli altri Direttori Generali potranno dichiararsi pronti</p>
                    </div>
                  )}

                  {/* Nominator: After confirmation */}
                  {readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">DG pronti</span>
                          <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                        </div>
                        <div className="w-full bg-surface-400 rounded-full h-2">
                          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Lista DG pronti/non pronti */}
                      <div className="bg-surface-300/50 rounded-lg p-3 text-left">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-secondary-400 font-semibold mb-1">✓ Pronti</p>
                            {readyStatus.readyMembers.length > 0 ? (
                              readyStatus.readyMembers.map(m => (
                                <p key={m.id} className="text-gray-300">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                          <div>
                            <p className="text-amber-400 font-semibold mb-1">⏳ In attesa</p>
                            {readyStatus.pendingMembers.length > 0 ? (
                              readyStatus.pendingMembers.map(m => (
                                <p key={m.id} className="text-gray-400">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-secondary-400 font-medium">✓ Confermato - In attesa degli altri</p>
                      {isAdmin && <Button size="sm" variant="outline" onClick={handleForceAllReady} className="border-accent-500/50 text-accent-400">[TEST] Forza Tutti Pronti</Button>}
                    </div>
                  )}

                  {/* Non-nominator: Waiting for confirmation */}
                  {!readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
                    <div className="space-y-3">
                      <p className="text-amber-400 font-medium">⏳ Attendi che {readyStatus.nominatorUsername} confermi la scelta...</p>
                    </div>
                  )}

                  {/* Non-nominator: After confirmation, show SONO PRONTO or waiting */}
                  {!readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">DG pronti</span>
                          <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                        </div>
                        <div className="w-full bg-surface-400 rounded-full h-2">
                          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Lista DG pronti/non pronti */}
                      <div className="bg-surface-300/50 rounded-lg p-3 text-left mb-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-secondary-400 font-semibold mb-1">✓ Pronti</p>
                            {readyStatus.readyMembers.length > 0 ? (
                              readyStatus.readyMembers.map(m => (
                                <p key={m.id} className="text-gray-300">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                          <div>
                            <p className="text-amber-400 font-semibold mb-1">⏳ In attesa</p>
                            {readyStatus.pendingMembers.length > 0 ? (
                              readyStatus.pendingMembers.map(m => (
                                <p key={m.id} className="text-gray-400">{m.username}</p>
                              ))
                            ) : (
                              <p className="text-gray-500 italic">Nessuno</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {!readyStatus.userIsReady ? (
                        <Button onClick={handleMarkReady} disabled={markingReady} className="btn-accent px-12 py-3 text-lg font-bold">
                          {markingReady ? 'Attendi...' : 'SONO PRONTO'}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-secondary-400 font-medium">✓ Pronto - In attesa degli altri</p>
                          {isAdmin && <Button size="sm" variant="outline" onClick={handleForceAllReady} className="border-accent-500/50 text-accent-400">[TEST] Forza Tutti Pronti</Button>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Auction Card */}
            <div className={`bg-surface-200 rounded-xl border overflow-hidden ${auction ? 'auction-card-active' : 'border-surface-50/20'}`}>
              <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{auction ? '🔨' : '📭'}</span>
                  <h3 className="font-bold text-white">{auction ? 'Asta in Corso' : 'Nessuna Asta'}</h3>
                </div>
                {auction && isUserWinning && (
                  <div className="winning-indicator">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Stai vincendo!
                  </div>
                )}
              </div>

              <div className="p-4 lg:p-6">
                {auction ? (
                  <div className="space-y-4">
                    {/*
                     * =======================================================
                     * NUOVO TIMER v2 con Progress Bar - 24/01/2026
                     * =======================================================
                     * Per ROLLBACK alla versione precedente:
                     * 1. Commentare/rimuovere il blocco AuctionTimer qui sotto
                     * 2. Scommentare il blocco "OLD_TIMER_START" ... "OLD_TIMER_END"
                     * 3. Rimuovere l'import di AuctionTimer in cima al file
                     * =======================================================
                     */}
                    {auction.timerExpiresAt && (
                      <div className="relative sticky top-16 z-30 lg:relative lg:top-0">
                        <AuctionTimer
                          timeLeft={timeLeft}
                          totalSeconds={timerSetting}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/*
                     * OLD_TIMER_START - VERSIONE PRECEDENTE (commentata per rollback)
                     * Scommentare questo blocco se si vuole tornare al vecchio timer
                     *
                    {auction.timerExpiresAt && (
                      <div className={`${getTimerContainerClass()} relative sticky top-16 z-30 lg:relative lg:top-0`}>
                        {timeLeft !== null && timeLeft <= 5 && (
                          <div className="sound-indicator">
                            <span className="sr-only">Timer warning</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tempo rimanente</p>
                        <div className={getTimerClass()}>{timeLeft ?? '--'}</div>
                        <p className="text-gray-500 text-sm mt-1">secondi</p>
                        {timeLeft !== null && timeLeft <= 10 && timeLeft > 0 && (
                          <p className="text-xs text-amber-400 mt-2 animate-pulse">Affrettati!</p>
                        )}
                      </div>
                    )}
                     * OLD_TIMER_END
                     */}

                    {/*
                     * ENHANCED PLAYER DISPLAY v2 - Card Giocatore Stile Asta - 24/01/2026
                     * Per ROLLBACK: sostituire con il blocco OLD_PLAYER commentato sotto
                     */}
                    <div className="relative overflow-hidden rounded-2xl">
                      {/* Sfondo con gradient posizione */}
                      <div className={`absolute inset-0 opacity-30 ${POSITION_GRADIENTS[auction.player.position] || 'bg-gradient-to-br from-gray-600 to-gray-800'}`} />

                      {/* Pattern decorativo */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
                        }} />
                      </div>

                      <div className="relative text-center p-6 bg-gradient-to-br from-surface-300/90 to-surface-200/90 backdrop-blur-sm">
                        {/* Badge "ALL'ASTA" */}
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                          <span className="px-4 py-1 bg-accent-500 text-dark-900 text-xs font-black uppercase tracking-wider rounded-b-lg shadow-lg">
                            🔨 All'Asta
                          </span>
                        </div>

                        {/* Logo squadra grande con cornice */}
                        <div className="relative inline-block mt-4 mb-4">
                          <div className="absolute inset-0 bg-white rounded-2xl transform rotate-3 opacity-20" />
                          <div className="relative w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl border-4 border-white/30">
                            <img
                              src={getTeamLogo(auction.player.team)}
                              alt={auction.player.team}
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        </div>

                        {/* Nome giocatore con effetto */}
                        <h2 className="text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight">
                          {auction.player.name}
                        </h2>

                        {/* Team e posizione in riga */}
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <span className="text-gray-400 font-medium">{auction.player.team}</span>
                          <span className="text-gray-600">•</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${POSITION_BG[auction.player.position]}`}>
                            {POSITION_NAMES[auction.player.position]}
                          </span>
                        </div>

                        {/* Quotazione con stile enfatizzato */}
                        {auction.player.quotation && (
                          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-accent-500/20 via-accent-400/10 to-accent-500/20 rounded-xl border border-accent-500/30">
                            <div className="text-center">
                              <span className="text-xs text-gray-400 block uppercase tracking-wider">Quotazione Ufficiale</span>
                              <span className="text-2xl font-black text-accent-400">{auction.player.quotation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/*
                     * OLD_PLAYER_START - Versione precedente per rollback
                     *
                    <div className="text-center p-5 bg-gradient-to-br from-surface-300 to-surface-200 rounded-xl border border-surface-50/20">
                      <div className="flex items-center justify-center gap-4 mb-3">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${POSITION_BG[auction.player.position]}`}>
                          {POSITION_NAMES[auction.player.position]}
                        </span>
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 shadow-lg">
                          <img
                            src={getTeamLogo(auction.player.team)}
                            alt={auction.player.team}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                      </div>
                      <h2 className="text-3xl lg:text-4xl font-bold text-white mb-1">{auction.player.name}</h2>
                      <p className="text-lg text-gray-400">{auction.player.team}</p>
                      {auction.player.quotation && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-surface-400/50 rounded-full">
                          <span className="text-xs text-gray-400">Quotazione:</span>
                          <span className="text-sm font-bold text-accent-400">{auction.player.quotation}</span>
                        </div>
                      )}
                    </div>
                     * OLD_PLAYER_END
                     */}

                    {/*
                     * ENHANCED CURRENT PRICE v2 - Design Asta Enfatizzato - 24/01/2026
                     * Per ROLLBACK: sostituire con il blocco OLD_PRICE commentato sotto
                     */}
                    <div className="relative">
                      {/* Effetto sfondo animato */}
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 via-primary-500/10 to-primary-600/20 rounded-xl animate-pulse" />

                      <div className="relative rounded-xl p-6 text-center border-2 border-primary-500/30 bg-gradient-to-br from-surface-300 via-surface-200 to-surface-300 overflow-hidden">
                        {/* Decorazione angoli stile asta */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary-500/50 rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary-500/50 rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary-500/50 rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary-500/50 rounded-br-xl" />

                        {/* Label con icona martelletto */}
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary-400">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm text-primary-400 uppercase tracking-wider font-bold">
                            Offerta Corrente
                          </p>
                        </div>

                        {/* Prezzo grande con effetto glow */}
                        <div className="relative">
                          <p
                            className="text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-white to-primary-400 mb-2"
                            style={{
                              textShadow: '0 0 40px rgba(99, 102, 241, 0.5)',
                              animation: auction.bids.length > 0 ? 'none' : undefined
                            }}
                          >
                            {auction.currentPrice}
                          </p>
                          {/* Indicatore crediti */}
                          <span className="absolute -top-2 -right-2 lg:right-1/4 text-lg text-primary-300">€</span>
                        </div>

                        {/* Info offerente con badge */}
                        {auction.bids.length > 0 && auction.bids[0] && (
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mt-2 ${
                            auction.bids[0].bidder.user.username === currentUsername
                              ? 'bg-green-500/20 border border-green-500/50'
                              : 'bg-primary-500/20 border border-primary-500/30'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-400'}`}>
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                            </svg>
                            <span className={`font-bold ${auction.bids[0].bidder.user.username === currentUsername ? 'text-green-400' : 'text-primary-300'}`}>
                              {auction.bids[0].bidder.user.username}
                              {auction.bids[0].bidder.user.username === currentUsername && ' (SEI TU!)'}
                            </span>
                          </div>
                        )}
                        {auction.bids.length === 0 && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-400/50 mt-2">
                            <span className="text-gray-400">Base d'asta:</span>
                            <span className="text-white font-bold">{auction.basePrice}</span>
                          </div>
                        )}

                        {/* Contatore offerte */}
                        <div className="mt-4 text-xs text-gray-500">
                          {auction.bids.length} {auction.bids.length === 1 ? 'offerta' : 'offerte'} ricevute
                        </div>
                      </div>
                    </div>

                    {/*
                     * OLD_PRICE_START - Versione precedente per rollback
                     *
                    <div className="current-price-container rounded-xl p-5 text-center">
                      <p className="text-sm text-primary-400 mb-2 uppercase tracking-wider">Offerta Attuale</p>
                      <p className="text-5xl lg:text-6xl font-bold text-white text-glow mb-2">{auction.currentPrice}</p>
                      {auction.bids.length > 0 && auction.bids[0] && (
                        <p className={`text-lg ${auction.bids[0].bidder.user.username === currentUsername ? 'text-secondary-400 font-bold' : 'text-primary-400'}`}>
                          di {auction.bids[0].bidder.user.username}
                          {auction.bids[0].bidder.user.username === currentUsername && ' (TU)'}
                        </p>
                      )}
                      {auction.bids.length === 0 && (
                        <p className="text-gray-500">Base d'asta: {auction.basePrice}</p>
                      )}
                    </div>
                     * OLD_PRICE_END
                     */}

                    {/* Enhanced Bid Controls */}
                    <div className="space-y-3 bg-surface-300/50 rounded-xl p-4">
                      {/* Quick Bid Buttons */}
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 5, 10, 20].map(n => {
                          const newBid = parseInt(bidAmount || '0') + n
                          return (
                            <Button
                              key={n}
                              size="sm"
                              variant="outline"
                              onClick={() => setBidAmount(String(newBid))}
                              disabled={isTimerExpired || (membership?.currentBudget || 0) < newBid}
                              className={`border-surface-50/30 text-gray-300 hover:border-primary-500/50 hover:bg-primary-500/10 font-mono ${
                                (membership?.currentBudget || 0) < newBid ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              +{n}
                            </Button>
                          )
                        })}
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                          disabled={isTimerExpired || !membership?.currentBudget}
                          className="font-bold"
                        >
                          MAX
                        </Button>
                      </div>

                      {/* Main Bid Input with +/- */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                          disabled={isTimerExpired || parseInt(bidAmount || '0') <= auction.currentPrice + 1}
                          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          disabled={isTimerExpired}
                          className="flex-1 text-xl text-center bg-surface-300 border-surface-50/30 text-white font-mono"
                          placeholder="Importo..."
                          data-bid-input="true"
                        />
                        <button
                          type="button"
                          onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                          disabled={isTimerExpired || parseInt(bidAmount || '0') + 1 > (membership?.currentBudget || 0)}
                          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <Button
                          onClick={handlePlaceBid}
                          disabled={isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
                          className={`btn-primary px-6 lg:px-8 font-bold ${isTimerExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isTimerExpired ? 'Scaduto' : 'Offri'}
                        </Button>
                      </div>

                      {/* Budget reminder */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Il tuo budget:</span>
                        <span className="font-bold text-accent-400">{membership?.currentBudget || 0}</span>
                      </div>

                      {/* Keyboard shortcuts hint */}
                      <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-600 mt-1">
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">Enter</kbd> Offri</span>
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">+</kbd><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">-</kbd> Importo</span>
                        <span><kbd className="px-1 py-0.5 bg-surface-300 rounded text-gray-500">Esc</kbd> Reset</span>
                      </div>

                      {isAdmin && (
                        <Button variant="secondary" onClick={handleCloseAuction} className="w-full mt-2">
                          Chiudi Asta Manualmente
                        </Button>
                      )}
                    </div>

                    {/* Enhanced Bid History */}
                    {auction.bids.length > 0 && (
                      <div className="border-t border-surface-50/20 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm text-gray-400 font-medium">Storico Offerte</h4>
                          <span className="text-xs text-gray-500">{auction.bids.length} offerte</span>
                        </div>
                        <div className="bid-history space-y-1.5">
                          {auction.bids.map((bid, i) => (
                            <div
                              key={bid.id}
                              className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
                                i === 0
                                  ? 'bg-gradient-to-r from-primary-500/20 to-primary-500/10 border border-primary-500/30'
                                  : 'bg-surface-300/50 hover:bg-surface-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {i === 0 && (
                                  <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </span>
                                )}
                                <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${bid.bidder.user.username === currentUsername ? 'text-secondary-400' : ''}`}>
                                  {bid.bidder.user.username}
                                  {bid.bidder.user.username === currentUsername && ' (tu)'}
                                </span>
                              </div>
                              <span className={`font-mono font-bold ${i === 0 ? 'text-primary-400 text-lg' : 'text-white'}`}>
                                {bid.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !readyStatus?.hasPendingNomination && !pendingAck && (
                  <div>
                    {isMyTurn ? (
                      <div>
                        <div className="text-center mb-4">
                          <div className="text-4xl mb-2">🎯</div>
                          <p className="text-lg font-bold text-accent-400">È il tuo turno!</p>
                          <p className="text-sm text-gray-400">Seleziona un giocatore</p>
                        </div>
                        <Input placeholder="Cerca giocatore..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="mb-3 bg-surface-300 border-surface-50/30 text-white placeholder-gray-500" />
                        {/* Team Filter Dropdown */}
                        <div className="relative mb-3" data-team-dropdown>
                          <button
                            type="button"
                            onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                            className="w-full bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              {selectedTeam ? (
                                <>
                                  <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                                    <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} className="w-4 h-4 object-contain" />
                                  </div>
                                  <span>{selectedTeam}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">Tutte le squadre</span>
                              )}
                            </div>
                            <svg className={`w-4 h-4 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {teamDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => { setSelectedTeam(''); setTeamDropdownOpen(false) }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                              >
                                Tutte le squadre
                              </button>
                              {availableTeams.map(team => (
                                <button
                                  key={team.name}
                                  type="button"
                                  onClick={() => { setSelectedTeam(team.name); setTeamDropdownOpen(false) }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team.name ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                                >
                                  <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                    <img src={getTeamLogo(team.name)} alt={team.name} className="w-4 h-4 object-contain" />
                                  </div>
                                  <span>{team.name}</span>
                                  <span className="text-xs text-gray-500 ml-auto">({team.playerCount})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {isPrimoMercato && marketProgress && (
                          <div className={`text-center py-2 px-3 rounded-lg mb-3 border ${POSITION_BG[marketProgress.currentRole]}`}>
                            <span className="font-medium">Solo {marketProgress.currentRoleName}</span>
                          </div>
                        )}
                        <div className="max-h-[45vh] overflow-y-auto space-y-1">
                          {players.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Nessun giocatore</p>
                          ) : players.slice(0, 50).map(player => (
                            <button key={player.id} onClick={() => handleNominatePlayer(player.id)} className="w-full flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/10 border border-transparent hover:border-primary-500/30 transition-all text-left">
                              <div className="flex items-center gap-3 flex-1">
                                <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>{player.position}</span>
                                <div className="w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                  <img
                                    src={getTeamLogo(player.team)}
                                    alt={player.team}
                                    className="w-6 h-6 object-contain"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-white truncate">{player.name}</p>
                                  <p className="text-xs text-gray-400 truncate">{player.team}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        {marketProgress && <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${POSITION_COLORS[marketProgress.currentRole]} flex items-center justify-center text-3xl font-bold text-white mb-4`}>{marketProgress.currentRole}</div>}
                        <p className="text-gray-400">In attesa...</p>
                        {currentTurnManager && <p className="text-sm text-gray-500 mt-1">Turno di <strong className="text-primary-400">{currentTurnManager.username}</strong></p>}
                      </div>
                    )}
                  </div>
                )}
                {/* Waiting for confirmation state - show when auction just ended */}
                {!auction && pendingAck && !readyStatus?.hasPendingNomination && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary-500/20 flex items-center justify-center">
                      <span className="text-3xl">⏳</span>
                    </div>
                    <p className="text-gray-400">Conferma transazione in corso...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: DGs + Chat - Collapsible on mobile */}
          <div className={`lg:col-span-4 space-y-4 ${auction ? 'hidden lg:block' : ''}`}>
            {/*
             * MANAGERS TABLE v2 - Formato Tabellare con Budget Speso e Slot - 24/01/2026
             * Per ROLLBACK: sostituire con OLD_MANAGERS_LIST commentato sotto
             */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-2 border-b border-surface-50/20 bg-surface-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>👔</span>
                    <h3 className="font-bold text-white text-sm">Direttori Generali</h3>
                  </div>
                  {managersStatus?.allConnected === false && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <span className="connection-dot connection-dot-offline"></span>
                      Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Tabella Manager */}
              <div className="overflow-x-auto">
                {!managersStatus && (
                  <div className="p-3 text-center">
                    <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                  </div>
                )}
                {managersStatus?.managers && (
                  <table className="w-full text-xs">
                    {/* Header */}
                    <thead className="bg-surface-300/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-gray-400 font-medium">#</th>
                        <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Manager</th>
                        <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Bilancio (Budget - Ingaggi)">Disp.</th>
                        <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Costo Acquisti">Acquisti</th>
                        <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Monte Ingaggi">Ingaggi</th>
                        <th className="px-2 py-1.5 text-center text-yellow-400 font-medium" title="Portieri">P</th>
                        <th className="px-2 py-1.5 text-center text-green-400 font-medium" title="Difensori">D</th>
                        <th className="px-2 py-1.5 text-center text-blue-400 font-medium" title="Centrocampisti">C</th>
                        <th className="px-2 py-1.5 text-center text-red-400 font-medium" title="Attaccanti">A</th>
                      </tr>
                    </thead>
                    {/* Body */}
                    <tbody className="divide-y divide-surface-50/10">
                      {(() => {
                        const sortedManagers = [...managersStatus.managers].sort((a, b) => {
                          if (!firstMarketStatus?.turnOrder) return 0
                          const aIndex = firstMarketStatus.turnOrder.indexOf(a.id)
                          const bIndex = firstMarketStatus.turnOrder.indexOf(b.id)
                          return aIndex - bIndex
                        })
                        return sortedManagers.map(m => {
                          const turnIndex = firstMarketStatus?.turnOrder?.indexOf(m.id) ?? -1
                          const isCurrent = m.isCurrentTurn
                          const isMe = m.id === managersStatus.myId
                          // Calcola budget speso sommando i prezzi di acquisizione
                          const budgetSpent = m.roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
                          // Monte ingaggi: somma salary di tutti i contratti attivi
                          const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
                          // Bilancio reale = budget - monte ingaggi
                          const bilancio = m.currentBudget - monteIngaggi
                          const budgetPercent = getBudgetPercentage(bilancio)

                          return (
                            <tr
                              key={m.id}
                              onClick={() => setSelectedManager(m)}
                              className={`cursor-pointer hover:bg-surface-300/50 transition-colors ${
                                isCurrent ? 'bg-accent-500/10' : ''
                              } ${isMe && !isCurrent ? 'bg-primary-500/5' : ''}`}
                            >
                              {/* Turno + Connessione */}
                              <td className="px-2 py-2">
                                <div className="relative inline-flex">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isCurrent
                                      ? 'bg-accent-500 text-dark-900'
                                      : 'bg-surface-300 text-gray-400'
                                  }`}>
                                    {turnIndex >= 0 ? turnIndex + 1 : '-'}
                                  </span>
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-200 ${
                                      m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                                    }`}
                                  />
                                </div>
                              </td>

                              {/* Nome Manager */}
                              <td className="px-2 py-2">
                                <div className={`truncate max-w-[80px] font-medium ${
                                  isMe ? 'text-primary-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'
                                }`}>
                                  {m.username}
                                  {isMe && <span className="text-primary-300 ml-0.5">•</span>}
                                </div>
                              </td>

                              {/* Bilancio (Budget - Monte Ingaggi) */}
                              <td className="px-2 py-2 text-center">
                                <span className={`font-mono font-bold ${
                                  budgetPercent <= 20 ? 'text-red-400' : budgetPercent <= 40 ? 'text-amber-400' : 'text-green-400'
                                }`}>
                                  {bilancio}
                                </span>
                              </td>

                              {/* Costo Acquisti */}
                              <td className="px-2 py-2 text-center">
                                <span className="font-mono text-gray-400">
                                  {budgetSpent}
                                </span>
                              </td>

                              {/* Monte Ingaggi */}
                              <td className="px-2 py-2 text-center">
                                <span className="font-mono text-gray-400">
                                  {monteIngaggi}
                                </span>
                              </td>

                              {/* Slot Portieri */}
                              <td className="px-2 py-2 text-center">
                                <span className={`font-mono ${
                                  m.slotsByPosition.P.filled >= m.slotsByPosition.P.total ? 'text-yellow-400' : 'text-gray-500'
                                }`}>
                                  {m.slotsByPosition.P.filled}/{m.slotsByPosition.P.total}
                                </span>
                              </td>

                              {/* Slot Difensori */}
                              <td className="px-2 py-2 text-center">
                                <span className={`font-mono ${
                                  m.slotsByPosition.D.filled >= m.slotsByPosition.D.total ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                  {m.slotsByPosition.D.filled}/{m.slotsByPosition.D.total}
                                </span>
                              </td>

                              {/* Slot Centrocampisti */}
                              <td className="px-2 py-2 text-center">
                                <span className={`font-mono ${
                                  m.slotsByPosition.C.filled >= m.slotsByPosition.C.total ? 'text-blue-400' : 'text-gray-500'
                                }`}>
                                  {m.slotsByPosition.C.filled}/{m.slotsByPosition.C.total}
                                </span>
                              </td>

                              {/* Slot Attaccanti */}
                              <td className="px-2 py-2 text-center">
                                <span className={`font-mono ${
                                  m.slotsByPosition.A.filled >= m.slotsByPosition.A.total ? 'text-red-400' : 'text-gray-500'
                                }`}>
                                  {m.slotsByPosition.A.filled}/{m.slotsByPosition.A.total}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/*
             * OLD_MANAGERS_LIST_START - Versione precedente per rollback
             *
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-2 border-b border-surface-50/20 bg-surface-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>👔</span>
                    <h3 className="font-bold text-white text-sm">Direttori Generali</h3>
                  </div>
                  {managersStatus?.allConnected === false && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <span className="connection-dot connection-dot-offline"></span>
                      Offline
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-surface-50/10">
                {!managersStatus && (
                  <div className="p-3 text-center">
                    <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
                  </div>
                )}
                {managersStatus?.managers && (() => {
                  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
                    if (!firstMarketStatus?.turnOrder) return 0
                    const aIndex = firstMarketStatus.turnOrder.indexOf(a.id)
                    const bIndex = firstMarketStatus.turnOrder.indexOf(b.id)
                    return aIndex - bIndex
                  })
                  return sortedManagers.map(m => {
                    const turnIndex = firstMarketStatus?.turnOrder?.indexOf(m.id) ?? -1
                    const isCurrent = m.isCurrentTurn
                    const isMe = m.id === managersStatus.myId
                    const budgetPercent = getBudgetPercentage(m.currentBudget)
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedManager(m)}
                        className={`w-full px-2 py-1.5 hover:bg-surface-300/50 text-left ${
                          isCurrent ? 'bg-accent-500/10 border-l-2 border-accent-500' : ''
                        } ${isMe && !isCurrent ? 'border-l-2 border-primary-500 bg-primary-500/5' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative flex-shrink-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isCurrent ? 'bg-accent-500 text-dark-900' : 'bg-surface-300 text-gray-400'
                            }`}>{turnIndex >= 0 ? turnIndex + 1 : '-'}</span>
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-200 ${
                              m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                            }`}/>
                          </div>
                          <span className={`flex-1 text-sm truncate ${
                            isMe ? 'text-primary-400 font-medium' : isCurrent ? 'text-accent-400 font-bold' : 'text-gray-200'
                          }`}>
                            {m.username}
                            {isMe && <span className="text-xs text-primary-300 ml-1">(tu)</span>}
                            {isCurrent && <span className="text-xs text-accent-400 ml-1">TURNO</span>}
                          </span>
                          <span className={`text-sm font-mono font-bold ${
                            budgetPercent <= 20 ? 'text-red-400' : budgetPercent <= 40 ? 'text-amber-400' : 'text-green-400'
                          }`}>{m.currentBudget}M</span>
                          <span className="text-xs text-gray-500">{m.slotsFilled}/{m.totalSlots}</span>
                        </div>
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
             * OLD_MANAGERS_LIST_END
             */}

          </div>
        </div>
      </main>

      {/* Mobile Sticky Bid Controls - Only visible during active auction on mobile */}
      {auction && (
        <div className="bid-controls-sticky lg:hidden">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-3 shadow-lg">
            {/*
             * NUOVO TIMER MOBILE v2 con Progress Bar Circolare - 24/01/2026
             * Per ROLLBACK: scommentare il blocco OLD_MOBILE_TIMER sotto
             */}
            {/* Timer + Current Price Row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {auction.timerExpiresAt && (
                  <AuctionTimer
                    timeLeft={timeLeft}
                    totalSeconds={timerSetting}
                    compact={true}
                  />
                )}
                <div>
                  <p className="text-xs text-gray-400">{auction.player.name}</p>
                  <p className="text-lg font-bold text-white">{auction.currentPrice}</p>
                </div>
              </div>
              {isUserWinning && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                  Vincendo
                </span>
              )}
            </div>

            {/*
             * OLD_MOBILE_TIMER_START - Per rollback scommentare questo blocco
             *
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {auction.timerExpiresAt && (
                  <div className={`px-3 py-1 rounded-lg ${
                    timeLeft !== null && timeLeft <= 5 ? 'bg-red-500/20 border border-red-500/50' :
                    timeLeft !== null && timeLeft <= 10 ? 'bg-amber-500/20 border border-amber-500/50' :
                    'bg-surface-300'
                  }`}>
                    <span className={`font-mono font-bold text-xl ${
                      timeLeft !== null && timeLeft <= 5 ? 'text-red-400' :
                      timeLeft !== null && timeLeft <= 10 ? 'text-amber-400' :
                      'text-secondary-400'
                    }`}>
                      {timeLeft ?? '--'}s
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">{auction.player.name}</p>
                  <p className="text-lg font-bold text-white">{auction.currentPrice}</p>
                </div>
              </div>
              {isUserWinning && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                  Vincendo
                </span>
              )}
            </div>
             * OLD_MOBILE_TIMER_END
             */}

            {/* Quick Bid Buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[1, 5, 10, 20].map(n => {
                const newBid = parseInt(bidAmount || '0') + n
                return (
                  <button
                    key={n}
                    onClick={() => setBidAmount(String(newBid))}
                    disabled={isTimerExpired || (membership?.currentBudget || 0) < newBid}
                    className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
                      isTimerExpired || (membership?.currentBudget || 0) < newBid
                        ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                        : 'bg-primary-500/20 text-primary-400 border border-primary-500/30 active:scale-95'
                    }`}
                  >
                    +{n}
                  </button>
                )
              })}
              <button
                onClick={() => setBidAmount(String(membership?.currentBudget || 0))}
                disabled={isTimerExpired || !membership?.currentBudget}
                className={`py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
                  isTimerExpired || !membership?.currentBudget
                    ? 'bg-surface-400/50 text-gray-600 cursor-not-allowed'
                    : 'bg-accent-500 text-dark-900 active:scale-95'
                }`}
              >
                MAX
              </button>
            </div>

            {/* Custom Bid Input with +/- */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBidAmount(String(Math.max(auction.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                disabled={isTimerExpired || parseInt(bidAmount || '0') <= auction.currentPrice + 1}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                disabled={isTimerExpired}
                className="flex-1 bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-2 text-white text-center font-mono"
                placeholder="Importo..."
              />
              <button
                type="button"
                onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                disabled={isTimerExpired || parseInt(bidAmount || '0') + 1 > (membership?.currentBudget || 0)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
              <button
                onClick={handlePlaceBid}
                disabled={isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${
                  isTimerExpired || !membership || membership.currentBudget < (parseInt(bidAmount) || 0)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'btn-primary active:scale-95'
                }`}
              >
                {isTimerExpired ? 'Scaduto' : 'Offri'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Detail Modal */}
      {selectedManager && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedManager(null)}>
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedManager.username}</h2>
                  {selectedManager.teamName && <p className="text-gray-400">{selectedManager.teamName}</p>}
                </div>
                <button onClick={() => setSelectedManager(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
              </div>
              <div className="flex gap-4 mb-6">
                <div className="bg-surface-300 rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-xs text-gray-400 uppercase">Budget</p>
                  <p className="text-2xl font-bold text-accent-400">{selectedManager.currentBudget}</p>
                </div>
                <div className="bg-surface-300 rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-xs text-gray-400 uppercase">Rosa</p>
                  <p className="text-2xl font-bold text-white">{selectedManager.slotsFilled}/{selectedManager.totalSlots}</p>
                </div>
              </div>
              {(['P', 'D', 'C', 'A'] as const).map(pos => {
                const slot = selectedManager.slotsByPosition[pos]
                const posPlayers = selectedManager.roster.filter(r => r.position === pos)
                return (
                  <div key={pos} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-xs font-bold text-white`}>{pos}</span>
                        <span className="text-gray-300">{POSITION_NAMES[pos]}</span>
                      </div>
                      <span className={`text-sm font-bold ${slot.filled >= slot.total ? 'text-secondary-400' : 'text-gray-500'}`}>{slot.filled}/{slot.total}</span>
                    </div>
                    {posPlayers.length > 0 ? (
                      <table className="w-full text-xs ml-2">
                        <thead>
                          <tr className="text-gray-500 text-[10px] uppercase">
                            <th className="text-left font-medium pb-1">Giocatore</th>
                            <th className="text-center font-medium pb-1 w-14">Prezzo</th>
                            <th className="text-center font-medium pb-1 w-12">Ing.</th>
                            <th className="text-center font-medium pb-1 w-10">Dur.</th>
                            <th className="text-center font-medium pb-1 w-14">Claus.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {posPlayers.map(p => (
                            <tr key={p.id} className="border-t border-surface-50/10">
                              <td className="py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-4 h-4 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                                    <img src={getTeamLogo(p.playerTeam)} alt={p.playerTeam} className="w-3 h-3 object-contain" />
                                  </div>
                                  <span className="text-gray-200 truncate">{p.playerName}</span>
                                </div>
                              </td>
                              <td className="text-center text-accent-400 font-bold">{p.acquisitionPrice}</td>
                              <td className="text-center text-white">{p.contract?.salary ?? '-'}</td>
                              <td className="text-center text-white">{p.contract?.duration ?? '-'}</td>
                              <td className="text-center text-primary-400">{p.contract?.rescissionClause ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-600 italic text-sm ml-8">Nessuno</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgment Modal - Non mostrare se c'è un ricorso attivo */}
      {pendingAck && !pendingAck.userAcknowledged && appealStatus?.auctionStatus !== 'APPEAL_REVIEW' && appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' && appealStatus?.auctionStatus !== 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${pendingAck.winner ? 'bg-secondary-500/20' : 'bg-surface-300'}`}>
                  <span className="text-3xl">{pendingAck.winner ? '✅' : '❌'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{pendingAck.winner ? 'Transazione Completata' : 'Asta Conclusa'}</h2>
              </div>
              <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
                <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[pendingAck.player.position]} flex items-center justify-center text-white font-bold flex-shrink-0`}>{pendingAck.player.position}</span>
                <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                  <img
                    src={getTeamLogo(pendingAck.player.team)}
                    alt={pendingAck.player.team}
                    className="w-7 h-7 object-contain"
                  />
                </div>
                <div>
                  <p className="font-bold text-white">{pendingAck.player.name}</p>
                  <p className="text-sm text-gray-400">{pendingAck.player.team}</p>
                </div>
              </div>
              {pendingAck.winner ? (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 border border-primary-500/30">
                  <div className="text-center mb-3">
                    <p className="text-sm text-primary-400">Acquistato da</p>
                    <p className="text-xl font-bold text-white">{pendingAck.winner.username}</p>
                    <p className="text-3xl font-bold text-accent-400 mt-1">{pendingAck.finalPrice}M</p>
                  </div>
                  {pendingAck.contractInfo && (
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-primary-500/20">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase">Ingaggio</p>
                        <p className="text-sm font-bold text-white">{pendingAck.contractInfo.salary}M</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase">Durata</p>
                        <p className="text-sm font-bold text-white">{pendingAck.contractInfo.duration}s</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase">Clausola</p>
                        <p className="text-sm font-bold text-primary-400">{pendingAck.contractInfo.rescissionClause}M</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center"><p className="text-gray-400">Nessuna offerta</p></div>
              )}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme</span>
                  <span className="text-white">{pendingAck.totalAcknowledged}/{pendingAck.totalMembers}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div className="h-2 rounded-full bg-secondary-500 transition-all" style={{ width: `${(pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100}%` }}></div>
                </div>
              </div>

              {/* Profezia opzionale */}
              <textarea
                value={prophecyContent}
                onChange={e => setProphecyContent(e.target.value)}
                className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-3 text-white placeholder-gray-500 mb-4"
                rows={2}
                placeholder="Profezia (opzionale)..."
                maxLength={500}
              />

              {/* Ricorso (espandibile) */}
              {isAppealMode && (
                <div className="mb-4">
                  <p className="text-xs text-danger-400 mb-2">
                    Indica il motivo per cui contesti questa conclusione d'asta (es. problemi di connessione)
                  </p>
                  <textarea
                    value={appealContent}
                    onChange={e => setAppealContent(e.target.value)}
                    className="w-full bg-surface-300 border border-danger-500/50 rounded-lg p-3 text-white placeholder-gray-500"
                    rows={3}
                    placeholder="Descrivi il motivo del ricorso..."
                    maxLength={500}
                  />
                </div>
              )}

              {/* Bottoni Azione */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAcknowledge(!!prophecyContent.trim())}
                  disabled={ackSubmitting}
                  className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
                >
                  {ackSubmitting ? 'Invio...' : 'Conferma'}
                </Button>
                {!isAppealMode ? (
                  <Button
                    onClick={() => setIsAppealMode(true)}
                    disabled={ackSubmitting}
                    variant="outline"
                    className="flex-1 border-danger-500 text-danger-400 hover:bg-danger-500/10 py-3"
                  >
                    Ricorso
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleAcknowledge(false, true)}
                    disabled={ackSubmitting || !appealContent.trim()}
                    className="flex-1 bg-danger-500 hover:bg-danger-600 text-white py-3"
                  >
                    {ackSubmitting ? 'Invio...' : 'Invia Ricorso'}
                  </Button>
                )}
              </div>

              {/* Admin: Simula ricorso */}
              {isAdmin && (
                <>
                  {error && (
                    <div className="mt-3 p-2 bg-danger-500/20 border border-danger-500/50 rounded text-danger-400 text-xs">
                      {error}
                      {error.includes('PENDING') && (
                        <Button
                          onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                          size="sm"
                          className="w-full mt-2 bg-danger-500 hover:bg-danger-600 text-white text-xs"
                        >
                          Gestisci Ricorsi
                        </Button>
                      )}
                    </div>
                  )}
                  <Button
                    onClick={handleSimulateAppeal}
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                  >
                    [TEST] Simula ricorso di un DG
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting Modal - Solo per stati normali (COMPLETED, NO_BIDS), non per stati di ricorso */}
      {pendingAck && pendingAck.userAcknowledged &&
       !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(pendingAck.status) &&
       !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(appealStatus?.auctionStatus || '') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-sm w-full p-6 text-center border border-surface-50/20">
            <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-bold text-white mb-2">In attesa degli altri</h3>
            <p className="text-sm text-gray-400 mb-3">{pendingAck.totalAcknowledged}/{pendingAck.totalMembers} confermati</p>
            <p className="text-xs text-gray-500 mb-4">Mancano: {pendingAck.pendingMembers.map(m => m.username).join(', ')}</p>
            {isAdmin && <Button size="sm" variant="outline" onClick={handleForceAcknowledgeAll} className="border-accent-500/50 text-accent-400">[TEST] Forza Conferme</Button>}
          </div>
        </div>
      )}

      {/* APPEAL_REVIEW Modal - Asta bloccata in attesa decisione admin */}
      {(appealStatus?.auctionStatus === 'APPEAL_REVIEW' || pendingAck?.status === 'APPEAL_REVIEW') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-danger-500/50">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Ricorso in Corso</h2>
                <p className="text-gray-400 mt-1">L'asta è sospesa in attesa della decisione dell'admin</p>
              </div>

              {/* Player info */}
              {(appealStatus?.player || pendingAck?.player) && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {(appealStatus?.player || pendingAck?.player)?.position}
                  </span>
                  <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                    <img
                      src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                      alt={(appealStatus?.player || pendingAck?.player)?.team}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                    <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
                  </div>
                </div>
              )}

              {/* Appeal details */}
              {appealStatus?.appeal && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-danger-400 uppercase font-bold mb-2">Motivo del ricorso</p>
                  <p className="text-gray-300">{appealStatus.appeal.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span></p>
                </div>
              )}

              {/* Transaction info */}
              {(appealStatus?.winner || pendingAck?.winner) && (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Transazione contestata</p>
                  <p className="text-lg font-bold text-white">{(appealStatus?.winner || pendingAck?.winner)?.username}</p>
                  <p className="text-2xl font-bold text-accent-400 mt-1">{appealStatus?.finalPrice || pendingAck?.finalPrice}</p>
                </div>
              )}

              <div className="text-center py-4">
                <div className="w-10 h-10 border-4 border-danger-500/30 border-t-danger-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-400">In attesa della decisione dell'admin...</p>
              </div>

              {/* Admin button */}
              {isAdmin && (
                <Button
                  onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                  className="w-full bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
                >
                  Gestisci Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_APPEAL_ACK Modal - Tutti devono confermare di aver visto la decisione */}
      {(appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' || pendingAck?.status === 'AWAITING_APPEAL_ACK') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus?.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
                  <span className="text-3xl">{appealStatus?.appeal?.status === 'ACCEPTED' ? '🔄' : '✅'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Ricorso {appealStatus?.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {appealStatus?.appeal?.status === 'ACCEPTED'
                    ? 'La transazione è stata annullata, l\'asta riprenderà'
                    : 'La transazione è confermata'}
                </p>
              </div>

              {/* Player info */}
              {(appealStatus?.player || pendingAck?.player) && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {(appealStatus?.player || pendingAck?.player)?.position}
                  </span>
                  <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                    <img
                      src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                      alt={(appealStatus?.player || pendingAck?.player)?.team}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                    <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {appealStatus?.appeal?.adminNotes && (
                <div className="bg-surface-300 border border-surface-50/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
                  <p className="text-gray-300">{appealStatus.appeal.adminNotes}</p>
                </div>
              )}

              {/* Ack progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme presa visione</span>
                  <span className="text-white">{appealStatus?.appealDecisionAcks?.length || 0}/{appealStatus?.allMembers?.length || pendingAck?.totalMembers || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-secondary-500 transition-all"
                    style={{ width: `${((appealStatus?.appealDecisionAcks?.length || 0) / (appealStatus?.allMembers?.length || pendingAck?.totalMembers || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus?.allMembers && appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!appealStatus?.userHasAcked ? (
                <Button
                  onClick={handleAcknowledgeAppealDecision}
                  disabled={ackSubmitting}
                  className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3"
                >
                  {ackSubmitting ? 'Invio...' : 'Ho preso visione'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Hai confermato - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button - sempre visibile per admin */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllAppealAcks}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  [TEST] Forza Tutte Conferme Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_RESUME Modal - Ready check prima di riprendere l'asta */}
      {(appealStatus?.auctionStatus === 'AWAITING_RESUME' || pendingAck?.status === 'AWAITING_RESUME') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-accent-500/50 animate-pulse-slow">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔔</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Pronto a Riprendere?</h2>
                <p className="text-gray-400 mt-1">L'asta sta per riprendere, conferma la tua presenza</p>
              </div>

              {/* Player info */}
              {(appealStatus?.player || pendingAck?.player) && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[(appealStatus?.player || pendingAck?.player)?.position || 'P']} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {(appealStatus?.player || pendingAck?.player)?.position}
                  </span>
                  <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                    <img
                      src={getTeamLogo((appealStatus?.player || pendingAck?.player)?.team || '')}
                      alt={(appealStatus?.player || pendingAck?.player)?.team}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-white">{(appealStatus?.player || pendingAck?.player)?.name}</p>
                    <p className="text-sm text-gray-400">{(appealStatus?.player || pendingAck?.player)?.team}</p>
                  </div>
                </div>
              )}

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-4 text-center">
                <p className="text-warning-400 font-medium">
                  Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
                </p>
              </div>

              {/* Ready progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">DG pronti</span>
                  <span className="text-white">{appealStatus?.resumeReadyMembers?.length || 0}/{appealStatus?.allMembers?.length || pendingAck?.totalMembers || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-accent-500 transition-all"
                    style={{ width: `${((appealStatus?.resumeReadyMembers?.length || 0) / (appealStatus?.allMembers?.length || pendingAck?.totalMembers || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus?.allMembers && appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!appealStatus?.userIsReady ? (
                <Button
                  onClick={handleReadyToResume}
                  disabled={markingReady}
                  className="w-full btn-accent py-3 text-lg font-bold"
                >
                  {markingReady ? 'Attendi...' : 'SONO PRONTO'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Pronto - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button - sempre visibile per admin */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllReadyResume}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modification Modal after Primo Mercato Win */}
      {pendingContractModification && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: pendingContractModification.playerId,
            name: pendingContractModification.playerName,
            team: pendingContractModification.playerTeam,
            position: pendingContractModification.playerPosition,
          }}
          contract={{
            salary: pendingContractModification.salary,
            duration: pendingContractModification.duration,
            initialSalary: pendingContractModification.initialSalary,
            rescissionClause: pendingContractModification.rescissionClause,
          }}
          onConfirm={handleContractModification}
          title="Modifica Contratto"
          description="Hai appena acquistato questo giocatore. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}
    </div>
  )
}
