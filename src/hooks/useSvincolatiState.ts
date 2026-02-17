import { useState, useEffect, useRef, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { svincolatiApi, leagueApi, auctionApi, contractApi } from '../services/api'
import { usePusherAuction } from '../services/pusher.client'
import type {
  AppealStatus,
  Player,
  TurnMember,
  BoardState,
  ContractForModification,
  ManagerRosterPlayer,
  SelectedManagerData,
} from '../types/svincolati.types'

export function useSvincolatiState(leagueId: string) {
  const { confirm: confirmDialog } = useConfirmDialog()
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
  const [draggedId, setDraggedId] = useState<string | null>(null)

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
  const [pendingContractModification, setPendingContractModification] = useState<ContractForModification | null>(null)

  // Manager roster modal
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
    return () => { document.removeEventListener('mousedown', handleClickOutside); }
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

  // Poll for board updates (fallback, Pusher handles instant updates)
  useEffect(() => {
    const interval = setInterval(loadBoard, 8000)
    return () => { clearInterval(interval); }
  }, [loadBoard])

  // Pusher real-time updates (#110, #113)
  const { isConnected: isPusherConnected } = usePusherAuction(board?.sessionId, {
    onSvincolatiStateChanged: () => {
      console.log('[Pusher] Svincolati state changed')
      loadBoard()
    },
    onSvincolatiNomination: () => {
      console.log('[Pusher] Svincolati nomination')
      loadBoard()
    },
    onSvincolatiBidPlaced: (data) => {
      console.log('[Pusher] Svincolati bid placed', data)
      // Instant UI update for bids from others
      if (data.bidderId !== board?.myMemberId) {
        setBoard(prev => {
          if (!prev?.activeAuction) return prev
          return {
            ...prev,
            activeAuction: {
              ...prev.activeAuction,
              currentPrice: data.amount,
              bids: [
                { amount: data.amount, bidder: data.bidderUsername, bidderId: data.bidderId, isWinning: true },
                ...prev.activeAuction.bids.map(b => ({ ...b, isWinning: false })),
              ],
            },
          }
        })
      }
      setTimeout(() => loadBoard(), 100)
    },
    onSvincolatiReadyChanged: (data) => {
      console.log('[Pusher] Svincolati ready changed', data)
      setBoard(prev => prev ? { ...prev, readyMembers: data.readyMembers } : prev)
    },
    onBidPlaced: (data) => {
      // Also listen to generic bid events (used by svincolati auction engine)
      console.log('[Pusher] Generic bid placed in svincolati', data)
      loadBoard()
    },
    onAuctionClosed: () => {
      console.log('[Pusher] Svincolati auction closed')
      loadBoard()
    },
    onMemberReady: () => {
      console.log('[Pusher] Svincolati member ready')
      loadBoard()
    },
  })

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
    return () => { clearInterval(interval); }
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
      return () => { clearInterval(interval); }
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
    return () => { clearInterval(interval); }
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

  function handleDndDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggedId(null)
    if (over && active.id !== over.id) {
      setTurnOrderDraft(prev => {
        const oldIndex = prev.findIndex(m => m.id === String(active.id))
        const newIndex = prev.findIndex(m => m.id === String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function handleDndDragStart(event: { active: { id: string | number } }) {
    setDraggedId(String(event.active.id))
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
    const ok = await confirmDialog({
      title: 'Passa turno',
      message: 'Vuoi passare il turno? Non chiamerai più giocatori in questa fase.',
      confirmLabel: 'Passa',
      variant: 'warning'
    })
    if (!ok) return
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

  // ========== PAUSE / RESUME ==========

  async function handlePause() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.pause(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
  }

  async function handleResume() {
    setError('')
    setIsSubmitting(true)

    const res = await svincolatiApi.resume(leagueId)
    if (res.success) {
      loadBoard()
    } else {
      setError(res.message || 'Errore')
    }
    setIsSubmitting(false)
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
    const ok = await confirmDialog({
      title: 'Completa fase svincolati',
      message: 'Vuoi completare la fase svincolati?',
      confirmLabel: 'Completa',
      variant: 'warning'
    })
    if (!ok) return
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

  return {
    // Loading
    isLoading,

    // Board state
    board,
    setBoard,

    // Free agents
    freeAgents,

    // Filters
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedTeam,
    setSelectedTeam,
    teamDropdownOpen,
    setTeamDropdownOpen,
    teamDropdownRef,

    // Turn order setup
    turnOrderDraft,
    setTurnOrderDraft,
    draggedId,

    // Auction
    bidAmount,
    setBidAmount,
    timerRemaining,

    // Messages
    error,
    success,
    isSubmitting,

    // Timer settings
    timerInput,
    setTimerInput,

    // Appeal/Acknowledgment system
    isAppealMode,
    setIsAppealMode,
    appealContent,
    setAppealContent,
    appealStatus,
    ackSubmitting,
    userHasAcked,

    // Confirm finish modal
    showFinishConfirmModal,
    setShowFinishConfirmModal,

    // Contract modification
    pendingContractModification,

    // Manager roster modal
    selectedManager,
    setSelectedManager,
    loadingManager,

    // Pusher connection
    isPusherConnected,

    // Derived state
    isTimerExpired,
    currentUsername,
    isUserWinning,

    // Helper functions
    getTimerClass,

    // Turn order handlers
    handleDndDragEnd,
    handleDndDragStart,
    handleSetTurnOrder,

    // Manager roster handlers
    handleViewManagerRoster,

    // Nomination handlers
    handleNominate,
    handleConfirmNomination,
    handleCancelNomination,
    handlePassTurn,

    // Finished phase handlers
    handleDeclareFinished,
    confirmDeclareFinished,
    handleUndoFinished,
    handleForceAllFinished,

    // Ready handlers
    handleMarkReady,
    handleForceReady,

    // Auction handlers
    handleBid,
    handleCloseAuction,

    // Acknowledgment handlers
    handleAcknowledge,
    handleForceAck,

    // Contract modification handlers
    handleContractModification,
    handleSkipContractModification,

    // Appeal handlers
    handleSimulateAppeal,
    handleAcknowledgeAppealDecision,
    handleReadyToResume,
    handleForceAllAppealAcks,
    handleForceAllReadyResume,

    // Pause/Resume handlers
    handlePause,
    handleResume,

    // Timer handlers
    handleSetTimer,

    // Complete handler
    handleCompletePhase,

    // Bot simulation handlers
    handleBotNominate,
    handleBotConfirmNomination,
    handleBotBid,

    // Data loaders (exposed for refresh)
    loadBoard,
    loadFreeAgents,
    loadAppealStatus,
    setError,
  }
}
