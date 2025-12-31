import { useState, useEffect, useCallback, useRef } from 'react'
import { auctionApi, playerApi, firstMarketApi, adminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { Chat } from '../components/Chat'
import { getTeamLogo } from '../utils/teamLogos'
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
}

interface ReadyStatus {
  hasPendingNomination: boolean
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

const POSITION_COLORS: Record<string, string> = {
  P: 'from-amber-500 to-amber-600',
  D: 'from-blue-500 to-blue-600',
  C: 'from-emerald-500 to-emerald-600',
  A: 'from-red-500 to-red-600',
}

const POSITION_BG: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  D: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  C: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  A: 'bg-red-500/20 text-red-400 border-red-500/40',
}

const POSITION_NAMES: Record<string, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
}

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
    const updateTimer = () => {
      const expiresAt = new Date(auction.timerExpiresAt!).getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)

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
        loadCurrentAuction()
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [auction?.timerExpiresAt, loadCurrentAuction, loadPendingAcknowledgment])

  useEffect(() => {
    loadCurrentAuction()
    loadFirstMarketStatus()
    loadPendingAcknowledgment()
    loadReadyStatus()
    loadMyRosterSlots()
    loadManagersStatus()
    loadTeams()
    const interval = setInterval(() => {
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadPendingAcknowledgment()
      loadReadyStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    }, 2000)
    return () => clearInterval(interval)
  }, [loadCurrentAuction, loadFirstMarketStatus, loadPendingAcknowledgment, loadReadyStatus, loadMyRosterSlots, loadManagersStatus, loadTeams])

  // Carica stato ricorso quando cambia pendingAck
  useEffect(() => {
    loadAppealStatus()
    const interval = setInterval(loadAppealStatus, 2000)
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
      setSuccessMessage('Giocatore nominato!')
      loadReadyStatus()
      loadPlayers()
    } else {
      setError(result.message || 'Errore nella nomina')
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

  async function handleBotTurn() {
    setError('')
    const result = await auctionApi.triggerBotTurn(sessionId)
    if (result.success) {
      const data = result.data as {
        player?: { name: string }
        auctionStarted?: boolean
        hasBotBid?: boolean
        winningBot?: string | null
        newCurrentPrice?: number
      }
      if (data.player) {
        setSuccessMessage(`Bot ha nominato ${data.player.name}`)
      } else if (data.auctionStarted) {
        setSuccessMessage('Asta avviata!')
      } else if (data.hasBotBid) {
        setSuccessMessage(`${data.winningBot} ha offerto ${data.newCurrentPrice}!`)
      } else {
        setSuccessMessage(result.message || 'Turno bot completato')
      }
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

  async function handleCompleteAllSlots() {
    if (!sessionId) return
    if (!confirm('Sei sicuro di voler completare l\'asta riempiendo tutti gli slot di tutti i manager?')) return
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
      return
    }
    const result = await auctionApi.placeBid(auction.id, amount)
    if (result.success) {
      setSuccessMessage(`Offerta di ${amount} registrata!`)
      setBidAmount(String(amount + 1))
      loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
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
      loadPendingAcknowledgment()
      loadPlayers()
      loadMyRosterSlots()
      loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  const isMyTurn = firstMarketStatus?.isUserTurn || false
  const currentTurnManager = firstMarketStatus?.currentNominator

  function getTimerClass() {
    if (timeLeft === null) return 'text-gray-500'
    if (timeLeft <= 5) return 'timer-danger'
    if (timeLeft <= 10) return 'timer-warning'
    return 'timer-safe'
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
            <p className="text-gray-400 mt-1">Trascina i manager per definire l'ordine dei turni</p>
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
                <h2 className="font-bold text-white">Manager in Sala</h2>
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
                <p className="text-gray-400 text-sm">Primo Mercato</p>
              </div>
            </div>
            <div className="text-right bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
              <p className="text-3xl font-bold gradient-text-gold">{membership?.currentBudget || 0}</p>
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
                  (slot/manager: {marketProgress.slotLimits[marketProgress.currentRole as keyof typeof marketProgress.slotLimits]})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="max-w-full mx-auto px-4 py-6">
        {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg mb-4">{error}</div>}
        {successMessage && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg mb-4">{successMessage}</div>}

        <div className="grid lg:grid-cols-12 gap-4">
          {/* LEFT: My Roster */}
          <div className="lg:col-span-3 space-y-4">
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
                      <div key={pos} className={`p-3 ${isCurrent ? 'bg-primary-500/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${POSITION_COLORS[pos]} flex items-center justify-center text-xs font-bold text-white`}>{pos}</span>
                            <span className="text-sm text-gray-300">{POSITION_NAMES[pos]}</span>
                          </div>
                          <span className={`text-sm font-bold ${slot.filled >= slot.total ? 'text-secondary-400' : 'text-gray-500'}`}>{slot.filled}/{slot.total}</span>
                        </div>
                        {slot.players.map(p => (
                          <div key={p.id} className="ml-9 py-1.5 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                <img
                                  src={getTeamLogo(p.playerTeam)}
                                  alt={p.playerTeam}
                                  className="w-4 h-4 object-contain"
                                />
                              </div>
                              <div className="min-w-0">
                                <span className="text-gray-200 font-medium truncate block">{p.playerName}</span>
                                <span className="text-gray-500 text-xs truncate block">{p.playerTeam}</span>
                              </div>
                            </div>
                            <span className="text-accent-400 font-mono font-bold ml-2">{p.acquisitionPrice}</span>
                          </div>
                        ))}
                        {Array.from({ length: slot.total - slot.filled }).map((_, i) => (
                          <div key={i} className="ml-9 py-1 text-sm text-gray-600 italic">Slot vuoto</div>
                        ))}
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
                  <div className="pt-2 border-t border-surface-50/20 space-y-2">
                    <p className="text-xs text-accent-500 font-bold uppercase">Test Mode</p>
                    <Button size="sm" variant="outline" onClick={handleBotTurn} className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10">
                      🤖 Bot Turno
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleForceAllReady} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Tutti Pronti</Button>
                    <Button size="sm" variant="outline" onClick={handleForceAcknowledgeAll} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Conferme</Button>
                    {auction && (
                      <Button size="sm" variant="outline" onClick={handleBotBid} className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10">Bot Offerta</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleCompleteAllSlots} className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10">
                      ✅ Completa Tutti Slot
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleResetFirstMarket} className="w-full text-xs">Reset Asta</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Auction */}
          <div className="lg:col-span-5 space-y-4">
            {/* Ready Check */}
            {readyStatus?.hasPendingNomination && !auction && (
              <div className="bg-surface-200 rounded-xl border-2 border-accent-500/50 overflow-hidden animate-pulse-slow">
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">⏳</div>
                  <h2 className="text-xl font-bold text-white mb-2">{readyStatus.nominatorUsername} ha chiamato</h2>
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
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Manager pronti</span>
                      <span className="font-bold text-white">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                    </div>
                    <div className="w-full bg-surface-400 rounded-full h-2">
                      <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}></div>
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
                </div>
              </div>
            )}

            {/* Auction Card */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-4 border-b border-surface-50/20 flex items-center gap-2">
                <span className="text-lg">{auction ? '🔨' : '📭'}</span>
                <h3 className="font-bold text-white">{auction ? 'Asta in Corso' : 'Nessuna Asta'}</h3>
              </div>

              <div className="p-6">
                {auction ? (
                  <div>
                    {/* Timer */}
                    {auction.timerExpiresAt && (
                      <div className="text-center mb-6">
                        <div className={`text-7xl font-mono font-bold ${getTimerClass()}`}>{timeLeft ?? '--'}</div>
                        <p className="text-gray-500 text-sm">secondi</p>
                      </div>
                    )}

                    {/* Player */}
                    <div className="text-center mb-6 p-6 bg-surface-300 rounded-xl">
                      <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold border mb-3 ${POSITION_BG[auction.player.position]}`}>{POSITION_NAMES[auction.player.position]}</span>
                      <h2 className="text-4xl font-bold text-white mb-2">{auction.player.name}</h2>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-8 h-8 bg-white/90 rounded flex items-center justify-center p-0.5">
                          <img
                            src={getTeamLogo(auction.player.team)}
                            alt={auction.player.team}
                            className="w-7 h-7 object-contain"
                          />
                        </div>
                        <p className="text-xl text-gray-400">{auction.player.team}</p>
                      </div>
                    </div>

                    {/* Current Price */}
                    <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-6 text-center mb-6">
                      <p className="text-sm text-primary-400 mb-1">Offerta Attuale</p>
                      <p className="text-6xl font-bold text-white text-glow">{auction.currentPrice}</p>
                      {auction.bids.length > 0 && auction.bids[0] && <p className="text-primary-400 mt-2">di {auction.bids[0].bidder.user.username}</p>}
                    </div>

                    {/* Bid Controls */}
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} className="text-xl text-center bg-surface-300 border-surface-50/30 text-white" />
                        <Button onClick={handlePlaceBid} disabled={!membership || membership.currentBudget < (parseInt(bidAmount) || 0)} className="btn-primary px-8">Offri</Button>
                      </div>
                      <div className="flex gap-2 justify-center">
                        {[1, 5, 10, 25, 50].map(n => (
                          <Button key={n} size="sm" variant="outline" onClick={() => setBidAmount(String(auction.currentPrice + n))} className="border-surface-50/30 text-gray-300 hover:border-primary-500/50">+{n}</Button>
                        ))}
                      </div>
                      {isAdmin && <Button variant="secondary" onClick={handleCloseAuction} className="w-full mt-4">Chiudi Asta</Button>}
                    </div>

                    {/* Bids History */}
                    {auction.bids.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-surface-50/20">
                        <h4 className="text-sm text-gray-400 mb-3">Storico</h4>
                        <div className="space-y-1">
                          {auction.bids.map((bid, i) => (
                            <div key={bid.id} className={`flex justify-between py-2 px-3 rounded ${i === 0 ? 'bg-primary-500/20' : 'bg-surface-300'}`}>
                              <span className="text-gray-300">{bid.bidder.user.username}</span>
                              <span className="font-mono font-bold text-white">{bid.amount}</span>
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
                        <div className="space-y-1">
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

          {/* RIGHT: Chat + Managers */}
          <div className="lg:col-span-4 space-y-4">
            {/* Chat */}
            <Chat
              sessionId={sessionId}
              currentMemberId={managersStatus?.myId}
              isAdmin={isAdmin}
            />

            {/* Managers List with Turn Order */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden max-h-[40vh] overflow-y-auto">
              <div className="p-3 border-b border-surface-50/20">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">Manager</h3>
                  {managersStatus?.allConnected === false && (
                    <span className="text-xs text-red-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Disconnessioni
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-surface-50/10">
                {!managersStatus && <p className="text-gray-500 text-center py-4 text-sm">Caricamento...</p>}
                {managersStatus?.managers && (() => {
                  // Ordina i manager per ordine turno se disponibile
                  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
                    if (!firstMarketStatus?.turnOrder) return 0
                    const aIndex = firstMarketStatus.turnOrder.indexOf(a.id)
                    const bIndex = firstMarketStatus.turnOrder.indexOf(b.id)
                    return aIndex - bIndex
                  })
                  return sortedManagers.map(m => {
                    const turnIndex = firstMarketStatus?.turnOrder?.indexOf(m.id) ?? -1
                    const isCurrent = m.isCurrentTurn
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedManager(m)}
                        className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-300 transition-colors text-left ${isCurrent ? 'bg-accent-500/20 border-l-2 border-accent-500' : ''} ${m.id === managersStatus.myId ? 'border-l-2 border-primary-500' : ''}`}
                      >
                        {/* Turn Order Number */}
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isCurrent
                            ? 'bg-accent-500 text-dark-900'
                            : 'bg-surface-300 text-gray-400'
                        }`}>
                          {turnIndex >= 0 ? turnIndex + 1 : '-'}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {/* Connection status indicator */}
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                m.isConnected === true
                                  ? 'bg-green-500'
                                  : m.isConnected === false
                                    ? 'bg-red-500 animate-pulse'
                                    : 'bg-gray-500'
                              }`}
                              title={m.isConnected === true ? 'Connesso' : m.isConnected === false ? 'Disconnesso' : 'Stato sconosciuto'}
                            />
                            <span className={`font-medium truncate ${m.id === managersStatus.myId ? 'text-primary-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'}`}>
                              {m.username}
                            </span>
                            {isCurrent && <span className="text-xs text-accent-500">← turno</span>}
                          </div>
                          {m.teamName && <p className="text-xs text-gray-500 truncate">{m.teamName}</p>}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-accent-400">{m.currentBudget}</p>
                          <p className="text-xs text-gray-500">{m.slotsFilled}/{m.totalSlots}</p>
                        </div>
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        </div>
      </main>

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
                    <div className="ml-8 space-y-1">
                      {posPlayers.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                              <img
                                src={getTeamLogo(p.playerTeam)}
                                alt={p.playerTeam}
                                className="w-4 h-4 object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="text-gray-200 font-medium truncate block">{p.playerName}</span>
                              <span className="text-gray-500 text-xs truncate block">{p.playerTeam}</span>
                            </div>
                          </div>
                          <span className="text-accent-400 font-mono font-bold ml-2">{p.acquisitionPrice}</span>
                        </div>
                      ))}
                      {posPlayers.length === 0 && <p className="text-gray-600 italic text-sm">Nessuno</p>}
                    </div>
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
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Acquistato da</p>
                  <p className="text-xl font-bold text-white">{pendingAck.winner.username}</p>
                  <p className="text-3xl font-bold text-accent-400 mt-1">{pendingAck.finalPrice}</p>
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
                    [TEST] Simula ricorso di un manager
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
                  <span className="text-gray-400">Manager pronti</span>
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
    </div>
  )
}
