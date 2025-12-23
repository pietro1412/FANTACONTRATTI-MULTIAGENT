import { useState, useEffect, useCallback } from 'react'
import { auctionApi, playerApi, firstMarketApi, adminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
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
  const [prophecyContent, setProphecyContent] = useState('')
  const [ackSubmitting, setAckSubmitting] = useState(false)

  const [myRosterSlots, setMyRosterSlots] = useState<MyRosterSlots | null>(null)
  const [managersStatus, setManagersStatus] = useState<ManagersStatusData | null>(null)
  const [selectedManager, setSelectedManager] = useState<ManagerData | null>(null)

  const isAdmin = membership?.role === 'ADMIN'
  const isPrimoMercato = sessionInfo?.type === 'PRIMO_MERCATO'
  const hasTurnOrder = firstMarketStatus?.turnOrder && firstMarketStatus.turnOrder.length > 0

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Timer countdown
  useEffect(() => {
    if (!auction?.timerExpiresAt) {
      setTimeLeft(null)
      return
    }
    const updateTimer = () => {
      const expiresAt = new Date(auction.timerExpiresAt!).getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [auction?.timerExpiresAt])

  const loadCurrentAuction = useCallback(async () => {
    const result = await auctionApi.getCurrentAuction(sessionId)
    if (result.success && result.data) {
      const data = result.data as { auction: Auction | null; userMembership: Membership; session: SessionInfo; marketProgress: MarketProgress | null }
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
    }
    setIsLoading(false)
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
      setPendingAck((result.data as { pendingAuction: PendingAcknowledgment | null }).pendingAuction)
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

  const loadPlayers = useCallback(async () => {
    const filters: { available: boolean; leagueId: string; position?: string; search?: string } = { available: true, leagueId }
    if (selectedPosition) filters.position = selectedPosition
    if (searchQuery) filters.search = searchQuery
    const result = await playerApi.getAll(filters)
    if (result.success && result.data) setPlayers(result.data as Player[])
  }, [leagueId, selectedPosition, searchQuery])

  useEffect(() => {
    loadCurrentAuction()
    loadFirstMarketStatus()
    loadPendingAcknowledgment()
    loadReadyStatus()
    loadMyRosterSlots()
    loadManagersStatus()
    const interval = setInterval(() => {
      loadCurrentAuction()
      loadFirstMarketStatus()
      loadPendingAcknowledgment()
      loadReadyStatus()
      loadMyRosterSlots()
      loadManagersStatus()
    }, 2000)
    return () => clearInterval(interval)
  }, [loadCurrentAuction, loadFirstMarketStatus, loadPendingAcknowledgment, loadReadyStatus, loadMyRosterSlots, loadManagersStatus])

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
  }, [selectedPosition, searchQuery, loadPlayers, sessionInfo])

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

  async function handleForceAcknowledgeAll() {
    const result = await auctionApi.forceAcknowledgeAll(sessionId)
    if (result.success) {
      setSuccessMessage('Conferme forzate!')
      loadPendingAcknowledgment()
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

  async function handleUpdateTimer() {
    const result = await auctionApi.updateSessionTimer(sessionId, timerSetting)
    if (result.success) setSuccessMessage(`Timer: ${timerSetting}s`)
    else setError(result.message || 'Errore')
  }

  async function handleAcknowledge(withProphecy: boolean) {
    if (!pendingAck) return
    setAckSubmitting(true)
    const result = await auctionApi.acknowledgeAuction(pendingAck.id, withProphecy ? prophecyContent.trim() : undefined)
    setAckSubmitting(false)
    if (result.success) {
      setProphecyContent('')
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
              <div className="text-sm">
                <span className="text-gray-400">Slot: </span>
                <span className="font-bold text-white">{marketProgress.filledSlots}/{marketProgress.totalSlots}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="max-w-full mx-auto px-4 py-6">
        {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg mb-4">{error}</div>}
        {successMessage && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg mb-4">{successMessage}</div>}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* LEFT: My Roster */}
          <div className="lg:col-span-1 space-y-4">
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
                          <div key={p.id} className="ml-9 py-1 flex justify-between text-sm">
                            <span className="text-gray-300 truncate">{p.playerName}</span>
                            <span className="text-accent-400 font-mono">{p.acquisitionPrice}</span>
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
                  <div className="flex gap-2 items-center">
                    <Input type="number" value={timerSetting} onChange={e => setTimerSetting(parseInt(e.target.value) || 30)} className="w-20 text-center bg-surface-300 border-surface-50/30 text-white" />
                    <span className="text-gray-400 text-sm">sec</span>
                    <Button size="sm" variant="outline" onClick={handleUpdateTimer} className="text-xs">Set</Button>
                  </div>
                  <div className="pt-2 border-t border-surface-50/20 space-y-2">
                    <p className="text-xs text-accent-500 font-bold uppercase">Test Mode</p>
                    <Button size="sm" variant="outline" onClick={handleForceAllReady} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Tutti Pronti</Button>
                    <Button size="sm" variant="outline" onClick={handleForceAcknowledgeAll} className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10">Forza Conferme</Button>
                    <Button size="sm" variant="danger" onClick={handleResetFirstMarket} className="w-full text-xs">Reset Asta</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Auction */}
          <div className="lg:col-span-2 space-y-4">
            {/* Ready Check */}
            {readyStatus?.hasPendingNomination && !auction && (
              <div className="bg-surface-200 rounded-xl border-2 border-accent-500/50 overflow-hidden animate-pulse-slow">
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">⏳</div>
                  <h2 className="text-xl font-bold text-white mb-2">{readyStatus.nominatorUsername} ha chiamato</h2>
                  {readyStatus.player && (
                    <div className="inline-flex items-center gap-3 bg-surface-300 rounded-lg p-4 mb-4">
                      <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${POSITION_COLORS[readyStatus.player.position]} flex items-center justify-center text-white font-bold text-lg`}>{readyStatus.player.position}</span>
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
                      <h2 className="text-4xl font-bold text-white mb-1">{auction.player.name}</h2>
                      <p className="text-xl text-gray-400">{auction.player.team}</p>
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
                ) : !readyStatus?.hasPendingNomination && (
                  <div>
                    {isMyTurn ? (
                      <div>
                        <div className="text-center mb-4">
                          <div className="text-4xl mb-2">🎯</div>
                          <p className="text-lg font-bold text-accent-400">È il tuo turno!</p>
                          <p className="text-sm text-gray-400">Seleziona un giocatore</p>
                        </div>
                        <Input placeholder="Cerca giocatore..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="mb-3 bg-surface-300 border-surface-50/30 text-white placeholder-gray-500" />
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
                              <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-xs font-bold text-white`}>{player.position}</span>
                                <div>
                                  <p className="font-medium text-white">{player.name}</p>
                                  <p className="text-xs text-gray-400">{player.team}</p>
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
              </div>
            </div>
          </div>

          {/* RIGHT: Managers */}
          <div className="lg:col-span-1 space-y-4">
            {/* Turn Order */}
            {firstMarketStatus?.turnOrder && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-3 border-b border-surface-50/20">
                  <h3 className="font-bold text-white text-sm">Ordine Turni</h3>
                </div>
                <div className="divide-y divide-surface-50/10">
                  {firstMarketStatus.turnOrder.map((memberId, index) => {
                    const member = firstMarketStatus.memberStatus.find(m => m.memberId === memberId)
                    if (!member) return null
                    const isCurrent = currentTurnManager?.memberId === memberId
                    return (
                      <div key={memberId} className={`flex items-center gap-2 px-3 py-2 ${isCurrent ? 'bg-accent-500/20 border-l-2 border-accent-500' : ''}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-accent-500 text-dark-900' : 'bg-surface-300 text-gray-400'}`}>{index + 1}</span>
                        <span className={`text-sm ${isCurrent ? 'font-bold text-accent-400' : 'text-gray-300'}`}>{member.username}</span>
                        {isCurrent && <span className="text-xs text-accent-500 ml-auto">←</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Managers List */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-3 border-b border-surface-50/20">
                <h3 className="font-bold text-white text-sm">Manager</h3>
              </div>
              <div className="divide-y divide-surface-50/10">
                {!managersStatus && <p className="text-gray-500 text-center py-4 text-sm">Caricamento...</p>}
                {managersStatus?.managers?.map(m => (
                  <button key={m.id} onClick={() => setSelectedManager(m)} className={`w-full flex items-center justify-between px-4 py-3 hover:bg-surface-300 transition-colors text-left ${m.isCurrentTurn ? 'bg-primary-500/10' : ''} ${m.id === managersStatus.myId ? 'border-l-2 border-primary-500' : ''}`}>
                    <div>
                      <span className={`font-medium ${m.id === managersStatus.myId ? 'text-primary-400' : 'text-gray-200'}`}>{m.username}</span>
                      {m.isCurrentTurn && <span className="text-xs text-primary-400 ml-1">(turno)</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-accent-400">{m.currentBudget}</p>
                      <p className="text-xs text-gray-500">{m.slotsFilled}/{m.totalSlots}</p>
                    </div>
                  </button>
                ))}
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
                        <div key={p.id} className="flex justify-between text-sm py-1">
                          <span className="text-gray-300">{p.playerName}</span>
                          <span className="text-accent-400 font-mono">{p.acquisitionPrice}</span>
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

      {/* Acknowledgment Modal */}
      {pendingAck && !pendingAck.userAcknowledged && (
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
                <span className={`w-10 h-10 rounded-full bg-gradient-to-br ${POSITION_COLORS[pendingAck.player.position]} flex items-center justify-center text-white font-bold`}>{pendingAck.player.position}</span>
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
              <textarea value={prophecyContent} onChange={e => setProphecyContent(e.target.value)} className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-3 text-white placeholder-gray-500 mb-4" rows={2} placeholder="Profezia (opzionale)..." maxLength={500} />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleAcknowledge(false)} disabled={ackSubmitting} className="flex-1 border-surface-50/30 text-gray-300">{ackSubmitting ? 'Invio...' : 'Conferma'}</Button>
                {prophecyContent.trim() && <Button onClick={() => handleAcknowledge(true)} disabled={ackSubmitting} className="flex-1 btn-primary">{ackSubmitting ? 'Invio...' : 'Con Profezia'}</Button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Modal */}
      {pendingAck && pendingAck.userAcknowledged && (
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
    </div>
  )
}
