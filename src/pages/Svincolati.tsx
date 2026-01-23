import { useState, useEffect, useRef, useCallback } from 'react'
import { svincolatiApi, leagueApi, auctionApi, contractApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS } from '../components/ui/PositionBadge'
import { ContractModifierModal } from '../components/ContractModifier'

interface AppealStatus {
  auctionId: string
  auctionStatus: string
  hasActiveAppeal: boolean
  appeal: {
    id: string
    status: string
    reason: string
    adminNotes: string | null
    submittedBy: { username: string } | null
  } | null
  player: Player | null
  winner: { username: string } | null
  finalPrice: number | null
  appealDecisionAcks: string[]
  resumeReadyMembers: string[]
  allMembers: { id: string; username: string }[]
  userHasAcked: boolean
  userIsReady: boolean
}

interface SvincolatiProps {
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

interface TurnMember {
  id: string
  username: string
  budget: number
  hasPassed: boolean
  isConnected?: boolean
}

interface ActiveAuction {
  id: string
  player: Player
  basePrice: number
  currentPrice: number
  timerExpiresAt: string | null
  timerSeconds: number | null
  nominatorId: string | null
  bids: Array<{
    amount: number
    bidder: string
    bidderId: string
    isWinning: boolean
  }>
}

interface PendingAck {
  auctionId: string
  playerId: string
  playerName: string
  winnerId: string | null
  winnerUsername: string | null
  price: number
  noBids: boolean
  acknowledgedMembers: string[]
  pendingMembers: string[]
}

interface BoardState {
  isActive: boolean
  state: string
  turnOrder: TurnMember[]
  currentTurnIndex: number
  currentTurnMemberId: string | null
  currentTurnUsername: string | null
  myMemberId: string
  isMyTurn: boolean
  isAdmin: boolean
  readyMembers: string[]
  passedMembers: string[]
  finishedMembers: string[]
  isFinished: boolean
  pendingPlayer: Player | null
  pendingNominatorId: string | null
  nominatorUsername: string | null
  nominatorConfirmed: boolean
  activeAuction: ActiveAuction | null
  awaitingResumeAuctionId: string | null
  timerSeconds: number
  timerStartedAt: string | null
  pendingAck: PendingAck | null
  myBudget: number
}

// Alias for backward compatibility with existing code that uses POSITION_COLORS as gradients
const POSITION_COLORS = POSITION_GRADIENTS
const POSITION_BG = POSITION_FILTER_COLORS

const SERIE_A_TEAMS = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli',
  'Fiorentina', 'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce',
  'Milan', 'Monza', 'Napoli', 'Parma', 'Roma',
  'Torino', 'Udinese', 'Venezia', 'Verona',
]

export function Svincolati({ leagueId, onNavigate }: SvincolatiProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [board, setBoard] = useState<BoardState | null>(null)

  // Free agents
  const [freeAgents, setFreeAgents] = useState<Player[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const teamDropdownRef = useRef<HTMLDivElement>(null)

  // Turn order setup
  const [turnOrderDraft, setTurnOrderDraft] = useState<TurnMember[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Auction
  const [bidAmount, setBidAmount] = useState('')
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Timer settings
  const [timerInput, setTimerInput] = useState(30)
  const timerInitialized = useRef(false)
  const isClosingAuction = useRef(false)

  // Appeal/Acknowledgment system
  const [isAppealMode, setIsAppealMode] = useState(false)
  const [appealContent, setAppealContent] = useState('')
  const [appealStatus, setAppealStatus] = useState<AppealStatus | null>(null)
  const [ackSubmitting, setAckSubmitting] = useState(false)
  const [userHasAcked, setUserHasAcked] = useState(false)

  // Confirm finish modal
  const [showFinishConfirmModal, setShowFinishConfirmModal] = useState(false)

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

  // Manager roster modal
  interface ManagerRosterPlayer {
    id: string
    playerId: string
    playerName: string
    playerTeam: string
    position: string
    acquisitionPrice: number
    contract: {
      salary: number
      duration: number
      rescissionClause: number
    } | null
  }
  interface SelectedManagerData {
    id: string
    username: string
    teamName?: string
    currentBudget: number
    roster: ManagerRosterPlayer[]
    slotsByPosition: { P: { filled: number; total: number }; D: { filled: number; total: number }; C: { filled: number; total: number }; A: { filled: number; total: number } }
    slotsFilled: number
    totalSlots: number
  }
  const [selectedManager, setSelectedManager] = useState<SelectedManagerData | null>(null)
  const [loadingManager, setLoadingManager] = useState(false)

  // Click outside handler for team dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadBoard = useCallback(async () => {
    const res = await svincolatiApi.getBoard(leagueId)
    if (res.success && res.data) {
      const data = res.data as BoardState
      setBoard(data)
      // Only set timer on first load to avoid overwriting user changes
      if (data.timerSeconds && !timerInitialized.current) {
        setTimerInput(data.timerSeconds)
        timerInitialized.current = true
      }
    }
  }, [leagueId])

  const loadFreeAgents = useCallback(async () => {
    const filters = {
      position: selectedPosition || undefined,
      team: selectedTeam || undefined,
      search: searchQuery || undefined,
    }

    const res = await svincolatiApi.getAll(leagueId, filters)
    if (res.success && res.data) {
      setFreeAgents(res.data as Player[])
    }
  }, [leagueId, selectedPosition, selectedTeam, searchQuery])

  useEffect(() => {
    loadInitialData()
  }, [leagueId])

  useEffect(() => {
    loadFreeAgents()
  }, [loadFreeAgents])

  // Poll for board updates
  useEffect(() => {
    const interval = setInterval(loadBoard, 3000)
    return () => clearInterval(interval)
  }, [loadBoard])

  // Send heartbeat every 3 seconds to track connection status
  useEffect(() => {
    if (!board?.myMemberId) return

    const sendHeartbeat = async () => {
      try {
        await svincolatiApi.sendHeartbeat(leagueId, board.myMemberId)
      } catch (e) {
        // Ignore heartbeat errors
        console.error('[Svincolati] Heartbeat error:', e)
      }
    }

    // Send immediately on mount
    sendHeartbeat()

    // Then every 3 seconds
    const interval = setInterval(sendHeartbeat, 3000)
    return () => clearInterval(interval)
  }, [leagueId, board?.myMemberId])

  // Timer countdown
  useEffect(() => {
    if (board?.activeAuction?.timerExpiresAt) {
      // Reset the closing flag when a new auction starts
      isClosingAuction.current = false

      const updateTimer = async () => {
        const expires = new Date(board.activeAuction!.timerExpiresAt!).getTime()
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((expires - now) / 1000))
        setTimerRemaining(remaining)

        // Auto-close when timer hits 0 (only admin, only once)
        if (remaining === 0 && board.isAdmin && !isClosingAuction.current) {
          isClosingAuction.current = true
          console.log('[Svincolati] Timer expired, closing auction...')
          const res = await svincolatiApi.closeTurnAuction(board.activeAuction!.id)
          console.log('[Svincolati] Close auction result:', res)
          if (res.success) {
            loadBoard()
          } else {
            console.error('[Svincolati] Failed to close auction:', res.message)
            isClosingAuction.current = false // Reset so we can try again
          }
        }
      }
      updateTimer()
      const interval = setInterval(updateTimer, 1000)
      return () => clearInterval(interval)
    } else {
      setTimerRemaining(null)
    }
  }, [board?.activeAuction?.timerExpiresAt, board?.activeAuction?.id, board?.isAdmin, loadBoard])

  // Auto-update bid amount when currentPrice changes
  useEffect(() => {
    if (board?.activeAuction?.currentPrice) {
      setBidAmount(String(board.activeAuction.currentPrice + 1))
    }
  }, [board?.activeAuction?.currentPrice])

  // Load appeal status when there's a pending ack or awaiting resume
  const loadAppealStatus = useCallback(async () => {
    const auctionIdToCheck = board?.pendingAck?.auctionId || board?.awaitingResumeAuctionId
    if (auctionIdToCheck) {
      const result = await auctionApi.getAppealStatus(auctionIdToCheck)
      if (result.success && result.data) {
        setAppealStatus(result.data as AppealStatus)
        // Reset userHasAcked when appeal status changes
        const status = result.data as AppealStatus
        if (board?.pendingAck) {
          setUserHasAcked(status.userHasAcked || board.pendingAck.acknowledgedMembers.includes(board.myMemberId))
        }
      } else {
        setAppealStatus(null)
      }
    } else {
      setAppealStatus(null)
      setUserHasAcked(false)
    }
  }, [board?.pendingAck?.auctionId, board?.pendingAck?.acknowledgedMembers, board?.myMemberId, board?.awaitingResumeAuctionId])

  // Poll appeal status when in PENDING_ACK state
  useEffect(() => {
    loadAppealStatus()
    const interval = setInterval(loadAppealStatus, 5000)
    return () => clearInterval(interval)
  }, [loadAppealStatus])

  async function loadInitialData() {
    setIsLoading(true)

    const [boardRes, membersRes] = await Promise.all([
      svincolatiApi.getBoard(leagueId),
      leagueApi.getById(leagueId),
    ])

    if (boardRes.success && boardRes.data) {
      const data = boardRes.data as BoardState
      setBoard(data)
    }

    // Always load members for turn order draft if in SETUP or no turn order
    if (membersRes.success && membersRes.data) {
      const leagueData = membersRes.data as {
        league?: {
          members?: Array<{ id: string; user: { username: string }; currentBudget: number; status: string }>
        }
      }
      const allMembers = leagueData.league?.members || []
      const activeMembers = allMembers.filter(m => m.status === 'ACTIVE')

      // Set turn order draft from members
      if (activeMembers.length > 0) {
        setTurnOrderDraft(activeMembers.map(m => ({
          id: m.id,
          username: m.user.username,
          budget: m.currentBudget,
          hasPassed: false,
        })))
      }
    }

    await loadFreeAgents()
    setIsLoading(false)
  }

  // ========== TURN ORDER SETUP ==========

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newOrder = [...turnOrderDraft]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(index, 0, removed)
    setTurnOrderDraft(newOrder)
    setDraggedIndex(index)
  }

  function handleDragEnd() {
    setDraggedIndex(null)
  }

  async function handleSetTurnOrder() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.setTurnOrder(leagueId, turnOrderDraft.map(m => m.id))
    if (res.success) {
      setSuccess('Ordine turni impostato!')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== MANAGER ROSTER MODAL ==========

  async function handleViewManagerRoster(member: TurnMember) {
    setLoadingManager(true)
    setSelectedManager(null)

    try {
      const res = await auctionApi.getMemberRoster(leagueId, member.id)
      if (res.success && res.data) {
        // API returns { member, roster: { P: [...], D: [...], C: [...], A: [...] }, totals, slots }
        type RosterItem = { player: { id: string; name: string; team: string; position: string }; contract?: { salary: number; duration: number; rescissionClause: number } | null; acquisitionPrice: number }
        const apiData = res.data as {
          member: { teamName?: string; user?: { username: string } }
          roster: { P: RosterItem[]; D: RosterItem[]; C: RosterItem[]; A: RosterItem[] }
          totals: { P: number; D: number; C: number; A: number; total: number }
          slots: { P: number; D: number; C: number; A: number }
        }

        // Flatten roster from grouped by position to array
        const allPlayers = [...(apiData.roster.P || []), ...(apiData.roster.D || []), ...(apiData.roster.C || []), ...(apiData.roster.A || [])]
        const rosterData: ManagerRosterPlayer[] = allPlayers.map(r => ({
          id: r.player.id,
          playerId: r.player.id,
          playerName: r.player.name,
          playerTeam: r.player.team,
          position: r.player.position,
          acquisitionPrice: r.acquisitionPrice || 0,
          contract: r.contract ? {
            salary: r.contract.salary,
            duration: r.contract.duration,
            rescissionClause: r.contract.rescissionClause,
          } : null,
        }))

        // Use slots from API
        const slotsByPosition = {
          P: { filled: apiData.totals.P, total: apiData.slots.P },
          D: { filled: apiData.totals.D, total: apiData.slots.D },
          C: { filled: apiData.totals.C, total: apiData.slots.C },
          A: { filled: apiData.totals.A, total: apiData.slots.A },
        }

        const totalSlots = apiData.slots.P + apiData.slots.D + apiData.slots.C + apiData.slots.A

        setSelectedManager({
          id: member.id,
          username: member.username,
          teamName: apiData.member?.teamName,
          currentBudget: member.budget,
          roster: rosterData,
          slotsByPosition,
          slotsFilled: apiData.totals.total,
          totalSlots,
        })
      }
    } catch (err) {
      console.error('Error loading manager roster:', err)
    } finally {
      setLoadingManager(false)
    }
  }

  // ========== NOMINATION ==========

  async function handleNominate(playerId: string) {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await svincolatiApi.nominate(leagueId, playerId)
    if (res.success) {
      setSuccess('Giocatore nominato! Conferma la tua scelta.')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleConfirmNomination() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.confirmNomination(leagueId)
    if (res.success) {
      setSuccess('Nominazione confermata!')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCancelNomination() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.cancelNomination(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handlePassTurn() {
    if (!confirm('Vuoi passare il turno? Non chiamerai più giocatori in questa fase.')) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.passTurn(leagueId)
    if (res.success) {
      const data = res.data as { completed?: boolean }
      if (data.completed) {
        setSuccess('Tutti hanno passato. Fase svincolati completata!')
      }
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  function handleDeclareFinished() {
    setShowFinishConfirmModal(true)
  }

  async function confirmDeclareFinished() {
    setShowFinishConfirmModal(false)
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.declareFinished(leagueId)
    if (res.success) {
      const data = res.data as { allFinished?: boolean }
      if (data.allFinished) {
        setSuccess('Tutti i manager hanno finito! L\'admin può chiudere la fase.')
      } else {
        setSuccess(res.message || 'Hai dichiarato di aver finito.')
      }
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleUndoFinished() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.undoFinished(leagueId)
    if (res.success) {
      setSuccess('Puoi tornare a fare offerte.')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceAllFinished() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.forceAllFinished(leagueId)
    if (res.success) {
      setSuccess(res.message || 'Tutti i manager sono stati marcati come finiti.')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleMarkReady() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.markReady(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleForceReady() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.forceAllReady(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== AUCTION ==========

  async function handleBid() {
    if (!board?.activeAuction) return
    setError('')
    setIsSubmitting(true)

    const amount = parseInt(bidAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Importo non valido')
      setIsSubmitting(false)
      return
    }

    const res = await svincolatiApi.bid(board.activeAuction.id, amount)
    if (res.success) {
      setBidAmount(String(amount + 1))
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleCloseAuction() {
    if (!board?.activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.closeTurnAuction(board.activeAuction.id)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== ACKNOWLEDGMENT ==========

  async function handleAcknowledge(withAppeal: boolean = false) {
    if (!board?.pendingAck) return
    setAckSubmitting(true)
    setError('')

    // If submitting appeal
    if (withAppeal && appealContent.trim()) {
      const appealResult = await auctionApi.submitAppeal(board.pendingAck.auctionId, appealContent.trim())
      if (!appealResult.success) {
        setError(appealResult.message || 'Errore nell\'invio del ricorso')
        setAckSubmitting(false)
        return
      }
      setSuccess('Ricorso inviato! L\'admin della lega valuterà la tua richiesta.')
    }

    // Confirm acknowledgment (even with appeal)
    const res = await svincolatiApi.acknowledge(leagueId)
    setAckSubmitting(false)

    if (res.success) {
      setUserHasAcked(true)
      setAppealContent('')
      setIsAppealMode(false)

      // Check if there's contract info for modification (winner only)
      const data = res.data as { winnerContractInfo?: ContractForModification } | undefined
      if (data?.winnerContractInfo) {
        setPendingContractModification(data.winnerContractInfo)
      }

      loadBoard()
      loadAppealStatus()
    } else {
      setError(res.message || 'Errore')
    }
  }

  // ========== CONTRACT MODIFICATION (Post-Svincolati Win) ==========

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!pendingContractModification?.contractId) return

    const res = await contractApi.modify(pendingContractModification.contractId, newSalary, newDuration)
    if (res.success) {
      setPendingContractModification(null)
      loadBoard()
    } else {
      setError(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    setPendingContractModification(null)
  }

  async function handleForceAck() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.forceAllAck(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== APPEAL HANDLERS ==========

  async function handleSimulateAppeal() {
    const result = await auctionApi.simulateAppeal(leagueId, board?.pendingAck?.auctionId)
    if (result.success) {
      setSuccess('Ricorso simulato! Vai nel pannello Admin per gestirlo.')
      loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleAcknowledgeAppealDecision() {
    if (!appealStatus?.auctionId) return
    setAckSubmitting(true)
    const result = await auctionApi.acknowledgeAppealDecision(appealStatus.auctionId)
    setAckSubmitting(false)
    if (result.success) {
      loadAppealStatus()
      loadBoard()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleReadyToResume() {
    if (!appealStatus?.auctionId) return
    setAckSubmitting(true)
    const result = await auctionApi.markReadyToResume(appealStatus.auctionId)
    setAckSubmitting(false)
    if (result.success) {
      loadAppealStatus()
      loadBoard()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllAppealAcks() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllAppealAcks(appealStatus.auctionId)
    if (result.success) {
      setSuccess('Conferme forzate!')
      loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllReadyResume() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllReadyResume(appealStatus.auctionId)
    if (result.success) {
      setSuccess('Pronti forzati!')
      loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  // ========== TIMER ==========

  async function handleSetTimer() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.setTimer(leagueId, timerInput)
    if (res.success) {
      setSuccess('Timer aggiornato')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== COMPLETE ==========

  async function handleCompletePhase() {
    if (!confirm('Vuoi completare la fase svincolati?')) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.completePhase(leagueId)
    if (res.success) {
      setSuccess('Fase completata!')
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== BOT SIMULATION (ADMIN TEST) ==========

  async function handleBotNominate() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.botNominate(leagueId)
    if (res.success) {
      const data = res.data as { player?: { name: string }, nominator?: string }
      setSuccess(`Bot: ${data.nominator || 'Manager'} ha nominato ${data.player?.name || 'giocatore'}`)
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBotConfirmNomination() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.botConfirmNomination(leagueId)
    if (res.success) {
      const data = res.data as { player?: { name: string } }
      setSuccess(`Bot: Nominazione confermata per ${data.player?.name || 'giocatore'}`)
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleBotBid() {
    if (!board?.activeAuction) return
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.botBid(board.activeAuction.id)
    if (res.success) {
      const data = res.data as { hasBotBid: boolean, winningBot?: string, newCurrentPrice?: number }
      if (data.hasBotBid) {
        setSuccess(`Bot: ${data.winningBot} ha offerto ${data.newCurrentPrice}!`)
      } else {
        setSuccess('Nessun manager ha rilanciato')
      }
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  // ========== HELPERS ==========

  function getTimerClass() {
    if (timerRemaining === null) return 'text-gray-500'
    if (timerRemaining <= 5) return 'text-6xl font-bold text-danger-400 animate-pulse'
    if (timerRemaining <= 10) return 'text-6xl font-bold text-warning-400'
    return 'text-6xl font-bold text-secondary-400'
  }

  const isTimerExpired = timerRemaining !== null && timerRemaining <= 0
  const currentUsername = board?.turnOrder.find(m => m.id === board?.myMemberId)?.username
  const isUserWinning = board?.activeAuction?.bids?.[0]?.bidder === currentUsername

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento sala asta svincolati...</p>
        </div>
      </div>
    )
  }

  const isAdmin = board?.isAdmin || false
  const state = board?.state || 'SETUP'

  // ==================== SETUP: Turn Order ====================
  if (board?.isActive && state === 'SETUP' && isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300">
        <header className="py-6 border-b border-surface-50/20 bg-surface-200">
          <div className="max-w-2xl mx-auto px-4">
            <button onClick={() => onNavigate('leagueDetail', { leagueId })} className="text-primary-400 hover:text-primary-300 text-sm mb-2 flex items-center gap-1">
              <span>←</span> Torna alla lega
            </button>
            <h1 className="text-3xl font-bold text-white">Asta Svincolati - Ordine Turni</h1>
            <p className="text-gray-400 mt-1">Trascina i Direttori Generali per definire l'ordine dei turni</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-lg mb-6">{error}</div>}
          {success && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-4 rounded-lg mb-6">{success}</div>}

          {/* Timer Setting */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-6">
            <h3 className="font-bold text-white mb-3">Timer Asta</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimerInput(Math.max(10, timerInput - 5))}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-mono font-bold text-white">{timerInput}</span>
                <span className="text-gray-400 ml-2">secondi</span>
              </div>
              <button
                type="button"
                onClick={() => setTimerInput(Math.min(300, timerInput + 5))}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold"
              >
                +
              </button>
            </div>
            <Button size="sm" onClick={handleSetTimer} disabled={isSubmitting} className="w-full mt-3">
              Imposta Timer
            </Button>
          </div>

          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
                <span className="text-xl">👔</span>
              </div>
              <div>
                <h2 className="font-bold text-white">Direttori Generali</h2>
                <p className="text-sm text-gray-400">{turnOrderDraft.length} partecipanti</p>
              </div>
            </div>

            {turnOrderDraft.length === 0 ? (
              <div className="p-8 text-center text-warning-400">Nessun manager trovato</div>
            ) : (
              <div className="p-4 space-y-2">
                {turnOrderDraft.map((member, index) => (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                      draggedIndex === index
                        ? 'bg-primary-900/50 border-primary-500 shadow-glow scale-105'
                        : 'bg-surface-300 border-surface-50/20 hover:border-primary-500/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-100">{member.username}</p>
                    </div>
                    <span className="font-mono text-accent-400">{member.budget}</span>
                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-surface-50/20">
              <Button onClick={handleSetTurnOrder} disabled={isSubmitting || turnOrderDraft.length === 0} className="w-full py-3 text-lg font-bold">
                Conferma e Inizia Aste
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Non-admin waiting for setup
  if (board?.isActive && state === 'SETUP' && !isAdmin) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="bg-surface-200 rounded-xl p-8 text-center max-w-md border border-surface-50/20">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white mb-2">Sala Riunioni Svincolati</h2>
          <p className="text-gray-400">L'admin sta definendo l'ordine dei turni...</p>
        </div>
      </div>
    )
  }

  // Phase not active - show free agents in read-only mode
  if (!board?.isActive) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary-500/50 to-secondary-700/50 flex items-center justify-center">
                <span className="text-2xl">🔓</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Giocatori Svincolati</h1>
                <p className="text-gray-400 text-sm">Giocatori attualmente non in rosa</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <Input
                type="text"
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tutti i ruoli</option>
                <option value="P">Portieri</option>
                <option value="D">Difensori</option>
                <option value="C">Centrocampisti</option>
                <option value="A">Attaccanti</option>
              </select>
              <div className="relative" ref={teamDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                  className="bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2 min-w-[150px]"
                >
                  {selectedTeam ? (
                    <>
                      <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5">
                        <img src={getTeamLogo(selectedTeam)} alt={selectedTeam} className="w-4 h-4 object-contain" />
                      </div>
                      <span>{selectedTeam}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Squadra</span>
                  )}
                  <svg className={`w-4 h-4 ml-auto transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {teamDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => { setSelectedTeam(''); setTeamDropdownOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 ${!selectedTeam ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                    >
                      Tutte le squadre
                    </button>
                    {SERIE_A_TEAMS.map(team => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => { setSelectedTeam(team); setTeamDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                      >
                        <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                          <img src={getTeamLogo(team)} alt={team} className="w-4 h-4 object-contain" />
                        </div>
                        <span>{team}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Position Counters */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {(['P', 'D', 'C', 'A'] as const).map(pos => {
              const count = freeAgents.filter(p => p.position === pos).length
              const posNames: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
              return (
                <div
                  key={pos}
                  className={`bg-gradient-to-br ${POSITION_COLORS[pos]} rounded-xl p-3 text-center`}
                >
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-white/80">{posNames[pos]}</div>
                </div>
              )
            })}
          </div>

          {/* Free Agents Table */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-4 border-b border-surface-50/20">
              <h2 className="font-bold text-white">Giocatori Liberi ({freeAgents.length})</h2>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-300">
                  <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
                    <th className="text-left py-3 px-4 w-12">R</th>
                    <th className="text-left py-3 px-4">Giocatore</th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell">Squadra</th>
                  </tr>
                </thead>
                <tbody>
                  {freeAgents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-gray-500">
                        Nessun giocatore trovato con i filtri selezionati
                      </td>
                    </tr>
                  ) : (
                    freeAgents.map(player => (
                      <tr key={player.id} className="border-b border-surface-50/10 hover:bg-surface-300/30">
                        <td className="py-2 px-4">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-xs font-bold text-white`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 sm:hidden">
                              <img src={getTeamLogo(player.team)} alt={player.team} className="w-5 h-5 object-contain" />
                            </div>
                            <span className="font-medium text-white">{player.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5">
                              <img src={getTeamLogo(player.team)} alt={player.team} className="w-5 h-5 object-contain" />
                            </div>
                            <span className="text-gray-400">{player.team}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ==================== MAIN AUCTION ROOM ====================
  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="svincolati" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center shadow-glow">
                <span className="text-2xl">🔓</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Asta Svincolati</h1>
                <p className="text-gray-400 text-sm">
                  {state === 'COMPLETED' ? 'Fase completata' : 'Mercato libero'}
                </p>
              </div>
            </div>
            <div className="text-right bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
              <p className="text-3xl font-bold text-accent-400">{board?.myBudget || 0}</p>
            </div>
          </div>
        </div>

        {/* Turn Banner */}
        {board?.currentTurnUsername && state !== 'COMPLETED' && (
          <div className={`px-4 py-3 ${board.isMyTurn ? 'bg-accent-500/20 border-y border-accent-500/40' : 'bg-primary-500/10 border-y border-primary-500/30'}`}>
            <div className="max-w-full mx-auto flex items-center justify-center gap-3">
              {board.isMyTurn ? (
                <>
                  <span className="text-2xl">🎯</span>
                  <span className="text-lg font-bold text-accent-400">È IL TUO TURNO!</span>
                  <span className="text-2xl">🎯</span>
                </>
              ) : (
                <span className="text-gray-300">Turno di <strong className="text-primary-400">{board.currentTurnUsername}</strong></span>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="max-w-full mx-auto px-4 py-4 lg:py-6">
        {/* Error/Success Messages */}
        <div className="space-y-2 mb-4">
          {error && <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">{error}</div>}
          {success && <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg text-sm">{success}</div>}
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Admin Controls */}
          <div className={`lg:col-span-3 space-y-4 ${board?.activeAuction ? 'hidden lg:block' : ''}`}>
            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-3 border-b border-surface-50/20">
                  <h3 className="font-bold text-white text-sm">Controlli Admin</h3>
                </div>
                <div className="p-3 space-y-3">
                  {/* Timer */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Timer Asta</p>
                    <div className="flex flex-wrap gap-1">
                      {[10, 15, 20, 30, 45, 60].map(sec => (
                        <button
                          key={sec}
                          onClick={() => { setTimerInput(sec); handleSetTimer() }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            timerInput === sec
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-300 text-gray-400 hover:bg-surface-50/20 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Test Mode */}
                  <div className="pt-2 border-t border-surface-50/20 space-y-2">
                    <p className="text-xs text-accent-500 font-bold uppercase">Test Mode</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBotNominate}
                      disabled={isSubmitting || state !== 'READY_CHECK'}
                      className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
                    >
                      🎯 Simula Scelta Giocatore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBotConfirmNomination}
                      disabled={isSubmitting || state !== 'NOMINATION' || board?.nominatorConfirmed}
                      className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
                    >
                      ✅ Simula Conferma Scelta
                    </Button>
                    {board?.activeAuction && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBotBid}
                        disabled={isSubmitting}
                        className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10"
                      >
                        💰 Simula Offerta Bot
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleForceReady}
                      disabled={isSubmitting || state !== 'NOMINATION' || !board?.nominatorConfirmed}
                      className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                    >
                      Forza Tutti Pronti
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleForceAck}
                      disabled={isSubmitting || state !== 'PENDING_ACK'}
                      className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                    >
                      Forza Conferme
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleCompletePhase}
                      disabled={isSubmitting}
                      className="w-full text-xs"
                    >
                      Termina Fase
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Main Auction Area */}
          <div className="lg:col-span-5 space-y-4 order-first lg:order-none">
            {/* READY_CHECK - Player selection when it's my turn */}
            {state === 'READY_CHECK' && board?.isMyTurn && !board?.pendingPlayer && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
                <div className="p-4 border-b border-surface-50/20">
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">🎯</div>
                    <p className="text-lg font-bold text-accent-400">È il tuo turno!</p>
                    <p className="text-sm text-gray-400">Seleziona un giocatore svincolato</p>
                  </div>

                  {/* Search */}
                  <Input
                    placeholder="Cerca giocatore..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="mb-3 bg-surface-300 border-surface-50/30 text-white placeholder-gray-500"
                  />

                  {/* Filters */}
                  <div className="flex gap-2 mb-3">
                    <select
                      value={selectedPosition}
                      onChange={(e) => setSelectedPosition(e.target.value)}
                      className="flex-1 bg-surface-300 border border-surface-50/30 text-white rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Tutti i ruoli</option>
                      <option value="P">Portieri</option>
                      <option value="D">Difensori</option>
                      <option value="C">Centrocampisti</option>
                      <option value="A">Attaccanti</option>
                    </select>

                    {/* Team Dropdown */}
                    <div className="relative flex-1" ref={teamDropdownRef}>
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
                              <span className="truncate">{selectedTeam}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">Squadra</span>
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
                          {SERIE_A_TEAMS.map(team => (
                            <button
                              key={team}
                              type="button"
                              onClick={() => { setSelectedTeam(team); setTeamDropdownOpen(false) }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-300 flex items-center gap-2 ${selectedTeam === team ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                            >
                              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                                <img src={getTeamLogo(team)} alt={team} className="w-4 h-4 object-contain" />
                              </div>
                              <span>{team}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Player List */}
                <div className="max-h-[50vh] overflow-y-auto p-4 space-y-1">
                  {freeAgents.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nessun giocatore trovato</p>
                  ) : (
                    freeAgents.slice(0, 50).map(player => (
                      <button
                        key={player.id}
                        onClick={() => handleNominate(player.id)}
                        disabled={isSubmitting}
                        className="w-full flex items-center p-3 rounded-lg bg-surface-300 hover:bg-primary-500/10 border border-transparent hover:border-primary-500/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                            {player.position}
                          </span>
                          <div className="w-7 h-7 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
                            <img src={getTeamLogo(player.team)} alt={player.team} className="w-6 h-6 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white truncate">{player.name}</p>
                            <p className="text-xs text-gray-400 truncate">{player.team}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Pass button */}
                <div className="p-4 border-t border-surface-50/20">
                  <Button
                    variant="outline"
                    onClick={handlePassTurn}
                    disabled={isSubmitting}
                    className="w-full border-warning-500/30 text-warning-400 hover:bg-warning-500/10"
                  >
                    Passo (non chiamo più)
                  </Button>
                </div>
              </div>
            )}

            {/* READY_CHECK - Waiting for other player's turn */}
            {state === 'READY_CHECK' && !board?.isMyTurn && !board?.pendingPlayer && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-primary-500/20 flex items-center justify-center text-4xl mb-4">
                    ⏳
                  </div>
                  <p className="text-gray-400">In attesa...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Turno di <strong className="text-primary-400">{board?.currentTurnUsername}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* NOMINATION - Pending nomination */}
            {(state === 'NOMINATION' || (state === 'READY_CHECK' && board?.pendingPlayer)) && board?.pendingPlayer && (
              <div className="bg-surface-200 rounded-xl border-2 border-accent-500/50 overflow-hidden animate-pulse-slow">
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">
                    {board.pendingNominatorId === board.myMemberId && !board.nominatorConfirmed ? '🎯' : '⏳'}
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {board.pendingNominatorId === board.myMemberId && !board.nominatorConfirmed
                      ? 'Conferma la tua scelta'
                      : `${board.nominatorUsername} ha chiamato`}
                  </h2>

                  {/* Player Card */}
                  <div className="inline-flex items-center gap-3 bg-surface-300 rounded-lg p-4 mb-4">
                    <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${POSITION_COLORS[board.pendingPlayer.position]} flex items-center justify-center text-white font-bold text-lg`}>
                      {board.pendingPlayer.position}
                    </span>
                    <div className="w-10 h-10 bg-white/90 rounded flex items-center justify-center p-0.5">
                      <img src={getTeamLogo(board.pendingPlayer.team)} alt={board.pendingPlayer.team} className="w-8 h-8 object-contain" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-xl text-white">{board.pendingPlayer.name}</p>
                      <p className="text-gray-400">{board.pendingPlayer.team}</p>
                    </div>
                  </div>

                  {/* Nominator: Confirm/Cancel buttons */}
                  {board.pendingNominatorId === board.myMemberId && !board.nominatorConfirmed && (
                    <div className="space-y-3">
                      <div className="flex gap-3 justify-center">
                        <Button onClick={handleConfirmNomination} disabled={isSubmitting} className="px-8 py-3 text-lg font-bold">
                          {isSubmitting ? 'Attendi...' : '✓ CONFERMA'}
                        </Button>
                        <Button onClick={handleCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
                          Cambia
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">Dopo la conferma, gli altri Direttori Generali potranno dichiararsi pronti</p>
                    </div>
                  )}

                  {/* After confirmation - Ready status */}
                  {board.nominatorConfirmed && (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">DG pronti</span>
                          <span className="font-bold text-white">{board.readyMembers.length}/{board.turnOrder.length}</span>
                        </div>
                        <div className="w-full bg-surface-400 rounded-full h-2">
                          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${(board.readyMembers.length / board.turnOrder.length) * 100}%` }}></div>
                        </div>
                      </div>

                      {/* Ready/Waiting lists */}
                      <div className="bg-surface-300/50 rounded-lg p-3 text-left mb-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-secondary-400 font-semibold mb-1">✓ Pronti</p>
                            {board.turnOrder.filter(m => board.readyMembers.includes(m.id)).map(m => (
                              <p key={m.id} className="text-gray-300">{m.username}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-amber-400 font-semibold mb-1">⏳ In attesa</p>
                            {board.turnOrder.filter(m => !board.readyMembers.includes(m.id)).map(m => (
                              <p key={m.id} className="text-gray-400">{m.username}</p>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Non-nominator: SONO PRONTO button */}
                      {board.pendingNominatorId !== board.myMemberId && (
                        !board.readyMembers.includes(board.myMemberId) ? (
                          <Button onClick={handleMarkReady} disabled={isSubmitting} className="px-12 py-3 text-lg font-bold">
                            {isSubmitting ? 'Attendi...' : 'SONO PRONTO'}
                          </Button>
                        ) : (
                          <p className="text-secondary-400 font-medium">✓ Pronto - In attesa degli altri</p>
                        )
                      )}

                      {/* Nominator already confirmed */}
                      {board.pendingNominatorId === board.myMemberId && (
                        <p className="text-secondary-400 font-medium">✓ Confermato - In attesa degli altri</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* AUCTION - Active auction */}
            {state === 'AUCTION' && board?.activeAuction && (
              <div className="bg-surface-200 rounded-xl border border-primary-500/30 overflow-hidden">
                <div className="p-4 border-b border-surface-50/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔨</span>
                    <h3 className="font-bold text-white">Asta in Corso</h3>
                  </div>
                  {isUserWinning && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-secondary-500/20 text-secondary-400 rounded-full text-xs font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Stai vincendo!
                    </div>
                  )}
                </div>

                <div className="p-4 lg:p-6 space-y-4">
                  {/* Timer */}
                  {board.activeAuction.timerExpiresAt && (
                    <div className="text-center p-4 bg-surface-300/50 rounded-xl">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tempo rimanente</p>
                      <div className={getTimerClass()}>{timerRemaining ?? '--'}</div>
                      <p className="text-gray-500 text-sm mt-1">secondi</p>
                      {timerRemaining !== null && timerRemaining <= 10 && timerRemaining > 0 && (
                        <p className="text-xs text-amber-400 mt-2 animate-pulse">Affrettati!</p>
                      )}
                    </div>
                  )}

                  {/* Player Display */}
                  <div className="text-center p-5 bg-gradient-to-br from-surface-300 to-surface-200 rounded-xl border border-surface-50/20">
                    <div className="flex items-center justify-center gap-4 mb-3">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${POSITION_BG[board.activeAuction.player.position]}`}>
                        {board.activeAuction.player.position}
                      </span>
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 shadow-lg">
                        <img src={getTeamLogo(board.activeAuction.player.team)} alt={board.activeAuction.player.team} className="w-10 h-10 object-contain" />
                      </div>
                    </div>
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-1">{board.activeAuction.player.name}</h2>
                    <p className="text-lg text-gray-400">{board.activeAuction.player.team}</p>
                  </div>

                  {/* Current Price */}
                  <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-5 text-center">
                    <p className="text-sm text-primary-400 mb-2 uppercase tracking-wider">Offerta Attuale</p>
                    <p className="text-5xl lg:text-6xl font-bold text-white mb-2">{board.activeAuction.currentPrice}</p>
                    {board.activeAuction.bids.length > 0 && board.activeAuction.bids[0] && (
                      <p className={`text-lg ${board.activeAuction.bids[0].bidder === currentUsername ? 'text-secondary-400 font-bold' : 'text-primary-400'}`}>
                        di {board.activeAuction.bids[0].bidder}
                        {board.activeAuction.bids[0].bidder === currentUsername && ' (TU)'}
                      </p>
                    )}
                    {board.activeAuction.bids.length === 0 && (
                      <p className="text-gray-500">Base d'asta: {board.activeAuction.basePrice}</p>
                    )}
                  </div>

                  {/* Bid Controls */}
                  <div className="space-y-3 bg-surface-300/50 rounded-xl p-4">
                    {/* Message when finished */}
                    {board.isFinished && (
                      <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-3 text-center">
                        <p className="text-warning-400 text-sm font-medium">
                          Hai dichiarato di aver finito questa fase. Non puoi più fare offerte.
                        </p>
                      </div>
                    )}

                    {/* Quick Bid Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      {[2, 5, 10, 20].map(n => {
                        const newBid = parseInt(bidAmount || '0') + n
                        return (
                          <Button
                            key={n}
                            size="sm"
                            variant="outline"
                            onClick={() => setBidAmount(String(newBid))}
                            disabled={isTimerExpired || newBid > board.myBudget || board.isFinished}
                            className="border-surface-50/30 text-gray-300 hover:border-primary-500/50 hover:bg-primary-500/10 font-mono"
                          >
                            +{n}
                          </Button>
                        )
                      })}
                    </div>

                    {/* Main Bid Input with +/- */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBidAmount(String(Math.max(board.activeAuction!.currentPrice + 1, parseInt(bidAmount || '0') - 1)))}
                        disabled={isTimerExpired || parseInt(bidAmount || '0') <= board.activeAuction!.currentPrice + 1 || board.isFinished}
                        className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <Input
                        type="number"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        disabled={isTimerExpired || board.isFinished}
                        className="flex-1 text-xl text-center bg-surface-300 border-surface-50/30 text-white font-mono"
                        placeholder="Importo..."
                      />
                      <button
                        type="button"
                        onClick={() => setBidAmount(String(parseInt(bidAmount || '0') + 1))}
                        disabled={isTimerExpired || parseInt(bidAmount || '0') + 1 > board.myBudget || board.isFinished}
                        className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-surface-300 text-white hover:bg-surface-300/70 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                      <Button
                        onClick={handleBid}
                        disabled={isTimerExpired || !bidAmount || parseInt(bidAmount) > board.myBudget || board.isFinished}
                        className="px-6 lg:px-8 font-bold"
                      >
                        {board.isFinished ? 'Finito' : isTimerExpired ? 'Scaduto' : 'Offri'}
                      </Button>
                    </div>

                    {/* Budget reminder */}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Il tuo budget:</span>
                      <span className="font-bold text-accent-400">{board.myBudget}</span>
                    </div>

                    {isAdmin && (
                      <Button variant="secondary" onClick={handleCloseAuction} className="w-full mt-2">
                        Chiudi Asta Manualmente
                      </Button>
                    )}
                  </div>

                  {/* Bid History */}
                  {board.activeAuction.bids.length > 0 && (
                    <div className="border-t border-surface-50/20 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm text-gray-400 font-medium">Storico Offerte</h4>
                        <span className="text-xs text-gray-500">{board.activeAuction.bids.length} offerte</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {board.activeAuction.bids.map((bid, i) => (
                          <div
                            key={i}
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
                              <span className={`${i === 0 ? 'text-white font-medium' : 'text-gray-300'} ${bid.bidder === currentUsername ? 'text-secondary-400' : ''}`}>
                                {bid.bidder}
                                {bid.bidder === currentUsername && ' (tu)'}
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
              </div>
            )}

            {/* PENDING_ACK - Shows a message that modal is active */}
            {state === 'PENDING_ACK' && board?.pendingAck && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center">
                <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Conferma transazione in corso...</p>
              </div>
            )}

            {/* COMPLETED */}
            {state === 'COMPLETED' && (
              <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-8 text-center">
                <div className="text-4xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-white mb-2">Fase Svincolati Completata!</h2>
                <p className="text-gray-400">Tutti i manager hanno terminato le chiamate.</p>
              </div>
            )}
          </div>

          {/* RIGHT: DG List */}
          <div className={`lg:col-span-4 space-y-4 ${board?.activeAuction ? 'hidden lg:block' : ''}`}>
            {/* DG List with Turn Order */}
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
              <div className="p-3 border-b border-surface-50/20 sticky top-0 bg-surface-200 z-10">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👔</span>
                  <h3 className="font-bold text-white text-sm">Direttori Generali</h3>
                </div>
              </div>
              <div className="divide-y divide-surface-50/10 max-h-[60vh] overflow-y-auto">
                {board?.turnOrder.map((member, index) => {
                  const isCurrent = board.currentTurnMemberId === member.id
                  const isMe = member.id === board.myMemberId
                  const isPassed = member.hasPassed
                  const hasFinished = board.finishedMembers?.includes(member.id)

                  return (
                    <div
                      key={member.id}
                      className={`px-3 py-3 ${
                        isCurrent ? 'bg-accent-500/20 border-l-4 border-accent-500' : ''
                      } ${isMe && !isCurrent ? 'border-l-2 border-primary-500 bg-primary-500/5' : ''} ${
                        isPassed || hasFinished ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Turn Order Badge + Connection Indicator */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            isCurrent
                              ? 'bg-accent-500 text-white'
                              : isPassed || hasFinished
                              ? 'bg-surface-400 text-gray-500'
                              : 'bg-surface-300 text-gray-400'
                          }`}>
                            {index + 1}
                          </div>
                          {/* Connection status dot */}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-200 ${
                              member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                            }`}
                            title={member.isConnected ? 'Online' : 'Offline'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => handleViewManagerRoster(member)}
                            className={`font-medium truncate hover:underline cursor-pointer text-left ${isCurrent ? 'text-white' : 'text-gray-300'}`}
                            title="Clicca per vedere la rosa"
                          >
                            {member.username}
                            {isMe && <span className="text-primary-400 ml-1">(tu)</span>}
                          </button>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-accent-400 font-mono">{member.budget}</span>
                            {isPassed && <span className="text-warning-400 font-bold">PASS</span>}
                            {hasFinished && <span className="text-gray-400 font-bold">FINITO</span>}
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-accent-400 text-xs font-bold animate-pulse">TURNO</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Finished Phase Controls */}
              {board?.isActive && (
                <div className="p-3 border-t border-surface-50/10">
                  {board.isFinished ? (
                    <div className="text-center bg-surface-300/50 rounded-lg p-3">
                      <p className="text-gray-400 text-sm">Hai dichiarato di aver finito</p>
                      <p className="text-xs text-gray-500 mt-1">Non puoi più fare offerte</p>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeclareFinished}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      Ho Finito (non faccio più offerte)
                    </Button>
                  )}

                  {/* Progresso finiti */}
                  <div className="mt-2 text-center text-xs text-gray-400">
                    {board.finishedMembers?.length || 0}/{board.turnOrder.length} manager hanno finito
                  </div>

                  {/* Admin: Simula tutti finiti */}
                  {board.isAdmin && (board.finishedMembers?.length || 0) < board.turnOrder.length && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleForceAllFinished}
                      disabled={isSubmitting}
                      className="w-full mt-2"
                    >
                      🤖 Simula Tutti Finiti
                    </Button>
                  )}

                  {/* Admin: Chiudi fase quando tutti hanno finito */}
                  {board.isAdmin && board.finishedMembers?.length === board.turnOrder.length && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCompletePhase}
                      disabled={isSubmitting}
                      className="w-full mt-2"
                    >
                      Chiudi Fase Svincolati
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ==================== MODALS ==================== */}

      {/* Confirm Finish Modal */}
      {showFinishConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-md w-full border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-warning-500/20">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Conferma Fine Fase</h2>
                <p className="text-gray-400">
                  Stai per dichiarare di aver finito questa fase di mercato svincolati.
                </p>
              </div>

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-6">
                <p className="text-warning-400 text-sm text-center">
                  <strong>Attenzione:</strong> Questa azione è <strong>irreversibile</strong>.
                  Non potrai più fare offerte per nessun giocatore in questa fase.
                  Potrai comunque continuare a vedere le aste in corso.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowFinishConfirmModal(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmDeclareFinished}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Conferma
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgment Modal - Non mostrare se c'è un ricorso attivo */}
      {state === 'PENDING_ACK' && board?.pendingAck && !userHasAcked &&
       appealStatus?.auctionStatus !== 'APPEAL_REVIEW' &&
       appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' &&
       appealStatus?.auctionStatus !== 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${board.pendingAck.winnerUsername ? 'bg-secondary-500/20' : 'bg-surface-300'}`}>
                  <span className="text-3xl">{board.pendingAck.winnerUsername ? '✅' : '❌'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{board.pendingAck.winnerUsername ? 'Transazione Completata' : 'Asta Conclusa'}</h2>
              </div>

              <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                <p className="font-bold text-xl text-white mb-2">{board.pendingAck.playerName}</p>
              </div>

              {board.pendingAck.winnerUsername ? (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Acquistato da</p>
                  <p className="text-xl font-bold text-white">{board.pendingAck.winnerUsername}</p>
                  <p className="text-3xl font-bold text-accent-400 mt-1">{board.pendingAck.price}</p>
                </div>
              ) : (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="text-gray-400">Nessuna offerta - rimane svincolato</p>
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme</span>
                  <span className="text-white">{board.pendingAck.acknowledgedMembers.length}/{board.turnOrder.length}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div className="h-2 rounded-full bg-secondary-500 transition-all" style={{ width: `${(board.pendingAck.acknowledgedMembers.length / board.turnOrder.length) * 100}%` }}></div>
                </div>
              </div>

              {/* Appeal mode toggle */}
              {!isAppealMode ? (
                <div className="space-y-3">
                  <Button onClick={() => handleAcknowledge(false)} disabled={ackSubmitting} className="w-full py-3 font-bold">
                    {ackSubmitting ? 'Conferma...' : 'Ho Visto, Conferma'}
                  </Button>
                  <button
                    onClick={() => setIsAppealMode(true)}
                    className="w-full text-sm text-danger-400 hover:text-danger-300 transition-colors"
                  >
                    Contesta questa transazione (Ricorso)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-danger-400 font-medium">
                    Indica il motivo per cui contesti questa conclusione d'asta
                  </p>
                  <textarea
                    value={appealContent}
                    onChange={e => setAppealContent(e.target.value)}
                    className="w-full bg-surface-300 border border-danger-500/50 rounded-lg p-3 text-white placeholder-gray-500"
                    rows={3}
                    placeholder="Descrivi il motivo del ricorso..."
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setIsAppealMode(false); setAppealContent('') }}
                      className="flex-1 border-gray-500 text-gray-300"
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={() => handleAcknowledge(true)}
                      disabled={ackSubmitting || !appealContent.trim()}
                      className="flex-1 bg-danger-500 hover:bg-danger-600 text-white"
                    >
                      {ackSubmitting ? 'Invio...' : 'Invia Ricorso'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Admin: Test button */}
              {isAdmin && !isAppealMode && (
                <Button
                  onClick={handleSimulateAppeal}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Simula ricorso di un DG
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting Modal - After acknowledging, waiting for others */}
      {state === 'PENDING_ACK' && board?.pendingAck && userHasAcked &&
       appealStatus?.auctionStatus !== 'APPEAL_REVIEW' &&
       appealStatus?.auctionStatus !== 'AWAITING_APPEAL_ACK' &&
       appealStatus?.auctionStatus !== 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-sm w-full p-6 text-center border border-surface-50/20">
            <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-bold text-white mb-2">In attesa degli altri</h3>
            <p className="text-sm text-gray-400 mb-3">{board.pendingAck.acknowledgedMembers.length}/{board.turnOrder.length} confermati</p>
            <p className="text-xs text-gray-500 mb-4">
              Mancano: {board.turnOrder.filter(m => !board.pendingAck!.acknowledgedMembers.includes(m.id)).map(m => m.username).join(', ')}
            </p>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={handleForceAck} className="border-accent-500/50 text-accent-400">
                [TEST] Forza Conferme
              </Button>
            )}
          </div>
        </div>
      )}

      {/* APPEAL_REVIEW Modal - Asta bloccata in attesa decisione admin */}
      {appealStatus?.auctionStatus === 'APPEAL_REVIEW' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-danger-500/50">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-danger-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⚖️</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Ricorso in Valutazione</h2>
                <p className="text-gray-400 mt-1">L'admin della lega sta valutando il ricorso</p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              {appealStatus.appeal && (
                <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-danger-400 uppercase font-bold mb-2">Motivo del ricorso</p>
                  <p className="text-gray-300">{appealStatus.appeal.reason}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Presentato da: <span className="text-white">{appealStatus.appeal.submittedBy?.username}</span>
                  </p>
                </div>
              )}

              {appealStatus.winner && (
                <div className="bg-primary-500/10 rounded-lg p-4 mb-4 text-center border border-primary-500/30">
                  <p className="text-sm text-primary-400">Transazione contestata</p>
                  <p className="text-lg font-bold text-white">{appealStatus.winner.username}</p>
                  <p className="text-2xl font-bold text-accent-400 mt-1">{appealStatus.finalPrice}</p>
                </div>
              )}

              <div className="text-center text-gray-400 text-sm">
                <p>L'asta è in pausa fino alla decisione dell'admin</p>
              </div>

              {isAdmin && (
                <Button
                  onClick={() => onNavigate('admin', { leagueId, tab: 'appeals' })}
                  className="w-full mt-4 bg-danger-500 hover:bg-danger-600 text-white font-bold py-3"
                >
                  Gestisci Ricorso
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_APPEAL_ACK Modal - Tutti devono confermare di aver visto la decisione */}
      {appealStatus?.auctionStatus === 'AWAITING_APPEAL_ACK' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${appealStatus.appeal?.status === 'ACCEPTED' ? 'bg-warning-500/20' : 'bg-secondary-500/20'}`}>
                  <span className="text-3xl">{appealStatus.appeal?.status === 'ACCEPTED' ? '🔄' : '✅'}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  Ricorso {appealStatus.appeal?.status === 'ACCEPTED' ? 'Accolto' : 'Respinto'}
                </h2>
                <p className="text-gray-400 mt-1">
                  {appealStatus.appeal?.status === 'ACCEPTED'
                    ? 'La transazione è stata annullata, l\'asta riprenderà'
                    : 'La transazione è confermata'}
                </p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              {appealStatus.appeal?.adminNotes && (
                <div className="bg-surface-300 border border-surface-50/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Note dell'admin</p>
                  <p className="text-gray-300">{appealStatus.appeal.adminNotes}</p>
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Conferme presa visione</span>
                  <span className="text-white">{appealStatus.appealDecisionAcks?.length || 0}/{appealStatus.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-secondary-500 transition-all"
                    style={{ width: `${((appealStatus.appealDecisionAcks?.length || 0) / (appealStatus.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus.allMembers && appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.appealDecisionAcks?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {!appealStatus.userHasAcked ? (
                <Button
                  onClick={handleAcknowledgeAppealDecision}
                  disabled={ackSubmitting}
                  className="w-full py-3 font-bold"
                >
                  {ackSubmitting ? 'Conferma...' : 'Ho Preso Visione'}
                </Button>
              ) : (
                <div className="text-center text-secondary-400">
                  <p>✓ Hai confermato. In attesa degli altri...</p>
                </div>
              )}

              {isAdmin && (
                <Button
                  onClick={handleForceAllAppealAcks}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Forza Tutte le Conferme
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AWAITING_RESUME Modal - Ready check prima di riprendere l'asta */}
      {appealStatus?.auctionStatus === 'AWAITING_RESUME' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-accent-500/50 animate-pulse-slow">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔄</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Ripresa Asta</h2>
                <p className="text-gray-400 mt-1">Tutti devono confermare di essere pronti</p>
              </div>

              {appealStatus.player && (
                <div className="bg-surface-300 rounded-lg p-4 mb-4 text-center">
                  <p className="font-bold text-white">{appealStatus.player.name}</p>
                  <p className="text-sm text-gray-400">{appealStatus.player.team}</p>
                </div>
              )}

              <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4 mb-4 text-center">
                <p className="text-warning-400 font-medium">
                  Il ricorso è stato accolto. L'asta riprenderà dall'ultima offerta valida.
                </p>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">DG pronti</span>
                  <span className="text-white">{appealStatus.resumeReadyMembers?.length || 0}/{appealStatus.allMembers?.length || 0}</span>
                </div>
                <div className="w-full bg-surface-400 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-accent-500 transition-all"
                    style={{ width: `${((appealStatus.resumeReadyMembers?.length || 0) / (appealStatus.allMembers?.length || 1)) * 100}%` }}
                  ></div>
                </div>
                {appealStatus.allMembers && appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Mancano: {appealStatus.allMembers.filter(m => !appealStatus.resumeReadyMembers?.includes(m.id)).map(m => m.username).join(', ')}
                  </p>
                )}
              </div>

              {!appealStatus.userIsReady ? (
                <Button
                  onClick={handleReadyToResume}
                  disabled={ackSubmitting}
                  className="w-full py-3 font-bold bg-accent-500 hover:bg-accent-600"
                >
                  {ackSubmitting ? 'Conferma...' : 'Sono Pronto'}
                </Button>
              ) : (
                <div className="text-center text-accent-400">
                  <p>✓ Sei pronto. In attesa degli altri...</p>
                </div>
              )}

              {isAdmin && (
                <Button
                  onClick={handleForceAllReadyResume}
                  variant="outline"
                  className="w-full mt-3 text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                >
                  [TEST] Forza Tutti Pronti
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Modification Modal after Svincolati Win */}
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
          description="Hai appena acquistato questo svincolato. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}

      {/* Manager Roster Modal */}
      {(selectedManager || loadingManager) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedManager(null)}>
          <div className="bg-surface-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-surface-50/20" onClick={e => e.stopPropagation()}>
            {loadingManager ? (
              <div className="p-6 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : selectedManager && (
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
                  const POSITION_NAMES: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
                  return (
                    <div key={pos} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${POSITION_COLORS[pos]}`}>{pos}</span>
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
