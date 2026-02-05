import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { rubataApi, leagueApi, auctionApi, contractApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { usePusherAuction } from '../services/pusher.client'
import { ContractModifierModal } from '../components/ContractModifier'
import { PlayerStatsModal, type PlayerInfo, type ComputedSeasonStats } from '../components/PlayerStatsModal'

// Componente logo squadra
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

interface RubataProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface LeagueMember {
  id: string
  teamName?: string
  rubataOrder?: number
  currentBudget: number
  user: {
    id: string
    username: string
  }
}

interface BoardPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: 'P' | 'D' | 'C' | 'A'
  playerTeam: string
  playerQuotation?: number
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: unknown
  playerComputedStats?: ComputedSeasonStats | null
  ownerUsername: string
  ownerTeamName: string | null
  rubataPrice: number
  contractSalary: number
  contractDuration: number
  contractClause: number
  stolenById?: string | null
  stolenByUsername?: string | null
  stolenPrice?: number | null
}

interface ActiveAuction {
  id: string
  player: {
    id: string
    name: string
    team: string
    position: string
  }
  basePrice: number
  currentPrice: number
  sellerId: string
  bids: Array<{
    amount: number
    bidder: string
    bidderId: string
    isWinning: boolean
  }>
}

interface AuctionReadyInfo {
  bidderUsername: string
  playerName: string
  playerTeam: string
  playerPosition: string
  ownerUsername: string
  basePrice: number
}

interface RubataPreference {
  id: string
  playerId: string
  isWatchlist: boolean
  isAutoPass: boolean
  maxBid: number | null
  priority: number | null
  notes: string | null
}

interface MemberBudgetInfo {
  memberId: string
  teamName: string
  username: string
  currentBudget: number
  totalSalaries: number
  residuo: number
}

interface BoardPlayerWithPreference extends BoardPlayer {
  preference?: RubataPreference | null
}

interface BoardData {
  isRubataPhase: boolean
  board: BoardPlayer[] | null
  currentIndex: number | null
  currentPlayer: BoardPlayer | null
  totalPlayers: number
  rubataState: 'WAITING' | 'PREVIEW' | 'READY_CHECK' | 'OFFERING' | 'AUCTION_READY_CHECK' | 'AUCTION' | 'PENDING_ACK' | 'PAUSED' | 'COMPLETED' | null
  remainingSeconds: number | null
  offerTimerSeconds: number
  auctionTimerSeconds: number
  activeAuction: ActiveAuction | null
  auctionReadyInfo: AuctionReadyInfo | null
  // Pause info for resume ready check
  pausedRemainingSeconds: number | null
  pausedFromState: string | null
  memberBudgets?: MemberBudgetInfo[]
  sessionId: string | null
  myMemberId: string
  isAdmin: boolean
}

interface PreviewBoardData {
  board: BoardPlayerWithPreference[]
  totalPlayers: number
  rubataState: string
  isPreview: boolean
  myMemberId: string
  watchlistCount: number
  autoPassCount: number
}

interface ReadyStatus {
  rubataState: string | null
  readyMembers: Array<{ id: string; username: string; isConnected?: boolean }>
  pendingMembers: Array<{ id: string; username: string; isConnected?: boolean }>
  totalMembers: number
  readyCount: number
  allReady: boolean
  userIsReady: boolean
  myMemberId: string
  isAdmin: boolean
}

interface PendingAck {
  auctionId: string
  player: {
    id: string
    name: string
    team: string
    position: string
  }
  winner: { id: string; username: string } | null
  seller: { id: string; username: string }
  finalPrice: number
  acknowledgedMembers: Array<{ id: string; username: string }>
  pendingMembers: Array<{ id: string; username: string }>
  totalMembers: number
  totalAcknowledged: number
  userAcknowledged: boolean
  allAcknowledged: boolean
  prophecies?: Array<{ memberId: string; username: string; content: string; createdAt: string }>
}

const POSITION_COLORS: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  D: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  A: 'bg-red-500/20 text-red-400 border-red-500/30',
}

// Componente modale preferenze separato per evitare re-render del componente principale
interface PreferenceModalProps {
  player: BoardPlayerWithPreference
  onClose: () => void
  onSave: (data: { maxBid: number | null; priority: number | null; notes: string | null }) => Promise<void>
  onDelete: () => Promise<void>
  isSubmitting: boolean
}

function PreferenceModal({ player, onClose, onSave, onDelete, isSubmitting }: PreferenceModalProps) {
  const [formData, setFormData] = useState({
    maxBid: player.preference?.maxBid?.toString() || '',
    priority: player.preference?.priority?.toString() || '',
    notes: player.preference?.notes || '',
  })

  const handleSave = async () => {
    await onSave({
      maxBid: formData.maxBid ? parseInt(formData.maxBid) : null,
      priority: formData.priority ? parseInt(formData.priority) : null,
      notes: formData.notes || null,
    })
  }

  // Controlla se c'è almeno una strategia impostata
  const hasStrategy = formData.maxBid || formData.priority || formData.notes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-200 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-indigo-500/50">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white rounded p-1">
            <TeamLogo team={player.playerTeam} />
          </div>
          <div>
            <h3 className="font-bold text-white">{player.playerName}</h3>
            <p className="text-sm text-gray-400">{player.playerTeam} • {player.rubataPrice}M</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-full bg-surface-300 text-gray-400 hover:bg-surface-50/20 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Max bid with +/- buttons */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Budget massimo</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData(p => ({
                  ...p,
                  maxBid: String(Math.max(0, (parseInt(p.maxBid) || 0) - 5))
                }))}
                disabled={!formData.maxBid || parseInt(formData.maxBid) <= 0}
                className="w-10 h-10 rounded-lg bg-surface-300 border border-surface-50/30 text-white text-xl font-bold hover:bg-surface-50/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  value={formData.maxBid}
                  onChange={e => setFormData(p => ({ ...p, maxBid: e.target.value }))}
                  placeholder="—"
                  className="w-full text-center text-2xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-gray-500">milioni</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(p => ({
                  ...p,
                  maxBid: String((parseInt(p.maxBid) || 0) + 5)
                }))}
                className="w-10 h-10 rounded-lg bg-surface-300 border border-surface-50/30 text-white text-xl font-bold hover:bg-surface-50/20 transition-all"
              >
                +
              </button>
            </div>
            {formData.maxBid && (
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, maxBid: '' }))}
                className="mt-1 text-xs text-gray-500 hover:text-gray-400"
              >
                Rimuovi limite
              </button>
            )}
          </div>

          {/* Priority with star rating */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Priorità</label>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map(star => {
                const currentPriority = parseInt(formData.priority) || 0
                const isActive = star <= currentPriority
                return (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setFormData(p => ({
                      ...p,
                      priority: p.priority === String(star) ? '' : String(star)
                    }))}
                    className={`w-10 h-10 text-2xl transition-all transform hover:scale-110 ${
                      isActive ? 'text-purple-400' : 'text-gray-600 hover:text-purple-400/50'
                    }`}
                    title={`Priorità ${star}`}
                  >
                    {isActive ? '★' : '☆'}
                  </button>
                )
              })}
            </div>
            <p className="text-center text-xs text-gray-500 mt-1">
              {formData.priority ? `Priorità ${formData.priority} (clicca per rimuovere)` : 'Clicca per impostare'}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note private</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              placeholder="Appunti personali..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          {player.preference && (
            <Button
              onClick={onDelete}
              disabled={isSubmitting}
              variant="outline"
              className="border-danger-500/50 text-danger-400 hover:bg-danger-500/10"
            >
              Rimuovi
            </Button>
          )}
          <Button onClick={onClose} variant="outline" className="flex-1">
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="flex-1">
            Salva
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Rubata({ leagueId, onNavigate }: RubataProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [orderDraft, setOrderDraft] = useState<string[]>([])
  const [boardData, setBoardData] = useState<BoardData | null>(null)
  const [bidAmount, setBidAmount] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timerDisplay, setTimerDisplay] = useState<number | null>(null)

  // Timer settings
  const [offerTimer, setOfferTimer] = useState(30)
  const [auctionTimer, setAuctionTimer] = useState(15)

  // Budget panel
  const [budgetPanelOpen, setBudgetPanelOpen] = useState(true)
  const [mobileBudgetExpanded, setMobileBudgetExpanded] = useState(false)

  // Ready check and acknowledgment
  const [readyStatus, setReadyStatus] = useState<ReadyStatus | null>(null)
  const [pendingAck, setPendingAck] = useState<PendingAck | null>(null)

  // Admin simulation
  const [simulateMemberId, setSimulateMemberId] = useState('')
  const [simulateBidAmount, setSimulateBidAmount] = useState(0)

  // Steal announcement modal
  // Steal announcement modal removed - info now shown in AUCTION_READY_CHECK modal
  const [lastSeenAuctionId, setLastSeenAuctionId] = useState<string | null>(null)

  // Prophecy for transaction confirmation
  const [prophecyContent, setProphecyContent] = useState('')

  // Appeal / Ricorso state
  const [isAppealMode, setIsAppealMode] = useState(false)
  const [appealContent, setAppealContent] = useState('')
  const [appealStatus, setAppealStatus] = useState<{
    auctionId: string
    auctionStatus: string
    hasActiveAppeal: boolean
    appeal: {
      id: string
      status: string
      reason: string
      adminNotes?: string
      submittedBy?: { username: string }
    } | null
    winner?: { username: string }
    finalPrice?: number
    player?: { name: string; team: string; position: string }
    userHasAcked: boolean
    appealDecisionAcks: string[]
    allMembers: Array<{ id: string; username: string }>
    userIsReady: boolean
    resumeReadyMembers: string[]
  } | null>(null)

  // Session ID for Pusher subscription (we'll get this from boardData)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<PlayerInfo | null>(null)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Preview mode state
  const [previewBoard, setPreviewBoard] = useState<PreviewBoardData | null>(null)
  const [selectedPlayerForPrefs, setSelectedPlayerForPrefs] = useState<BoardPlayerWithPreference | null>(null)

  // Contract modification after rubata win
  interface ContractForModification {
    contractId: string
    rosterId: string
    playerId: string
    playerName: string
    playerTeam?: string
    playerPosition?: string
    salary: number
    duration: number
    initialSalary: number
    rescissionClause: number
  }
  const [pendingContractModification, setPendingContractModification] = useState<ContractForModification | null>(null)

  // Ref for current player row/card to scroll into view
  const currentPlayerRef = useRef<HTMLElement>(null)

  // Track if current player is visible in viewport (for "scroll to current" button)
  const [isCurrentPlayerVisible, setIsCurrentPlayerVisible] = useState(true)

  // Track if timers have been initialized (to avoid overwriting user changes)
  const timersInitialized = useRef(false)

  // Timer countdown effect
  useEffect(() => {
    if (!boardData) return

    if (boardData.rubataState === 'OFFERING' || boardData.rubataState === 'AUCTION') {
      setTimerDisplay(boardData.remainingSeconds)

      const interval = setInterval(() => {
        setTimerDisplay(prev => {
          if (prev === null || prev <= 0) return 0
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setTimerDisplay(null)
    }
  }, [boardData?.rubataState, boardData?.remainingSeconds])

  // Scroll to current player when it changes
  useEffect(() => {
    if (currentPlayerRef.current) {
      currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [boardData?.currentIndex])

  // IntersectionObserver to track if current player is visible
  useEffect(() => {
    const currentEl = currentPlayerRef.current
    if (!currentEl) {
      setIsCurrentPlayerVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCurrentPlayerVisible(entry.isIntersecting)
      },
      { threshold: 0.1 } // Consider visible if at least 10% is showing
    )

    observer.observe(currentEl)

    return () => {
      observer.disconnect()
    }
  }, [boardData?.currentIndex, boardData?.board])

  // Function to scroll to current player (for floating button)
  const scrollToCurrentPlayer = () => {
    if (currentPlayerRef.current) {
      currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Track auction ID to avoid showing duplicate modals (keeping for future use)
  useEffect(() => {
    if (boardData?.activeAuction && boardData.rubataState === 'AUCTION') {
      const auctionId = boardData.activeAuction.id
      if (auctionId !== lastSeenAuctionId) {
        setLastSeenAuctionId(auctionId)
        // Note: We no longer show the steal announcement modal here because
        // users already see all the info in the AUCTION_READY_CHECK modal
      }
    }
  }, [boardData?.activeAuction?.id, boardData?.rubataState, lastSeenAuctionId])

  // Auto-set bid amount to currentPrice + 1 when auction is active
  useEffect(() => {
    if (boardData?.activeAuction && boardData.rubataState === 'AUCTION') {
      const minBid = boardData.activeAuction.currentPrice + 1
      // Only update if current bidAmount is less than minBid (to not override user's higher input)
      if (bidAmount < minBid) {
        setBidAmount(minBid)
      }
      // Also update simulate bid amount for admin
      if (simulateBidAmount < minBid) {
        setSimulateBidAmount(minBid)
      }
    }
  }, [boardData?.activeAuction?.currentPrice, boardData?.rubataState])

  // Separate loading functions for optimized updates
  const loadBoardOnly = useCallback(async () => {
    const boardRes = await rubataApi.getBoard(leagueId)
    if (boardRes.success && boardRes.data) {
      setBoardData(boardRes.data as BoardData)
      const data = boardRes.data as BoardData
      // Only set timers on first load
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
      // If server transitioned to PENDING_ACK (e.g. auto-close during getRubataBoard),
      // immediately fetch ack data so the confirmation modal can display without waiting
      // for the next polling cycle (fixes #242)
      if (data.rubataState === 'PENDING_ACK') {
        const ackRes = await rubataApi.getPendingAck(leagueId)
        if (ackRes.success) {
          setPendingAck(ackRes.data as PendingAck | null)
        }
      }
    }
  }, [leagueId])

  const loadReadyOnly = useCallback(async () => {
    const readyRes = await rubataApi.getReadyStatus(leagueId)
    if (readyRes.success && readyRes.data) {
      setReadyStatus(readyRes.data as ReadyStatus)
    }
  }, [leagueId])

  const loadAckOnly = useCallback(async () => {
    const ackRes = await rubataApi.getPendingAck(leagueId)
    if (ackRes.success) {
      setPendingAck(ackRes.data as PendingAck | null)
    }
  }, [leagueId])

  // Fast refresh - only board and ready status (most common during auction)
  const loadFast = useCallback(async () => {
    const [boardRes, readyRes] = await Promise.all([
      rubataApi.getBoard(leagueId),
      rubataApi.getReadyStatus(leagueId),
    ])
    if (boardRes.success && boardRes.data) {
      setBoardData(boardRes.data as BoardData)
      const data = boardRes.data as BoardData
      // Only set timers on first load
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
      // If server auto-closed the auction during this getRubataBoard() call,
      // the state transitions to PENDING_ACK but we didn't fetch pendingAck data.
      // Fetch it immediately so the confirmation modal can display without waiting
      // for the next polling cycle (fixes #242)
      if (data.rubataState === 'PENDING_ACK') {
        const ackRes = await rubataApi.getPendingAck(leagueId)
        if (ackRes.success) {
          setPendingAck(ackRes.data as PendingAck | null)
        }
      }
    }
    if (readyRes.success && readyRes.data) {
      setReadyStatus(readyRes.data as ReadyStatus)
    }
  }, [leagueId])

  // Full refresh - all data (only on initial load and state transitions)
  const loadData = useCallback(async () => {
    const [boardRes, membersRes, leagueRes, readyRes, ackRes] = await Promise.all([
      rubataApi.getBoard(leagueId),
      leagueApi.getMembers(leagueId),
      leagueApi.getById(leagueId),
      rubataApi.getReadyStatus(leagueId),
      rubataApi.getPendingAck(leagueId),
    ])

    if (boardRes.success && boardRes.data) {
      setBoardData(boardRes.data as BoardData)
      const data = boardRes.data as BoardData
      // Only set timers on first load
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
      // Set session ID for Pusher subscription
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
    }
    if (membersRes.success && membersRes.data) {
      const data = membersRes.data as { members: LeagueMember[] }
      setMembers(data.members || [])
      if (orderDraft.length === 0) {
        setOrderDraft(data.members?.map(m => m.id) || [])
      }
    }
    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsAdmin(data.userMembership?.role === 'ADMIN')
    }
    if (readyRes.success && readyRes.data) {
      setReadyStatus(readyRes.data as ReadyStatus)
    }
    if (ackRes.success) {
      setPendingAck(ackRes.data as PendingAck | null)
    }
    setIsLoading(false)
  }, [leagueId, orderDraft.length])

  // Track Pusher connection for adaptive polling
  const { isConnected: isPusherConnected } = usePusherAuction(sessionId, {
    onRubataStealDeclared: (data) => {
      console.log('[Pusher] Rubata steal declared - fast refresh', data)
      // Steal declared - need board + ready status
      loadFast()
    },
    onRubataBidPlaced: (data) => {
      console.log('[Pusher] Rubata bid placed - instant update', data)
      // INSTANT UPDATE: Use event data to update UI immediately
      // Then fetch to confirm (non-blocking)
      if (data.bidderId !== boardData?.myMemberId) {
        // Only update if it's someone else's bid (our own bid is already optimistically shown)
        setBoardData(prev => {
          if (!prev?.activeAuction) return prev
          const newBid = {
            amount: data.amount,
            bidder: data.bidderUsername,
            bidderId: data.bidderId,
            isWinning: true,
          }
          return {
            ...prev,
            activeAuction: {
              ...prev.activeAuction,
              currentPrice: data.amount,
              bids: [
                newBid,
                ...prev.activeAuction.bids.map(b => ({ ...b, isWinning: false })),
              ],
            },
          }
        })
      }
      // Background refresh to ensure state consistency
      setTimeout(() => loadBoardOnly(), 100)
    },
    onRubataReadyChanged: (data) => {
      console.log('[Pusher] Rubata ready changed - instant update', data)
      // INSTANT UPDATE: Update ready status from event data
      setReadyStatus(prev => {
        if (!prev) return prev
        const isMyUpdate = data.memberId === boardData?.myMemberId
        if (isMyUpdate) return prev // Our own update is already reflected

        return {
          ...prev,
          readyCount: data.readyCount,
          allReady: data.readyCount >= data.totalMembers,
        }
      })
      // Background refresh to get full member list
      setTimeout(() => loadReadyOnly(), 100)
    },
    onAuctionClosed: () => {
      console.log('[Pusher] Auction closed - full refresh')
      // State transition - need full refresh including ack
      loadData()
    },
  })

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Adaptive polling - much slower when Pusher is connected (acts as fallback only)
  useEffect(() => {
    const getPollingInterval = () => {
      const state = boardData?.rubataState

      // When Pusher is connected, use longer intervals (fallback only)
      if (isPusherConnected) {
        if (state === 'AUCTION') return 3000  // Fallback during auction
        if (state === 'AUCTION_READY_CHECK') return 3000
        if (state === 'OFFERING') return 3000
        return 5000  // Long fallback for other states
      }

      // Without Pusher, use shorter intervals
      if (state === 'AUCTION') return 800
      if (state === 'AUCTION_READY_CHECK') return 1000
      if (state === 'OFFERING') return 1500
      return 3000
    }

    const interval = setInterval(() => {
      // During active states, use fast refresh; otherwise full refresh
      const state = boardData?.rubataState
      if (state === 'AUCTION' || state === 'AUCTION_READY_CHECK') {
        loadFast()
      } else if (state === 'PENDING_ACK') {
        loadAckOnly()
      } else {
        loadBoardOnly()
      }
    }, getPollingInterval())

    return () => clearInterval(interval)
  }, [loadBoardOnly, loadFast, loadAckOnly, boardData?.rubataState, isPusherConnected])

  // Send heartbeat every 3 seconds to track connection status
  useEffect(() => {
    const myId = boardData?.myMemberId || readyStatus?.myMemberId
    if (!myId) return

    const sendHeartbeat = async () => {
      try {
        await rubataApi.sendHeartbeat(leagueId, myId)
      } catch (e) {
        // Ignore heartbeat errors
        console.error('[Rubata] Heartbeat error:', e)
      }
    }

    // Send immediately on mount
    sendHeartbeat()

    // Then every 3 seconds
    const interval = setInterval(sendHeartbeat, 3000)
    return () => clearInterval(interval)
  }, [leagueId, boardData?.myMemberId, readyStatus?.myMemberId])

  // ========== Admin Actions ==========

  async function handleSetOrder() {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await rubataApi.setOrder(leagueId, orderDraft)
    if (res.success) {
      setSuccess('Ordine rubata impostato!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleGenerateBoard() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.generateBoard(leagueId)
    if (res.success) {
      setSuccess('Tabellone generato!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleStartRubata() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.start(leagueId)
    if (res.success) {
      setSuccess('Rubata avviata!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleUpdateTimers() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.updateTimers(leagueId, offerTimer, auctionTimer)
    if (res.success) {
      setSuccess('Timer aggiornati!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handlePause() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.pause(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleResume() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.resume(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleAdvance() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.advance(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleGoBack() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.goBack(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseAuction() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.closeCurrentAuction(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Asta chiusa!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCompleteRubata() {
    if (!confirm('Vuoi completare la rubata con transazioni casuali? Questo è irreversibile.')) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.completeWithTransactions(leagueId, 0.3)
    if (res.success) {
      setSuccess(res.message || 'Rubata completata!')
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== Player Actions ==========

  async function handleMakeOffer() {
    if (!currentPlayer) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.makeOffer(leagueId)
    if (res.success) {
      // State will change to AUCTION_READY_CHECK and the modal will show automatically
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBid() {
    const myId = boardData?.myMemberId
    if (!bidAmount || !boardData?.activeAuction || !myId) return
    setError('')
    setIsSubmitting(true)

    // Find current user info for optimistic update
    const currentUser = members.find(m => m.id === myId)
    const currentUsername = currentUser?.user?.username || 'Tu'

    // OPTIMISTIC UPDATE: Immediately show the bid in UI
    const previousBoardData = boardData
    const optimisticBid = {
      amount: bidAmount,
      bidder: currentUsername,
      bidderId: myId,
      isWinning: true,
    }

    setBoardData(prev => {
      if (!prev?.activeAuction) return prev
      return {
        ...prev,
        activeAuction: {
          ...prev.activeAuction,
          currentPrice: bidAmount,
          bids: [
            optimisticBid,
            ...prev.activeAuction.bids.map(b => ({ ...b, isWinning: false })),
          ],
        },
      }
    })

    // Reset bid amount immediately for better UX
    const submittedAmount = bidAmount
    setBidAmount(bidAmount + 1)

    // Send to server
    const res = await rubataApi.bidOnAuction(leagueId, submittedAmount)
    if (res.success) {
      // Bid accepted - refresh to get official state (non-blocking)
      loadBoardOnly()
    } else {
      // REVERT: Restore previous state on error
      setBoardData(previousBoardData)
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== Ready Check ==========

  async function handleSetReady() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.setReady(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceAllReady() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.forceAllReady(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== Transaction Acknowledgment ==========

  async function handleAcknowledge() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.acknowledge(leagueId, prophecyContent.trim() || undefined)
    if (res.success) {
      setProphecyContent('')

      // Check if there's contract info for modification (winner only)
      const data = res.data as { winnerContractInfo?: ContractForModification } | undefined
      if (data?.winnerContractInfo) {
        // Store player info from pendingAck for the modal
        const playerInfo = pendingAck?.player
        setPendingContractModification({
          ...data.winnerContractInfo,
          playerTeam: playerInfo?.team,
          playerPosition: playerInfo?.position,
        })
      }

      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceAllAcknowledge() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.forceAllAcknowledge(leagueId)
    if (res.success) {
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== Appeal / Ricorso Functions ==========

  const loadAppealStatus = useCallback(async () => {
    if (pendingAck?.auctionId) {
      const result = await auctionApi.getAppealStatus(pendingAck.auctionId)
      if (result.success && result.data) {
        setAppealStatus(result.data as typeof appealStatus)
      } else {
        setAppealStatus(null)
      }
    } else {
      setAppealStatus(null)
    }
  }, [pendingAck?.auctionId])

  // Load appeal status when pendingAck changes
  useEffect(() => {
    loadAppealStatus()
    const interval = setInterval(loadAppealStatus, 5000)
    return () => clearInterval(interval)
  }, [loadAppealStatus])

  async function handleAcknowledgeWithAppeal() {
    if (!pendingAck) return
    setError('')
    setIsSubmitting(true)

    // Se c'è un ricorso, invialo prima
    if (isAppealMode && appealContent.trim()) {
      const appealResult = await auctionApi.submitAppeal(pendingAck.auctionId, appealContent.trim())
      if (!appealResult.success) {
        setError(appealResult.message || 'Errore nell\'invio del ricorso')
        setIsSubmitting(false)
        return
      }
      setSuccess('Ricorso inviato!')
    }

    // Conferma comunque la visione
    const res = await rubataApi.acknowledge(leagueId, prophecyContent.trim() || undefined)
    if (res.success) {
      setProphecyContent('')
      setAppealContent('')
      setIsAppealMode(false)

      // Check if there's contract info for modification (winner only)
      const data = res.data as { winnerContractInfo?: ContractForModification } | undefined
      if (data?.winnerContractInfo) {
        const playerInfo = pendingAck?.player
        setPendingContractModification({
          ...data.winnerContractInfo,
          playerTeam: playerInfo?.team,
          playerPosition: playerInfo?.position,
        })
      }

      loadData()
      loadAppealStatus()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleAcknowledgeAppealDecision() {
    if (!appealStatus?.auctionId) return
    setIsSubmitting(true)

    const result = await auctionApi.acknowledgeAppealDecision(appealStatus.auctionId)
    if (result.success) {
      loadAppealStatus()
      loadData()
    } else {
      setError(result.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleMarkReadyToResume() {
    if (!appealStatus?.auctionId) return
    setIsSubmitting(true)

    const result = await auctionApi.markReadyToResume(appealStatus.auctionId)
    if (result.success) {
      loadAppealStatus()
      loadData()
    } else {
      setError(result.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceAllAppealAcks() {
    if (!appealStatus?.auctionId) return
    setIsSubmitting(true)

    const result = await auctionApi.forceAllAppealAcks(appealStatus.auctionId)
    if (result.success) {
      loadAppealStatus()
      loadData()
    } else {
      setError(result.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceAllReadyResume() {
    if (!appealStatus?.auctionId) return
    setIsSubmitting(true)

    const result = await auctionApi.forceAllReadyResume(appealStatus.auctionId)
    if (result.success) {
      loadAppealStatus()
      loadData()
    } else {
      setError(result.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateAppeal() {
    if (!pendingAck?.auctionId) return

    const result = await auctionApi.simulateAppeal(leagueId, pendingAck.auctionId)
    if (result.success) {
      setSuccess('Ricorso simulato!')
      loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  // ========== Contract Modification (Post-Rubata Win) ==========

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!pendingContractModification?.contractId) return

    const res = await contractApi.modify(pendingContractModification.contractId, newSalary, newDuration)
    if (res.success) {
      setPendingContractModification(null)
      loadData()
    } else {
      setError(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    setPendingContractModification(null)
  }

  // ========== Admin Simulation ==========

  async function handleSimulateOffer() {
    if (!simulateMemberId || !currentPlayer) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.simulateOffer(leagueId, simulateMemberId)
    if (res.success) {
      // State will change to AUCTION_READY_CHECK and the modal will show automatically
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleSimulateBid() {
    if (!simulateMemberId || !simulateBidAmount) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.simulateBid(leagueId, simulateMemberId, simulateBidAmount)
    if (res.success) {
      setSuccess('Offerta simulata!')
      setSimulateBidAmount(0)
      loadData()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== Preview Mode ==========

  async function loadPreviewBoard() {
    const res = await rubataApi.getPreviewBoard(leagueId)
    if (res.success && res.data) {
      setPreviewBoard(res.data as PreviewBoardData)
    }
  }

  async function handleSetToPreview() {
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.setToPreview(leagueId)
    if (res.success) {
      setSuccess('Tabellone in modalità preview!')
      loadData()
      loadPreviewBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  function openPrefsModal(player: BoardPlayerWithPreference) {
    setSelectedPlayerForPrefs(player)
  }

  function closePrefsModal() {
    setSelectedPlayerForPrefs(null)
  }

  async function handleSavePreference(data: { maxBid: number | null; priority: number | null; notes: string | null }) {
    if (!selectedPlayerForPrefs) return
    setError('')
    setIsSubmitting(true)

    // isWatchlist è derivato automaticamente: true se c'è almeno una strategia
    const hasStrategy = data.maxBid !== null || data.priority !== null || !!(data.notes && data.notes.trim() !== '')
    const res = await rubataApi.setPreference(leagueId, selectedPlayerForPrefs.playerId, {
      ...data,
      isWatchlist: hasStrategy,
      isAutoPass: false, // Non più usato
    })

    if (res.success) {
      setSuccess('Preferenza salvata!')
      loadPreviewBoard()
      closePrefsModal()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleDeletePreference() {
    if (!selectedPlayerForPrefs) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.deletePreference(leagueId, selectedPlayerForPrefs.playerId)
    if (res.success) {
      setSuccess('Preferenza rimossa!')
      loadPreviewBoard()
      closePrefsModal()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // Load preferences whenever there's a board (for all states)
  useEffect(() => {
    if (boardData?.isRubataPhase && boardData?.board && boardData.board.length > 0) {
      loadPreviewBoard()
    }
  }, [boardData?.isRubataPhase, boardData?.board?.length])

  // Create a map of preferences by playerId for quick lookup (memoized)
  const preferencesMap = useMemo(() => {
    const map = new Map<string, RubataPreference>()
    if (previewBoard?.board) {
      previewBoard.board.forEach(p => {
        if (p.preference) {
          map.set(p.playerId, p.preference)
        }
      })
    }
    return map
  }, [previewBoard?.board])

  // Calculate progress stats for rubata (memoized)
  const progressStats = useMemo(() => {
    const board = boardData?.board
    if (!board || boardData?.currentIndex === null || boardData?.currentIndex === undefined) {
      return null
    }

    const currentIndex = boardData.currentIndex
    const totalPlayers = board.length
    const remaining = totalPlayers - currentIndex - 1

    // Find current manager's players
    const currentPlayer = boardData.currentPlayer
    const currentManagerId = currentPlayer?.memberId
    if (!currentManagerId) {
      return { currentIndex, totalPlayers, remaining, managerProgress: null }
    }

    // Get all players for current manager
    const managerPlayers = board.filter(p => p.memberId === currentManagerId)
    const managerTotal = managerPlayers.length

    // Count how many of current manager's players have been processed
    let managerProcessed = 0
    for (let i = 0; i <= currentIndex; i++) {
      if (board[i].memberId === currentManagerId) {
        managerProcessed++
      }
    }

    return {
      currentIndex,
      totalPlayers,
      remaining,
      managerProgress: {
        processed: managerProcessed,
        total: managerTotal,
        username: currentPlayer.ownerUsername
      }
    }
  }, [boardData?.board, boardData?.currentIndex, boardData?.currentPlayer])

  // ========== Drag & Drop ==========

  function moveInOrder(index: number, direction: 'up' | 'down') {
    const newOrder = [...orderDraft]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newOrder.length) return
    const temp = newOrder[index]
    const swapWith = newOrder[newIndex]
    if (temp !== undefined && swapWith !== undefined) {
      newOrder[index] = swapWith
      newOrder[newIndex] = temp
    }
    setOrderDraft(newOrder)
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    const target = e.currentTarget as HTMLElement
    setTimeout(() => {
      target.style.opacity = '0.5'
    }, 0)
  }

  function handleDragEnd(e: React.DragEvent) {
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newOrder = [...orderDraft]
    const draggedItem = newOrder[draggedIndex]
    if (!draggedItem) return

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(dropIndex, 0, draggedItem)

    setOrderDraft(newOrder)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // ========== Render ==========

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  const isRubataPhase = boardData?.isRubataPhase || false
  const board = boardData?.board
  const isOrderSet = board && board.length > 0
  const rubataState = boardData?.rubataState
  const currentPlayer = boardData?.currentPlayer
  const activeAuction = boardData?.activeAuction
  const myMemberId = boardData?.myMemberId
  const canMakeOffer = rubataState === 'OFFERING' && currentPlayer && currentPlayer.memberId !== myMemberId

  // Get preference for current player
  const currentPlayerPreference = currentPlayer ? preferencesMap.get(currentPlayer.playerId) : null

  // Check if preferences can be edited (before auction starts or when paused)
  // Allowed: null (before start), WAITING, PREVIEW, READY_CHECK, PAUSED, AUCTION_READY_CHECK
  const canEditPreferences = !rubataState ||
    rubataState === 'WAITING' ||
    rubataState === 'PREVIEW' ||
    rubataState === 'READY_CHECK' ||
    rubataState === 'PAUSED' ||
    rubataState === 'AUCTION_READY_CHECK'

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="rubata" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Transaction Confirmation Modal - Non mostrare se c'è un ricorso attivo */}
      {rubataState === 'PENDING_ACK' && pendingAck && !pendingAck.userAcknowledged &&
       !['APPEAL_REVIEW', 'AWAITING_APPEAL_ACK', 'AWAITING_RESUME'].includes(appealStatus?.auctionStatus || '') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-br from-purple-900 to-purple-950 rounded-3xl p-6 max-w-lg w-full shadow-2xl border-2 border-purple-400 animate-bounce-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-3">
                <span className="text-4xl">{pendingAck.winner ? '🎯' : '🛡️'}</span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                {pendingAck.winner ? 'RUBATA COMPLETATA!' : 'NESSUNA RUBATA'}
              </h2>
              <p className="text-purple-200 text-sm mt-1">Conferma la transazione per procedere</p>
            </div>

            {/* Player Card */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white rounded p-1">
                  <TeamLogo team={pendingAck.player.team} />
                </div>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[pendingAck.player.position as keyof typeof POSITION_COLORS] || 'bg-gray-500/20 text-gray-400'} border-2`}>
                  <span className="font-bold">{pendingAck.player.position}</span>
                </div>
              </div>
              <p className="text-center text-2xl font-bold text-white">{pendingAck.player.name}</p>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-300 uppercase">Da</p>
                <p className="font-bold text-white">{pendingAck.seller.username}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-300 uppercase">A</p>
                <p className="font-bold text-secondary-400">{pendingAck.winner?.username || 'Nessuno'}</p>
              </div>
            </div>

            {/* Price */}
            {pendingAck.winner && (
              <div className="bg-white/10 rounded-xl p-3 text-center mb-4">
                <p className="text-xs text-purple-300 uppercase">Prezzo Finale</p>
                <p className="text-3xl font-black text-accent-400">{pendingAck.finalPrice}M</p>
              </div>
            )}

            {/* Confirmation Status */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-purple-200 text-sm">Conferme</span>
                <span className="text-white font-bold">{pendingAck.totalAcknowledged} / {pendingAck.totalMembers}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-secondary-500 transition-all duration-500"
                  style={{ width: `${(pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100}%` }}
                />
              </div>

              {/* Members List */}
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {pendingAck.acknowledgedMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary-500/20 text-sm">
                    <span className="text-secondary-400">✓</span>
                    <span className="text-white truncate">{member.username}</span>
                  </div>
                ))}
                {pendingAck.pendingMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                    <span className="text-gray-500">○</span>
                    <span className="text-gray-400 truncate">{member.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Existing Prophecies */}
            {pendingAck.prophecies && pendingAck.prophecies.length > 0 && (
              <div className="bg-white/5 rounded-xl p-3 mb-4">
                <p className="text-xs text-purple-300 uppercase font-bold mb-2 flex items-center gap-1">
                  <span>🔮</span> Profezie
                </p>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {pendingAck.prophecies.map((p, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-2">
                      <p className="text-sm text-white">{p.content}</p>
                      <p className="text-xs text-gray-500 mt-1">— {p.username}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appeal Mode Input */}
            {isAppealMode && (
              <div className="mb-4">
                <label className="block text-xs text-danger-300 uppercase font-bold mb-2">
                  ⚠️ Motivo del ricorso
                </label>
                <textarea
                  value={appealContent}
                  onChange={(e) => setAppealContent(e.target.value)}
                  className="w-full bg-danger-500/10 border border-danger-500/30 rounded-xl p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-danger-400 focus:outline-none"
                  rows={3}
                  placeholder="Descrivi il motivo del ricorso..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{appealContent.length}/500</p>
              </div>
            )}

            {/* Prophecy Input (only if not in appeal mode) */}
            {!isAppealMode && (
              <div className="mb-4">
                <label className="block text-xs text-purple-300 uppercase font-bold mb-2">
                  🔮 La tua profezia (opzionale)
                </label>
                <textarea
                  value={prophecyContent}
                  onChange={(e) => setProphecyContent(e.target.value)}
                  className="w-full bg-white/5 border border-purple-500/30 rounded-xl p-3 text-white placeholder-gray-500 text-sm resize-none focus:border-purple-400 focus:outline-none"
                  rows={2}
                  placeholder="Scrivi una previsione su questa transazione..."
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{prophecyContent.length}/200</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {!isAppealMode ? (
                <>
                  <Button onClick={handleAcknowledgeWithAppeal} disabled={isSubmitting} className="w-full py-3 text-lg">
                    {prophecyContent.trim() ? '🔮 CONFERMA CON PROFEZIA' : '✅ CONFERMA TRANSAZIONE'}
                  </Button>
                  <button
                    onClick={() => setIsAppealMode(true)}
                    className="w-full py-2 text-sm text-danger-400 hover:text-danger-300 underline"
                  >
                    ⚠️ Voglio fare ricorso
                  </button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleAcknowledgeWithAppeal}
                    disabled={isSubmitting || !appealContent.trim()}
                    className="w-full py-3 text-lg bg-danger-500 hover:bg-danger-600"
                  >
                    ⚠️ INVIA RICORSO E CONFERMA
                  </Button>
                  <button
                    onClick={() => { setIsAppealMode(false); setAppealContent('') }}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white"
                  >
                    Annulla ricorso
                  </button>
                </>
              )}

              {/* Admin: Simula ricorso */}
              {isAdmin && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <button
                    onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                    className="w-full py-2 text-xs text-purple-400 hover:text-purple-300"
                  >
                    📋 Vai al pannello ricorsi
                  </button>
                  <Button onClick={handleSimulateAppeal} disabled={isSubmitting} variant="outline" className="w-full text-xs border-danger-500/50 text-danger-400">
                    🤖 [TEST] Simula ricorso di un DG
                  </Button>
                  <Button onClick={handleForceAllAcknowledge} disabled={isSubmitting} variant="outline" className="w-full text-xs">
                    🤖 [TEST] Forza Tutte le Conferme
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPEAL_REVIEW Modal - Transazione sospesa in attesa decisione admin */}
      {(appealStatus?.auctionStatus === 'APPEAL_REVIEW') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-danger-900 to-danger-950 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-danger-500">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">Ricorso in Corso</h2>
                <p className="text-danger-200 mt-1">La transazione è sospesa in attesa della decisione dell'admin</p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              {/* Appeal details */}
              {appealStatus?.appeal && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 mb-4">
                  <p className="text-xs text-danger-300 uppercase font-bold mb-2">Motivo del ricorso</p>
                  <p className="text-gray-200">{appealStatus.appeal.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span></p>
                </div>
              )}

              {/* Transaction info */}
              {appealStatus?.winner && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 text-center">
                  <p className="text-sm text-danger-300">Transazione contestata</p>
                  <p className="text-lg font-bold text-white">{appealStatus.winner.username}</p>
                  <p className="text-2xl font-black text-accent-400 mt-1">{appealStatus.finalPrice}M</p>
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
      {(appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-surface-200 to-surface-300 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-surface-50/30">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus?.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
                  <span className="text-4xl">{appealStatus?.appeal?.status === 'ACCEPTED' ? '🔄' : '✅'}</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">
                  Ricorso {appealStatus?.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {appealStatus?.appeal?.status === 'ACCEPTED'
                    ? 'La transazione è stata annullata, l\'asta riprenderà'
                    : 'La transazione è confermata'}
                </p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {appealStatus?.appeal?.adminNotes && (
                <div className="bg-white/10 border border-white/20 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
                  <p className="text-gray-200">{appealStatus.appeal.adminNotes}</p>
                </div>
              )}

              {/* Ack progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme presa visione</span>
                  <span className="text-white">{appealStatus?.appealDecisionAcks?.length || 0}/{appealStatus?.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${((appealStatus?.appealDecisionAcks?.length || 0) / (appealStatus?.allMembers?.length || 1)) * 100}%` }}
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
                  disabled={isSubmitting}
                  className="w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3 text-lg"
                >
                  {isSubmitting ? 'Invio...' : 'Ho preso visione'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Hai confermato - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllAppealAcks}
                  disabled={isSubmitting}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  🤖 [TEST] Forza Tutte Conferme Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_RESUME Modal - Ready check prima di riprendere l'asta */}
      {(appealStatus?.auctionStatus === 'AWAITING_RESUME') && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-accent-900 to-orange-950 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-4 border-accent-500 animate-pulse-slow">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <span className="text-4xl">🔔</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase">Pronto a Riprendere?</h2>
                <p className="text-orange-200 mt-1">L'asta sta per riprendere, conferma la tua presenza</p>
              </div>

              {/* Player info */}
              {appealStatus?.player && (
                <div className="bg-white/10 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${POSITION_COLORS[appealStatus.player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    <span className="font-bold">{appealStatus.player.position}</span>
                  </div>
                  <div className="w-8 h-8 bg-white rounded p-0.5 flex-shrink-0">
                    <TeamLogo team={appealStatus.player.team} />
                  </div>
                  <div>
                    <p className="font-bold text-white">{appealStatus.player.name}</p>
                    <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                  </div>
                </div>
              )}

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 mb-4 text-center">
                <p className="text-warning-400 font-medium">
                  Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
                </p>
              </div>

              {/* Ready progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">DG pronti</span>
                  <span className="text-white">{appealStatus?.resumeReadyMembers?.length || 0}/{appealStatus?.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-500 to-orange-500 transition-all duration-500"
                    style={{ width: `${((appealStatus?.resumeReadyMembers?.length || 0) / (appealStatus?.allMembers?.length || 1)) * 100}%` }}
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
                  onClick={handleMarkReadyToResume}
                  disabled={isSubmitting}
                  className="w-full btn-accent py-3 text-lg font-bold"
                >
                  {isSubmitting ? 'Attendi...' : 'SONO PRONTO'}
                </Button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-secondary-400 font-medium mb-2">✓ Pronto - In attesa degli altri</p>
                </div>
              )}

              {/* Admin test button */}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceAllReadyResume}
                  disabled={isSubmitting}
                  className="w-full mt-3 border-accent-500/50 text-accent-400"
                >
                  🤖 [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auction Ready Check Modal - Before Auction Starts */}
      {rubataState === 'AUCTION_READY_CHECK' && boardData?.auctionReadyInfo && readyStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-br from-orange-900 to-orange-950 rounded-3xl p-6 max-w-lg w-full shadow-2xl border-4 border-orange-400 animate-bounce-in">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4 animate-pulse">
                <span className="text-6xl">🎯</span>
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-wide">
                RUBATA!
              </h2>
              <p className="text-orange-200 text-sm mt-2">Qualcuno vuole rubare questo giocatore!</p>
            </div>

            {/* Bidder Info */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <p className="text-center text-orange-200 text-sm uppercase tracking-wider mb-2">
                Volontà di rubare di
              </p>
              <p className="text-center text-3xl font-black text-white">
                {boardData.auctionReadyInfo.bidderUsername}
              </p>
            </div>

            {/* Player Info */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white rounded p-1">
                  <TeamLogo team={boardData.auctionReadyInfo.playerTeam} />
                </div>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${POSITION_COLORS[boardData.auctionReadyInfo.playerPosition as keyof typeof POSITION_COLORS] || 'bg-gray-500/20 text-gray-400'} border-2`}>
                  <span className="font-bold">{boardData.auctionReadyInfo.playerPosition}</span>
                </div>
              </div>
              <p className="text-center text-2xl font-bold text-white">
                {boardData.auctionReadyInfo.playerName}
              </p>
              <p className="text-center text-orange-200">
                di <span className="font-semibold text-white">{boardData.auctionReadyInfo.ownerUsername}</span>
              </p>
            </div>

            {/* Price */}
            <div className="text-center mb-4">
              <p className="text-orange-200 text-sm uppercase tracking-wider mb-1">
                Prezzo rubata
              </p>
              <p className="text-4xl font-black text-white">
                {boardData.auctionReadyInfo.basePrice}M
              </p>
            </div>

            {/* Ready Status */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-orange-200 text-sm font-bold uppercase">Manager Pronti</span>
                <span className="text-white font-bold">{readyStatus.readyCount} / {readyStatus.totalMembers}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                />
              </div>

              {/* Members List */}
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {readyStatus.readyMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary-500/20 text-sm">
                    <div className="relative flex-shrink-0">
                      <span className="text-secondary-400">✓</span>
                      <span
                        className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-surface-200 ${
                          member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        title={member.isConnected ? 'Online' : 'Offline'}
                      />
                    </div>
                    <span className="text-white truncate">{member.username}</span>
                  </div>
                ))}
                {readyStatus.pendingMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-sm">
                    <div className="relative flex-shrink-0">
                      <span className="text-gray-500">○</span>
                      <span
                        className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-surface-200 ${
                          member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        title={member.isConnected ? 'Online' : 'Offline'}
                      />
                    </div>
                    <span className="text-gray-400 truncate">{member.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {!readyStatus.userIsReady ? (
                <Button onClick={handleSetReady} disabled={isSubmitting} className="w-full py-3 text-lg bg-orange-500 hover:bg-orange-600">
                  ✅ SONO PRONTO PER L'ASTA!
                </Button>
              ) : (
                <div className="w-full py-3 bg-secondary-500/20 border border-secondary-500/40 rounded-xl text-secondary-400 font-bold text-center">
                  ✓ Sei pronto - attendi gli altri manager
                </div>
              )}
              {isAdmin && (
                <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" className="w-full border-orange-500/50 text-orange-400">
                  [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4">{success}</div>
        )}

        {/* Fase non RUBATA */}
        {!isRubataPhase && (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-warning-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">🎯</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Fase RUBATA non attiva</h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              La fase rubata inizierà dopo il consolidamento dei contratti.
              Attendi che l'admin della lega passi alla fase RUBATA.
            </p>
          </div>
        )}

        {/* Fase RUBATA - Setup ordine (Admin) */}
        {isRubataPhase && !isOrderSet && isAdmin && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Order Management */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Ordine Rubata
                </h3>
                <p className="text-sm text-gray-400 mt-1">Trascina i manager per impostare l'ordine dei turni</p>
              </div>
              <div className="p-5">
                <div className="space-y-2 mb-4">
                  {orderDraft.map((memberId, index) => {
                    const member = members.find(m => m.id === memberId)
                    const isDragging = draggedIndex === index
                    const isDragOver = dragOverIndex === index
                    return (
                      <div
                        key={memberId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`flex items-center justify-between p-3 bg-surface-300 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing ${
                          isDragging
                            ? 'border-primary-500 opacity-50 scale-95'
                            : isDragOver
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-50/20 hover:border-primary-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 cursor-grab active:cursor-grabbing">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                            </svg>
                          </span>
                          <span className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm">
                            {index + 1}
                          </span>
                          <span className="text-white font-medium">{member?.user?.username || member?.teamName || 'Unknown'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveInOrder(index, 'up')}
                            disabled={index === 0}
                            className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveInOrder(index, 'down')}
                            disabled={index === orderDraft.length - 1}
                            className="w-8 h-8 flex items-center justify-center bg-surface-50/10 hover:bg-surface-50/20 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button onClick={handleSetOrder} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Salvando...' : 'Conferma Ordine'}
                </Button>
              </div>
            </div>

            {/* Timer Settings */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              <div className="p-5 border-b border-surface-50/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">⏱️</span>
                  Impostazioni Timer
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Timer offerta iniziale (secondi)</label>
                  <input
                    type="number"
                    value={offerTimer}
                    onChange={(e) => setOfferTimer(parseInt(e.target.value) || 30)}
                    min={5}
                    max={120}
                    className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Timer asta (secondi)</label>
                  <input
                    type="number"
                    value={auctionTimer}
                    onChange={(e) => setAuctionTimer(parseInt(e.target.value) || 15)}
                    min={5}
                    max={60}
                    className="w-full px-4 py-2 bg-surface-300 border border-surface-50/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <Button onClick={handleUpdateTimers} disabled={isSubmitting} variant="outline" className="w-full">
                  Salva Timer
                </Button>
                <hr className="border-surface-50/20" />
                <Button onClick={handleGenerateBoard} disabled={isSubmitting} className="w-full">
                  Genera Tabellone
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fase RUBATA ma ordine non impostato - Vista per non-admin */}
        {isRubataPhase && !isOrderSet && !isAdmin && (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl animate-pulse">⏳</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">In attesa dell'ordine rubata</h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              L'admin della lega sta impostando l'ordine di rubata.
              Una volta confermato, potrai vedere il tabellone e partecipare alle aste.
            </p>
          </div>
        )}

        {/* Tabellone e controlli - Board generato */}
        {isRubataPhase && isOrderSet && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Sidebar - Budget + Admin controls */}
            <div className="hidden lg:block lg:col-span-1 space-y-4">
              {/* Budget Residuo Panel - visible to all */}
              {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && (
                <div className="bg-surface-200 rounded-2xl border border-primary-500/50 overflow-hidden sticky top-20">
                  <div className="p-3 border-b border-surface-50/20 bg-primary-500/10">
                    <h3 className="font-bold text-primary-400 text-sm flex items-center gap-2">
                      <span>💰</span>
                      Budget Residuo
                    </h3>
                  </div>
                  <div className="p-2 space-y-1">
                    {boardData.memberBudgets.map((mb, idx) => (
                      <div
                        key={mb.memberId}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${
                          idx === 0 ? 'bg-accent-500/10 border border-accent-500/20' :
                          mb.residuo < 0 ? 'bg-danger-500/10' :
                          mb.residuo < 50 ? 'bg-warning-500/5' :
                          'bg-surface-300/30'
                        }`}
                      >
                        <span className="text-xs text-gray-400 truncate flex-1">{mb.teamName}</span>
                        <span className={`text-sm font-bold ml-2 ${
                          mb.residuo < 0 ? 'text-danger-400' :
                          mb.residuo < 50 ? 'text-warning-400' :
                          'text-accent-400'
                        }`}>
                          {mb.residuo}M
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin-only panels */}
              {isAdmin && (<>
              {/* Timer Settings Panel */}
                {/* Timer Settings Panel */}
                <div className="bg-surface-200 rounded-2xl border border-accent-500/50 overflow-hidden">
                  <div className="p-3 border-b border-surface-50/20 bg-accent-500/10">
                    <h3 className="font-bold text-accent-400 flex items-center gap-2">
                      <span>⏱️</span>
                      Timer
                    </h3>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-1">Offerta (sec)</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setOfferTimer(prev => Math.max(5, prev - 5))}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >−</button>
                        <input
                          type="number"
                          value={offerTimer}
                          onChange={(e) => setOfferTimer(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
                        />
                        <button
                          onClick={() => setOfferTimer(prev => prev + 5)}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-1">Asta (sec)</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAuctionTimer(prev => Math.max(5, prev - 5))}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >−</button>
                        <input
                          type="number"
                          value={auctionTimer}
                          onChange={(e) => setAuctionTimer(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
                        />
                        <button
                          onClick={() => setAuctionTimer(prev => prev + 5)}
                          className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
                        >+</button>
                      </div>
                    </div>
                    <Button
                      onClick={handleUpdateTimers}
                      disabled={isSubmitting}
                      size="sm"
                      className="w-full"
                    >
                      💾 Salva
                    </Button>
                  </div>
                </div>

                {/* Bot Simulation Panel */}
                {(rubataState === 'OFFERING' || rubataState === 'AUCTION') && (
                  <div className="bg-surface-200 rounded-2xl border border-orange-500/50 overflow-hidden">
                    <div className="p-4 border-b border-surface-50/20 bg-orange-500/10">
                      <h3 className="font-bold text-orange-400 flex items-center gap-2">
                        <span>🤖</span>
                        Simula Bot
                      </h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-1">Manager</label>
                        <select
                          value={simulateMemberId}
                          onChange={(e) => setSimulateMemberId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm"
                        >
                          <option value="">-- Seleziona --</option>
                          {members
                            .filter(m => m.id !== myMemberId && m.id !== currentPlayer?.memberId)
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.user?.username || m.teamName || 'Unknown'}
                              </option>
                            ))}
                        </select>
                      </div>

                      {rubataState === 'OFFERING' && (
                        <Button
                          onClick={handleSimulateOffer}
                          disabled={isSubmitting || !simulateMemberId}
                          size="sm"
                          variant="outline"
                          className="w-full border-orange-500/50 text-orange-400"
                        >
                          🎯 Simula Offerta
                        </Button>
                      )}

                      {rubataState === 'AUCTION' && activeAuction && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-400 uppercase mb-1">Importo</label>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSimulateBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1))}
                                className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                              >−</button>
                              <input
                                type="number"
                                value={simulateBidAmount}
                                onChange={(e) => setSimulateBidAmount(Math.max(activeAuction.currentPrice + 1, parseInt(e.target.value) || 0))}
                                className="flex-1 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-1 text-white text-sm"
                              />
                              <button
                                onClick={() => setSimulateBidAmount(prev => prev + 1)}
                                className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                              >+</button>
                            </div>
                          </div>
                          <Button
                            onClick={handleSimulateBid}
                            disabled={isSubmitting || !simulateMemberId || simulateBidAmount <= activeAuction.currentPrice}
                            size="sm"
                            variant="outline"
                            className="w-full border-orange-500/50 text-orange-400"
                          >
                            💰 Simula Rilancio
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Complete Rubata Panel */}
                <div className="bg-surface-200 rounded-2xl border border-danger-500/50 overflow-hidden">
                  <div className="p-3 border-b border-surface-50/20 bg-danger-500/10">
                    <h3 className="font-bold text-danger-400 flex items-center gap-2">
                      <span>⚡</span>
                      Test Rapido
                    </h3>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400 mb-3">Completa la rubata con transazioni casuali (30% rubate)</p>
                    <Button
                      onClick={handleCompleteRubata}
                      disabled={isSubmitting || rubataState === 'COMPLETED'}
                      size="sm"
                      className="w-full bg-danger-500 hover:bg-danger-600"
                    >
                      🚀 Completa Rubata
                    </Button>
                  </div>
                </div>
              </>)}
            </div>

            {/* Main Content */}
            <div className="lg:col-span-4">
            {/* Timer e stato corrente - sticky on mobile for visibility */}
            <div className="mb-6 bg-surface-200 rounded-2xl border-2 border-primary-500/50 overflow-hidden sticky top-16 z-20 lg:relative lg:top-0">
              <div className="p-5 bg-primary-500/10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Current Player Info */}
                  <div className="flex items-center gap-4">
                    {currentPlayer ? (
                      <>
                        <div className={`w-12 h-12 rounded-full ${POSITION_COLORS[currentPlayer.playerPosition]} border flex items-center justify-center font-bold text-lg`}>
                          {currentPlayer.playerPosition}
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white">{currentPlayer.playerName}</p>
                          <p className="text-gray-400">{currentPlayer.playerTeam} • {currentPlayer.ownerUsername}</p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="text-2xl font-bold text-primary-400">{currentPlayer.rubataPrice}M</p>
                          <p className="text-xs text-gray-500">prezzo rubata</p>
                        </div>
                        {/* My strategy indicator for current player */}
                        {currentPlayerPreference && currentPlayer.memberId !== myMemberId && (
                          <div className="ml-4 px-3 py-2 bg-indigo-500/20 border border-indigo-500/40 rounded-lg">
                            <p className="text-[10px] text-indigo-300 uppercase mb-1">La tua strategia</p>
                            <div className="flex items-center gap-2 text-sm">
                              {currentPlayerPreference.isWatchlist && <span title="Watchlist">⭐</span>}
                              {currentPlayerPreference.isAutoPass && <span title="Auto-pass">🚫</span>}
                              {currentPlayerPreference.priority && (
                                <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                              )}
                              {currentPlayerPreference.maxBid && (
                                <span className="text-blue-400">Max: {currentPlayerPreference.maxBid}M</span>
                              )}
                              {currentPlayerPreference.notes && (
                                <span className="text-gray-400 truncate max-w-[100px]" title={currentPlayerPreference.notes}>📝</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400">Nessun giocatore in esame</p>
                    )}
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-4">
                    {/* Pusher Connection Indicator */}
                    <div className="flex items-center gap-1" title={isPusherConnected ? 'Real-time connesso' : 'Real-time disconnesso'}>
                      <div className={`w-2 h-2 rounded-full ${isPusherConnected ? 'bg-secondary-400' : 'bg-danger-400 animate-pulse'}`} />
                      <span className={`text-[10px] uppercase tracking-wider ${isPusherConnected ? 'text-secondary-400' : 'text-danger-400'}`}>
                        {isPusherConnected ? 'LIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    {timerDisplay !== null && (
                      <div className={`text-4xl font-mono font-bold ${timerDisplay <= 5 ? 'text-danger-400 animate-pulse' : timerDisplay <= 10 ? 'text-warning-400' : 'text-white'}`}>
                        {timerDisplay}s
                      </div>
                    )}
                    <div className="text-center">
                      <span className={`px-4 py-2 rounded-full font-bold text-sm ${
                        rubataState === 'READY_CHECK' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                        rubataState === 'PREVIEW' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' :
                        rubataState === 'OFFERING' ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40' :
                        rubataState === 'AUCTION_READY_CHECK' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse' :
                        rubataState === 'AUCTION' ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40 animate-pulse' :
                        rubataState === 'PENDING_ACK' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
                        rubataState === 'PAUSED' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/40' :
                        rubataState === 'WAITING' ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40' :
                        rubataState === 'COMPLETED' ? 'bg-secondary-500/20 text-secondary-400 border border-secondary-500/40' :
                        'bg-surface-300 text-gray-400'
                      }`}>
                        {rubataState === 'READY_CHECK' ? '🔔 PRONTI?' :
                         rubataState === 'PREVIEW' ? '👁️ PREVIEW' :
                         rubataState === 'OFFERING' ? '⏳ OFFERTA' :
                         rubataState === 'AUCTION_READY_CHECK' ? '🎯 RUBATA!' :
                         rubataState === 'AUCTION' ? '🔥 ASTA' :
                         rubataState === 'PENDING_ACK' ? '✋ CONFERMA' :
                         rubataState === 'PAUSED' ? '⏸️ PAUSA' :
                         rubataState === 'WAITING' ? '⏹️ IN ATTESA' :
                         rubataState === 'COMPLETED' ? '✅ COMPLETATA' :
                         'SCONOSCIUTO'}
                      </span>
                      {/* Progress counters */}
                      {progressStats && (
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          {progressStats.managerProgress && (
                            <span className="px-2 py-0.5 bg-primary-500/20 rounded text-primary-400">
                              👤 {progressStats.managerProgress.username}: {progressStats.managerProgress.processed}/{progressStats.managerProgress.total}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-accent-500/20 rounded text-accent-400">
                            📊 Totale: {progressStats.currentIndex + 1}/{progressStats.totalPlayers}
                          </span>
                          <span className="px-2 py-0.5 bg-warning-500/20 rounded text-warning-400">
                            ⏳ Rimangono: {progressStats.remaining}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Controls */}
                {isAdmin && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(rubataState === 'WAITING' || rubataState === 'PREVIEW') && (
                      <Button onClick={handleStartRubata} disabled={isSubmitting}>
                        ▶️ Avvia Rubata
                      </Button>
                    )}
                    {rubataState === 'PAUSED' && (
                      <Button onClick={handleResume} disabled={isSubmitting}>
                        🔔 Richiedi Pronti per Riprendere
                      </Button>
                    )}
                    {(rubataState === 'OFFERING' || rubataState === 'AUCTION') && (
                      <>
                        <Button onClick={handlePause} disabled={isSubmitting} variant="outline">
                          ⏸️ Pausa
                        </Button>
                        <Button onClick={handleGoBack} disabled={isSubmitting || boardData?.currentIndex === 0} variant="outline">
                          ⏮️ Indietro
                        </Button>
                        {rubataState === 'OFFERING' && (
                          <Button onClick={handleAdvance} disabled={isSubmitting} variant="outline">
                            ⏭️ Avanti
                          </Button>
                        )}
                        {rubataState === 'AUCTION' && (
                          <Button onClick={handleCloseAuction} disabled={isSubmitting}>
                            ✅ Chiudi Asta
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Player Actions - tutti i manager (incluso admin) possono fare offerte */}
                {rubataState === 'OFFERING' && canMakeOffer && (
                  <div className="mt-4">
                    <Button onClick={handleMakeOffer} disabled={isSubmitting} className="w-full md:w-auto">
                      🎯 VOGLIO RUBARE! ({currentPlayer?.rubataPrice}M)
                    </Button>
                  </div>
                )}

                {/* Strategy Info - Inline section below "Voglio Rubare" */}
                {currentPlayer && currentPlayerPreference &&
                 currentPlayer.memberId !== myMemberId &&
                 (currentPlayerPreference.maxBid || currentPlayerPreference.priority || currentPlayerPreference.notes) && (
                  <div className="mt-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/40 overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🎯</span>
                        <span className="font-bold text-indigo-300 text-sm">LA TUA STRATEGIA</span>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                        {currentPlayerPreference.maxBid && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Max:</span>
                            <span className="font-bold text-blue-400">{currentPlayerPreference.maxBid}M</span>
                          </div>
                        )}
                        {currentPlayerPreference.priority && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Priorita:</span>
                            <span className="text-purple-400">{'★'.repeat(currentPlayerPreference.priority)}</span>
                          </div>
                        )}
                        {currentPlayerPreference.notes && (
                          <div className="bg-black/20 rounded-lg px-3 py-1.5 flex-1 min-w-0">
                            <span className="text-[10px] text-indigo-300 uppercase mr-1">Note:</span>
                            <span className="text-gray-300 text-sm">{currentPlayerPreference.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preference Edit Modal - componente separato per evitare re-render */}
            {selectedPlayerForPrefs && (
              <PreferenceModal
                player={selectedPlayerForPrefs}
                onClose={closePrefsModal}
                onSave={handleSavePreference}
                onDelete={handleDeletePreference}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Ready Check Panel - With pending members list */}
            {rubataState === 'READY_CHECK' && readyStatus && (
              <div className="mb-4 bg-surface-200 rounded-xl border border-blue-500/50 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <span className="font-bold text-blue-400">Pronti?</span>
                      <span className="text-gray-400 text-sm ml-2">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                    </div>
                    <div className="w-24 h-2 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!readyStatus.userIsReady ? (
                      <Button onClick={handleSetReady} disabled={isSubmitting} size="sm">
                        ✅ Sono Pronto
                      </Button>
                    ) : (
                      <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                        ✓ Pronto
                      </span>
                    )}
                    {isAdmin && (
                      <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                        🤖 Forza Tutti Pronti
                      </Button>
                    )}
                  </div>
                </div>
                {/* Pending members list */}
                {readyStatus.pendingMembers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-gray-500">In attesa:</span>
                    {readyStatus.pendingMembers.map((member, idx) => (
                      <span key={member.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded text-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                          }`}
                          title={member.isConnected ? 'Online' : 'Offline'}
                        />
                        {member.username}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PAUSED State Panel - Ready check to resume */}
            {rubataState === 'PAUSED' && readyStatus && (
              <div className="mb-4 bg-surface-200 rounded-xl border border-gray-500/50 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⏸️</span>
                    <div>
                      <span className="font-bold text-gray-300">IN PAUSA</span>
                      {boardData?.pausedRemainingSeconds !== null && boardData.pausedRemainingSeconds !== undefined && (
                        <span className="text-yellow-400 text-sm ml-2">
                          ({boardData.pausedRemainingSeconds}s rimanenti - {boardData.pausedFromState === 'AUCTION' ? 'Asta' : 'Offerta'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ready check for resume */}
                <div className="bg-surface-300/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔔</span>
                      <div>
                        <span className="font-medium text-blue-400">Pronti a riprendere?</span>
                        <span className="text-gray-400 text-sm ml-2">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>
                      </div>
                      <div className="w-24 h-2 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(readyStatus.readyCount / readyStatus.totalMembers) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!readyStatus.userIsReady ? (
                        <Button onClick={handleSetReady} disabled={isSubmitting} size="sm">
                          ✅ Sono Pronto
                        </Button>
                      ) : (
                        <span className="px-3 py-1 bg-secondary-500/20 border border-secondary-500/40 rounded-lg text-secondary-400 text-sm">
                          ✓ Pronto
                        </span>
                      )}
                      {isAdmin && (
                        <Button onClick={handleForceAllReady} disabled={isSubmitting} variant="outline" size="sm" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                          🤖 Forza Tutti Pronti
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Pending members list */}
                  {readyStatus.pendingMembers.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-gray-500">In attesa:</span>
                      {readyStatus.pendingMembers.map((member, idx) => (
                        <span key={member.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                            }`}
                            title={member.isConnected ? 'Online' : 'Offline'}
                          />
                          {member.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-gray-400 text-xs text-center">
                  L'admin ha messo in pausa la rubata. Tutti i manager devono confermare di essere pronti per riprendere.
                </p>
              </div>
            )}

            {/* Pending Acknowledgment is now a modal - see below */}

            {/* Active Auction Panel */}
            {activeAuction && rubataState === 'AUCTION' && (
              <div className="mb-6 bg-surface-200 rounded-2xl border-4 border-danger-500 overflow-hidden auction-highlight shadow-2xl">
                <div className="p-5 border-b border-surface-50/20 bg-gradient-to-r from-danger-600/30 via-danger-500/20 to-danger-600/30">
                  <h3 className="text-xl font-black text-danger-400 flex items-center justify-center gap-3 uppercase tracking-wide">
                    <span className="text-3xl animate-pulse">🔥</span>
                    <span className="text-white">ASTA IN CORSO</span>
                    <span className="text-3xl animate-pulse">🔥</span>
                  </h3>
                  <p className="text-center text-2xl font-bold text-white mt-2">
                    {activeAuction.player.name}
                  </p>
                </div>
                <div className="p-5">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="bg-surface-300 p-4 rounded-xl border border-surface-50/20 mb-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <p className="text-sm text-gray-500">Base</p>
                            <p className="font-bold text-white text-xl">{activeAuction.basePrice}M</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Offerta attuale</p>
                            <p className="font-bold text-primary-400 text-2xl">{activeAuction.currentPrice}M</p>
                          </div>
                        </div>
                      </div>

                      {/* Bid Form - only if not the seller */}
                      {activeAuction.sellerId !== myMemberId && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1))}
                              disabled={bidAmount <= activeAuction.currentPrice + 1}
                              className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                              −
                            </button>
                            <div className="flex-1 text-center">
                              <input
                                type="number"
                                value={bidAmount}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0
                                  setBidAmount(Math.max(activeAuction.currentPrice + 1, val))
                                }}
                                className="w-full text-center text-3xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min={activeAuction.currentPrice + 1}
                              />
                              <p className="text-xs text-gray-500">Min: {activeAuction.currentPrice + 1}M</p>
                            </div>
                            <button
                              onClick={() => setBidAmount(prev => prev + 1)}
                              className="w-12 h-12 rounded-xl bg-surface-300 border border-surface-50/30 text-white text-2xl font-bold hover:bg-surface-200 transition-all"
                            >
                              +
                            </button>
                          </div>
                          <Button
                            onClick={handleBid}
                            disabled={isSubmitting || bidAmount <= activeAuction.currentPrice}
                            className="w-full py-3 text-lg"
                          >
                            RILANCIA {bidAmount}M
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium text-white mb-3">Ultime offerte</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {activeAuction.bids.length === 0 ? (
                          <p className="text-gray-500 text-sm">Nessuna offerta ancora</p>
                        ) : (
                          activeAuction.bids.map((bid, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded-xl ${bid.isWinning ? 'bg-secondary-500/20 border border-secondary-500/40' : 'bg-surface-300 border border-surface-50/20'}`}
                            >
                              <span className="font-medium text-white">{bid.bidder}</span>
                              <span className="ml-2 font-mono text-primary-400">{bid.amount}M</span>
                              {bid.isWinning && (
                                <span className="ml-2 text-secondary-400 text-sm font-medium">✓ Vincente</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabellone completo */}
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '300px' }}>
              <div className="p-5 border-b border-surface-50/20 shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Tabellone Rubata
                </h3>
                <p className="text-sm text-gray-400 mt-1">{boardData?.totalPlayers} giocatori in ordine di rubata</p>
              </div>

              {/* Desktop: Table View - Scrollable */}
              <div className="hidden md:block overflow-y-auto flex-1">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-300 text-[11px] text-gray-400 uppercase tracking-wide">
                      <th className="text-center py-2 w-[3%]">#</th>
                      <th className="text-left pl-2 py-2 w-[18%]">Giocatore</th>
                      <th className="text-center py-2 w-[5%]">Pos</th>
                      <th className="text-center py-2 w-[5%]">Età</th>
                      <th className="text-left px-2 py-2 w-[10%]">Propr.</th>
                      <th className="text-center py-2 w-[5%]">Ing.</th>
                      <th className="text-center py-2 w-[5%]">Dur.</th>
                      <th className="text-center py-2 w-[6%]">Claus.</th>
                      <th className="text-center py-2 w-[7%]">Rubata</th>
                      <th className="text-center py-2 w-[13%]">Nuovo Prop.</th>
                      <th className="text-center py-2 w-[11%]">Strategia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board?.map((player, globalIndex) => {
                      const isCurrent = globalIndex === boardData?.currentIndex
                      const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                      const wasStolen = !!player.stolenByUsername

                      return (
                        <tr
                          key={player.rosterId}
                          ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLTableRowElement> : null}
                          className={`border-t border-surface-50/10 transition-all ${
                            isCurrent
                              ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400 shadow-lg'
                              : isPassed
                              ? wasStolen
                                ? 'bg-danger-500/10'
                                : 'bg-surface-50/5 opacity-60'
                              : 'hover:bg-surface-300/30'
                          }`}
                        >
                          <td className="text-center py-2 font-mono text-[11px]">
                            {isCurrent ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-white rounded-full animate-pulse font-bold text-[10px]">
                                {globalIndex + 1}
                              </span>
                            ) : (
                              <span className={isPassed ? 'text-gray-600' : 'text-gray-500'}>{globalIndex + 1}</span>
                            )}
                          </td>
                          <td className="pl-2 py-2">
                            <div className="flex items-center gap-1.5">
                              {player.playerApiFootballId ? (
                                <img
                                  src={getPlayerPhotoUrl(player.playerApiFootballId)}
                                  alt={player.playerName}
                                  className="w-7 h-7 rounded-full object-cover bg-surface-300 flex-shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                                  {player.playerPosition}
                                </div>
                              )}
                              <div className="w-5 h-5 bg-white rounded p-0.5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerForStats({
                                  name: player.playerName,
                                  team: player.playerTeam,
                                  position: player.playerPosition,
                                  quotation: player.playerQuotation,
                                  age: player.playerAge,
                                  apiFootballId: player.playerApiFootballId,
                                  computedStats: player.playerComputedStats,
                                })}
                                className={`font-medium truncate hover:underline cursor-pointer text-left ${isCurrent ? 'text-white font-bold' : isPassed ? 'text-gray-500' : 'text-gray-300 hover:text-white'}`}
                                title="Clicca per vedere statistiche"
                              >
                                {player.playerName}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${isPassed ? 'opacity-40' : ''} ${POSITION_COLORS[player.playerPosition]}`}>
                              {player.playerPosition}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              isPassed ? 'text-gray-600 bg-transparent' :
                              (player.playerAge ?? 99) <= 23 ? 'text-green-400 bg-green-500/10' :
                              (player.playerAge ?? 99) <= 27 ? 'text-blue-400 bg-blue-500/10' :
                              (player.playerAge ?? 99) <= 30 ? 'text-yellow-400 bg-yellow-500/10' :
                              'text-orange-400 bg-orange-500/10'
                            }`}>
                              {player.playerAge || '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`text-xs truncate block ${isPassed && wasStolen ? 'text-gray-500 line-through' : isPassed ? 'text-gray-500' : 'text-gray-400'}`}>
                              {player.ownerUsername}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs ${isCurrent ? 'text-accent-400' : isPassed ? 'text-gray-600' : 'text-accent-400'}`}>
                              {player.contractSalary}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs font-medium ${
                              isPassed ? 'text-gray-500' :
                              player.contractDuration === 1 ? 'text-danger-400' :
                              player.contractDuration === 2 ? 'text-warning-400' :
                              player.contractDuration === 3 ? 'text-blue-400' :
                              'text-secondary-400'
                            }`}>
                              {player.contractDuration}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`text-xs ${isPassed ? 'text-gray-600' : 'text-gray-400'}`}>
                              {player.contractClause}
                            </span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-bold ${isCurrent ? 'text-primary-400 text-sm' : isPassed ? 'text-gray-600 text-xs' : 'text-warning-400 text-sm'}`}>
                              {player.rubataPrice}M
                            </span>
                          </td>
                          <td className="px-1 py-2 text-center">
                            {wasStolen ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-500/20 border border-danger-500/30 text-danger-400 font-bold text-xs truncate">
                                🎯 {player.stolenByUsername}
                              </span>
                            ) : isPassed ? (
                              <span className="text-secondary-500/60 text-xs">✓</span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {(() => {
                              const pref = preferencesMap.get(player.playerId)
                              const isMyPlayer = player.memberId === myMemberId
                              if (isMyPlayer) return <span className="text-gray-600 text-xs">Mio</span>
                              const hasStrategy = pref?.priority || pref?.maxBid || pref?.notes
                              return (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Strategy indicators */}
                                  {pref?.priority && (
                                    <span className="text-purple-400 text-[10px]" title={`Priorità ${pref.priority}`}>
                                      {'★'.repeat(pref.priority)}
                                    </span>
                                  )}
                                  {pref?.maxBid && (
                                    <span className="text-blue-400 text-[10px]" title={`Max ${pref.maxBid}M`}>
                                      {pref.maxBid}M
                                    </span>
                                  )}
                                  {pref?.notes && !pref.priority && !pref.maxBid && (
                                    <span className="text-gray-400 text-xs" title={pref.notes}>📝</span>
                                  )}
                                  {/* Edit button */}
                                  {canEditPreferences && (
                                    <button
                                      type="button"
                                      onClick={() => openPrefsModal({ ...player, preference: pref || null })}
                                      className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-all ${
                                        hasStrategy ? 'bg-indigo-500/30 text-indigo-400' : 'bg-surface-50/20 text-gray-500 hover:bg-indigo-500/20'
                                      }`}
                                      title="Imposta strategia"
                                    >
                                      ⚙️
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card View - Scrollable */}
              <div className="md:hidden p-4 pb-24 space-y-3 overflow-y-auto flex-1">
                {board?.map((player, globalIndex) => {
                  const isCurrent = globalIndex === boardData?.currentIndex
                  const isPassed = globalIndex < (boardData?.currentIndex ?? 0)
                  const wasStolen = !!player.stolenByUsername

                  return (
                    <div
                      key={player.rosterId}
                      ref={isCurrent ? currentPlayerRef as React.RefObject<HTMLDivElement> : null}
                      className={`p-3 rounded-lg border transition-all ${
                        isCurrent
                          ? 'bg-primary-500/30 border-primary-400 ring-2 ring-primary-400/50 shadow-lg'
                          : isPassed
                          ? wasStolen
                            ? 'bg-danger-500/10 border-danger-500/30'
                            : 'bg-surface-50/5 border-surface-50/10 opacity-60'
                          : 'bg-surface-300 border-surface-50/20'
                      }`}
                    >
                      {/* Header: numero e giocatore */}
                      <div className="flex items-center gap-2 mb-2">
                        {isCurrent ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-500 text-white rounded-full text-xs font-bold animate-pulse">
                            {globalIndex + 1}
                          </span>
                        ) : (
                          <span className={`text-xs font-mono w-6 text-center ${isPassed ? 'text-gray-600' : 'text-gray-500'}`}>
                            #{globalIndex + 1}
                          </span>
                        )}
                        {/* Player photo */}
                        {player.playerApiFootballId ? (
                          <img
                            src={getPlayerPhotoUrl(player.playerApiFootballId)}
                            alt={player.playerName}
                            className="w-8 h-8 rounded-full object-cover bg-surface-300 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                            {player.playerPosition}
                          </div>
                        )}
                        <div className="w-6 h-6 bg-white rounded p-0.5 flex-shrink-0">
                          <TeamLogo team={player.playerTeam} />
                        </div>
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[player.playerPosition]}`}>
                          {player.playerPosition}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerForStats({
                            name: player.playerName,
                            team: player.playerTeam,
                            position: player.playerPosition,
                            quotation: player.playerQuotation,
                            age: player.playerAge,
                            apiFootballId: player.playerApiFootballId,
                            computedStats: player.playerComputedStats,
                          })}
                          className={`font-medium flex-1 truncate text-left ${isCurrent ? 'text-white font-bold' : isPassed ? 'text-gray-500' : 'text-gray-300'}`}
                        >
                          {player.playerName}
                        </button>
                        {isCurrent && (
                          <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded-full shrink-0">
                            SUL PIATTO
                          </span>
                        )}
                      </div>

                      {/* Proprietario + Età */}
                      <div className="text-xs text-gray-500 mb-2 pl-6">
                        di <span className={isPassed && wasStolen ? 'text-gray-500 line-through' : 'text-gray-400'}>{player.ownerUsername}</span>
                        {player.ownerTeamName && <span className="text-gray-600"> ({player.ownerTeamName})</span>}
                        {player.playerAge && <span className="text-gray-600"> · {player.playerAge}a</span>}
                      </div>

                      {/* Nuovo proprietario se rubato */}
                      {wasStolen && (
                        <div className="mb-2 ml-6 flex items-center gap-1 text-sm">
                          <span className="text-danger-400">🎯</span>
                          <span className="text-danger-400 font-bold">{player.stolenByUsername}</span>
                          {player.stolenPrice && player.stolenPrice > player.rubataPrice && (
                            <span className="text-danger-500 text-xs">({player.stolenPrice}M)</span>
                          )}
                        </div>
                      )}

                      {/* Dettagli contratto */}
                      <div className={`grid grid-cols-4 gap-2 rounded p-2 ${isPassed ? 'bg-surface-50/5' : 'bg-surface-50/10'}`}>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Ingaggio</div>
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-600' : 'text-accent-400'}`}>
                            {player.contractSalary}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Durata</div>
                          <div className={`font-medium text-sm ${
                            isPassed ? 'text-gray-600' :
                            player.contractDuration === 1 ? 'text-danger-400' :
                            player.contractDuration === 2 ? 'text-warning-400' :
                            player.contractDuration === 3 ? 'text-blue-400' :
                            'text-secondary-400'
                          }`}>
                            {player.contractDuration}s
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Clausola</div>
                          <div className={`font-medium text-sm ${isPassed ? 'text-gray-600' : 'text-gray-400'}`}>
                            {player.contractClause}M
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Rubata</div>
                          <div className={`font-bold text-sm ${isPassed ? 'text-gray-600' : isCurrent ? 'text-primary-400' : 'text-warning-400'}`}>
                            {player.rubataPrice}M
                          </div>
                        </div>
                      </div>

                      {/* Stato per giocatori passati non rubati */}
                      {isPassed && !wasStolen && (
                        <div className="mt-2 text-center text-xs text-secondary-500">
                          ✓ Non rubato
                        </div>
                      )}

                      {/* Strategia - Mobile */}
                      {(() => {
                        const pref = preferencesMap.get(player.playerId)
                        const isMyPlayer = player.memberId === myMemberId
                        if (isMyPlayer || isPassed) return null
                        return (
                          <div className="mt-2 pt-2 border-t border-surface-50/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {pref?.priority && (
                                  <span className="text-purple-400 text-xs">{'★'.repeat(pref.priority)}</span>
                                )}
                                {pref?.maxBid && (
                                  <span className="text-blue-400 text-xs">Max: {pref.maxBid}M</span>
                                )}
                                {pref?.notes && (
                                  <span className="text-gray-400 text-xs" title={pref.notes}>📝</span>
                                )}
                                {!pref?.priority && !pref?.maxBid && !pref?.notes && (
                                  <span className="text-gray-500 text-xs">Nessuna strategia</span>
                                )}
                              </div>
                              {canEditPreferences && (
                                <button
                                  type="button"
                                  onClick={() => openPrefsModal({ ...player, preference: pref || null })}
                                  className={`px-2 py-1 rounded text-xs transition-all ${
                                    (pref?.priority || pref?.maxBid || pref?.notes) ? 'bg-indigo-500/30 text-indigo-400' : 'bg-surface-50/20 text-gray-500'
                                  }`}
                                >
                                  ⚙️ Strategia
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>
        )}


        {/* Floating "Scroll to Current Player" Button - Bottom Left */}
        {isRubataPhase && isOrderSet && !isCurrentPlayerVisible && currentPlayer && (
          <button
            onClick={scrollToCurrentPlayer}
            className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-lg transition-all animate-pulse hover:animate-none"
            title={`Torna a ${currentPlayer.playerName}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">
              Torna a {currentPlayer.playerName.split(' ').pop()}
            </span>
            <span className="text-sm font-medium sm:hidden">
              ↑ Player
            </span>
          </button>
        )}

      </main>

      {/* Mobile Budget Footer - Fixed Bottom */}
      {boardData?.memberBudgets && boardData.memberBudgets.length > 0 && isRubataPhase && isOrderSet && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 z-40 shadow-lg shadow-black/30">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 uppercase font-medium">Budget Residuo</span>
              <button
                type="button"
                onClick={() => setMobileBudgetExpanded(prev => !prev)}
                className="text-[9px] text-gray-400 px-2 py-0.5 rounded bg-surface-300/50"
              >
                {mobileBudgetExpanded ? '▼ Chiudi' : '▲ Espandi'}
              </button>
            </div>
            <div className={`grid gap-1.5 ${mobileBudgetExpanded ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {(mobileBudgetExpanded ? boardData.memberBudgets : boardData.memberBudgets.slice(0, 4)).map(mb => (
                <div
                  key={mb.memberId}
                  className={`rounded p-1 text-center ${
                    mb.residuo < 0 ? 'bg-danger-500/20' : 'bg-surface-300/50'
                  }`}
                >
                  <div className="text-[8px] text-gray-500 truncate">{mb.teamName}</div>
                  <div className={`font-bold text-xs ${
                    mb.residuo < 0 ? 'text-danger-400' : mb.residuo < 50 ? 'text-warning-400' : 'text-accent-400'
                  }`}>
                    {mb.residuo}M
                  </div>
                  {mobileBudgetExpanded && (
                    <div className="text-[7px] text-gray-600">
                      {mb.currentBudget}M - {mb.totalSalaries}M
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modification Modal after Rubata Win */}
      {pendingContractModification && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: pendingContractModification.playerId,
            name: pendingContractModification.playerName,
            team: pendingContractModification.playerTeam || '',
            position: pendingContractModification.playerPosition || '',
          }}
          contract={{
            salary: pendingContractModification.salary,
            duration: pendingContractModification.duration,
            initialSalary: pendingContractModification.initialSalary,
            rescissionClause: pendingContractModification.rescissionClause,
          }}
          onConfirm={handleContractModification}
          title="Modifica Contratto"
          description="Hai appena rubato questo giocatore. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerForStats}
        onClose={() => setSelectedPlayerForStats(null)}
        player={selectedPlayerForStats}
      />
    </div>
  )
}
