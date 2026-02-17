import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { rubataApi, leagueApi, auctionApi, contractApi } from '../services/api'
import { usePusherAuction } from '../services/pusher.client'
import type {
  LeagueMember,
  BoardData,
  BoardPlayer,
  BoardPlayerWithPreference,
  PreviewBoardData,
  ReadyStatus,
  PendingAck,
  RubataPreference,
  ContractForModification,
  AppealStatus,
  ProgressStats,
} from '../types/rubata.types'
import type { PlayerInfo } from '../components/PlayerStatsModal'

export function useRubataState(leagueId: string) {
  const { confirm: confirmDialog } = useConfirmDialog()
  // Core state
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

  // Steal announcement tracking
  const [lastSeenAuctionId, setLastSeenAuctionId] = useState<string | null>(null)

  // Prophecy for transaction confirmation
  const [prophecyContent, setProphecyContent] = useState('')

  // Appeal / Ricorso state
  const [isAppealMode, setIsAppealMode] = useState(false)
  const [appealContent, setAppealContent] = useState('')
  const [appealStatus, setAppealStatus] = useState<AppealStatus | null>(null)

  // Session ID for Pusher subscription
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<PlayerInfo | null>(null)

  // Drag and drop state (kept for visual feedback via useSortable's isDragging)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Preview mode state
  const [previewBoard, setPreviewBoard] = useState<PreviewBoardData | null>(null)
  const [selectedPlayerForPrefs, setSelectedPlayerForPrefs] = useState<BoardPlayerWithPreference | null>(null)

  // Contract modification after rubata win
  const [pendingContractModification, setPendingContractModification] = useState<ContractForModification | null>(null)

  // Ref for current player row/card to scroll into view
  const currentPlayerRef = useRef<HTMLElement>(null)

  // Track if current player is visible in viewport
  const [isCurrentPlayerVisible, setIsCurrentPlayerVisible] = useState(true)

  // Track if timers have been initialized
  const timersInitialized = useRef(false)

  // Stores winner contract info from acknowledge response
  const pendingWinnerContractRef = useRef<ContractForModification | null>(null)

  // ========== Timer countdown effect ==========
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

      return () => { clearInterval(interval); }
    } else {
      setTimerDisplay(null)
    }
  }, [boardData?.rubataState, boardData?.remainingSeconds])

  // ========== Scroll to current player when it changes ==========
  useEffect(() => {
    if (currentPlayerRef.current) {
      currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [boardData?.currentIndex])

  // ========== IntersectionObserver to track if current player is visible ==========
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
      { threshold: 0.1 }
    )

    observer.observe(currentEl)

    return () => {
      observer.disconnect()
    }
  }, [boardData?.currentIndex, boardData?.board])

  // ========== Scroll to current player function ==========
  const scrollToCurrentPlayer = useCallback(() => {
    if (currentPlayerRef.current) {
      currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // ========== Show contract modal when state transitions out of PENDING_ACK ==========
  useEffect(() => {
    const state = boardData?.rubataState
    if (state && state !== 'PENDING_ACK' && pendingWinnerContractRef.current) {
      setPendingContractModification(pendingWinnerContractRef.current)
      pendingWinnerContractRef.current = null
    }
  }, [boardData?.rubataState])

  // ========== Track auction ID to avoid duplicate modals ==========
  useEffect(() => {
    if (boardData?.activeAuction && boardData.rubataState === 'AUCTION') {
      const auctionId = boardData.activeAuction.id
      if (auctionId !== lastSeenAuctionId) {
        setLastSeenAuctionId(auctionId)
      }
    }
  }, [boardData?.activeAuction?.id, boardData?.rubataState, lastSeenAuctionId])

  // ========== Auto-set bid amount ==========
  useEffect(() => {
    if (boardData?.activeAuction && boardData.rubataState === 'AUCTION') {
      const minBid = boardData.activeAuction.currentPrice + 1
      if (bidAmount < minBid) {
        setBidAmount(minBid)
      }
      if (simulateBidAmount < minBid) {
        setSimulateBidAmount(minBid)
      }
    }
  }, [boardData?.activeAuction?.currentPrice, boardData?.rubataState])

  // ========== Loading functions ==========
  const loadBoardOnly = useCallback(async () => {
    const boardRes = await rubataApi.getBoard(leagueId)
    if (boardRes.success && boardRes.data) {
      setBoardData(boardRes.data as BoardData)
      const data = boardRes.data as BoardData
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
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

  const loadFast = useCallback(async () => {
    const [boardRes, readyRes] = await Promise.all([
      rubataApi.getBoard(leagueId),
      rubataApi.getReadyStatus(leagueId),
    ])
    if (boardRes.success && boardRes.data) {
      setBoardData(boardRes.data as BoardData)
      const data = boardRes.data as BoardData
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
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
      if (!timersInitialized.current) {
        setOfferTimer(data.offerTimerSeconds)
        setAuctionTimer(data.auctionTimerSeconds)
        timersInitialized.current = true
      }
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

  // ========== Pusher integration ==========
  const { isConnected: isPusherConnected } = usePusherAuction(sessionId, {
    onRubataStealDeclared: (data) => {
      console.log('[Pusher] Rubata steal declared - fast refresh', data)
      loadFast()
    },
    onRubataBidPlaced: (data) => {
      console.log('[Pusher] Rubata bid placed - instant update', data)
      if (data.bidderId !== boardData?.myMemberId) {
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
      setTimeout(() => loadBoardOnly(), 100)
    },
    onRubataReadyChanged: (data) => {
      console.log('[Pusher] Rubata ready changed - instant update', data)
      setReadyStatus(prev => {
        if (!prev) return prev
        const isMyUpdate = data.memberId === boardData?.myMemberId
        if (isMyUpdate) return prev

        return {
          ...prev,
          readyCount: data.readyCount,
          allReady: data.readyCount >= data.totalMembers,
        }
      })
      setTimeout(() => loadReadyOnly(), 100)
    },
    onAuctionClosed: () => {
      console.log('[Pusher] Auction closed - full refresh')
      loadData()
    },
  })

  // ========== Initial load ==========
  useEffect(() => {
    loadData()
  }, [loadData])

  // ========== Adaptive polling ==========
  useEffect(() => {
    const getPollingInterval = () => {
      const state = boardData?.rubataState

      if (isPusherConnected) {
        if (state === 'AUCTION') return 3000
        if (state === 'AUCTION_READY_CHECK') return 3000
        if (state === 'OFFERING') return 3000
        return 5000
      }

      if (state === 'AUCTION') return 800
      if (state === 'AUCTION_READY_CHECK') return 1000
      if (state === 'OFFERING') return 1500
      return 3000
    }

    const interval = setInterval(() => {
      const state = boardData?.rubataState
      if (state === 'AUCTION' || state === 'AUCTION_READY_CHECK') {
        loadFast()
      } else if (state === 'PENDING_ACK') {
        loadAckOnly()
      } else {
        loadBoardOnly()
      }
    }, getPollingInterval())

    return () => { clearInterval(interval); }
  }, [loadBoardOnly, loadFast, loadAckOnly, boardData?.rubataState, isPusherConnected])

  // ========== Heartbeat ==========
  useEffect(() => {
    const myId = boardData?.myMemberId || readyStatus?.myMemberId
    if (!myId) return

    const sendHeartbeat = async () => {
      try {
        await rubataApi.sendHeartbeat(leagueId, myId)
      } catch (e) {
        console.error('[Rubata] Heartbeat error:', e)
      }
    }

    sendHeartbeat()

    const interval = setInterval(sendHeartbeat, 3000)
    return () => { clearInterval(interval); }
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
    const ok = await confirmDialog({
      title: 'Completa rubata',
      message: 'Vuoi completare la rubata con transazioni casuali? Questo è irreversibile.',
      confirmLabel: 'Completa',
      variant: 'danger'
    })
    if (!ok) return
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
    if (!boardData?.currentPlayer) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.makeOffer(leagueId)
    if (res.success) {
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

    const currentUser = members.find(m => m.id === myId)
    const currentUsername = currentUser?.user?.username || 'Tu'

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

    const submittedAmount = bidAmount
    setBidAmount(bidAmount + 1)

    const res = await rubataApi.bidOnAuction(leagueId, submittedAmount)
    if (res.success) {
      loadBoardOnly()
    } else {
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
        setAppealStatus(result.data as AppealStatus)
      } else {
        setAppealStatus(null)
      }
    } else {
      setAppealStatus(null)
    }
  }, [pendingAck?.auctionId])

  useEffect(() => {
    loadAppealStatus()
    const interval = setInterval(loadAppealStatus, 5000)
    return () => { clearInterval(interval); }
  }, [loadAppealStatus])

  async function handleAcknowledgeWithAppeal() {
    if (!pendingAck) return
    setError('')
    setIsSubmitting(true)

    if (isAppealMode && appealContent.trim()) {
      const appealResult = await auctionApi.submitAppeal(pendingAck.auctionId, appealContent.trim())
      if (!appealResult.success) {
        setError(appealResult.message || 'Errore nell\'invio del ricorso')
        setIsSubmitting(false)
        return
      }
      setSuccess('Ricorso inviato!')
    }

    const res = await rubataApi.acknowledge(leagueId, prophecyContent.trim() || undefined)
    if (res.success) {
      setProphecyContent('')
      setAppealContent('')
      setIsAppealMode(false)

      const data = res.data as { winnerContractInfo?: ContractForModification } | undefined
      if (data?.winnerContractInfo) {
        const playerInfo = pendingAck?.player
        pendingWinnerContractRef.current = {
          ...data.winnerContractInfo,
          playerTeam: playerInfo?.team,
          playerPosition: playerInfo?.position,
        }
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

  // ========== Contract Modification ==========

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
    if (!simulateMemberId || !boardData?.currentPlayer) return
    setError('')
    setIsSubmitting(true)

    const res = await rubataApi.simulateOffer(leagueId, simulateMemberId)
    if (res.success) {
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

    const hasStrategy = data.maxBid !== null || data.priority !== null || !!(data.notes && data.notes.trim() !== '')
    const res = await rubataApi.setPreference(leagueId, selectedPlayerForPrefs.playerId, {
      ...data,
      isWatchlist: hasStrategy,
      isAutoPass: false,
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

  // Load preferences whenever there's a board
  useEffect(() => {
    if (boardData?.isRubataPhase && boardData?.board && boardData.board.length > 0) {
      loadPreviewBoard()
    }
  }, [boardData?.isRubataPhase, boardData?.board?.length])

  // Preferences map
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

  // Progress stats
  const progressStats = useMemo<ProgressStats | null>(() => {
    const board = boardData?.board
    if (!board || boardData?.currentIndex === null || boardData?.currentIndex === undefined) {
      return null
    }

    const currentIndex = boardData.currentIndex
    const totalPlayers = board.length
    const remaining = totalPlayers - currentIndex - 1

    const currentPlayer = boardData.currentPlayer
    const currentManagerId = currentPlayer?.memberId
    if (!currentManagerId) {
      return { currentIndex, totalPlayers, remaining, managerProgress: null }
    }

    const managerPlayers = board.filter(p => p.memberId === currentManagerId)
    const managerTotal = managerPlayers.length

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

  function handleDndDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDraggedId(null)
    if (over && active.id !== over.id) {
      setOrderDraft(prev => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function handleDndDragStart(event: { active: { id: string | number } }) {
    setDraggedId(String(event.active.id))
  }

  // ========== Derived state ==========
  const isRubataPhase = boardData?.isRubataPhase || false
  const board = boardData?.board
  const isOrderSet = !!(board && board.length > 0)
  const rubataState = boardData?.rubataState
  const currentPlayer = boardData?.currentPlayer
  const activeAuction = boardData?.activeAuction
  const myMemberId = boardData?.myMemberId
  const canMakeOffer = rubataState === 'OFFERING' && currentPlayer && currentPlayer.memberId !== myMemberId

  const currentPlayerPreference = currentPlayer ? preferencesMap.get(currentPlayer.playerId) : null

  const canEditPreferences = !rubataState ||
    rubataState === 'WAITING' ||
    rubataState === 'PREVIEW' ||
    rubataState === 'READY_CHECK' ||
    rubataState === 'PAUSED' ||
    rubataState === 'AUCTION_READY_CHECK'

  return {
    // Loading / meta state
    isLoading,
    isAdmin,
    error,
    success,
    isSubmitting,

    // Core data
    members,
    boardData,
    board,
    rubataState,
    currentPlayer,
    activeAuction,
    myMemberId,
    isRubataPhase,
    isOrderSet,
    canMakeOffer,
    isPusherConnected,

    // Timer
    timerDisplay,
    offerTimer,
    setOfferTimer,
    auctionTimer,
    setAuctionTimer,

    // Budget
    budgetPanelOpen,
    setBudgetPanelOpen,
    mobileBudgetExpanded,
    setMobileBudgetExpanded,

    // Ready check
    readyStatus,

    // Pending ack
    pendingAck,

    // Appeal
    appealStatus,
    isAppealMode,
    setIsAppealMode,
    appealContent,
    setAppealContent,

    // Prophecy
    prophecyContent,
    setProphecyContent,

    // Bid
    bidAmount,
    setBidAmount,

    // Admin simulation
    simulateMemberId,
    setSimulateMemberId,
    simulateBidAmount,
    setSimulateBidAmount,

    // Order draft + drag and drop
    orderDraft,
    setOrderDraft,
    draggedId,
    moveInOrder,
    handleDndDragEnd,
    handleDndDragStart,

    // Preferences
    preferencesMap,
    previewBoard,
    selectedPlayerForPrefs,
    openPrefsModal,
    closePrefsModal,
    currentPlayerPreference,
    canEditPreferences,

    // Progress
    progressStats,

    // Scroll helpers
    currentPlayerRef,
    isCurrentPlayerVisible,
    scrollToCurrentPlayer,

    // Contract modification
    pendingContractModification,

    // Player stats
    selectedPlayerForStats,
    setSelectedPlayerForStats,

    // ========== Action handlers ==========
    // Admin
    handleSetOrder,
    handleGenerateBoard,
    handleStartRubata,
    handleUpdateTimers,
    handlePause,
    handleResume,
    handleAdvance,
    handleGoBack,
    handleCloseAuction,
    handleCompleteRubata,
    handleSetToPreview,

    // Player
    handleMakeOffer,
    handleBid,

    // Ready check
    handleSetReady,
    handleForceAllReady,

    // Ack
    handleAcknowledge,
    handleForceAllAcknowledge,
    handleAcknowledgeWithAppeal,

    // Appeal
    handleAcknowledgeAppealDecision,
    handleMarkReadyToResume,
    handleForceAllAppealAcks,
    handleForceAllReadyResume,
    handleSimulateAppeal,

    // Contract
    handleContractModification,
    handleSkipContractModification,

    // Simulation
    handleSimulateOffer,
    handleSimulateBid,

    // Preferences
    handleSavePreference,
    handleDeletePreference,

    // Retry / reload
    setError,
    loadData,

    // Navigation helper
    onNavigate: undefined as unknown as (page: string, params?: Record<string, string>) => void,
  }
}

export type UseRubataStateReturn = ReturnType<typeof useRubataState>
