import { useState, useEffect, useCallback, useRef } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { auctionApi, playerApi, firstMarketApi, adminApi, contractApi } from '../services/api'
import { usePusherAuction } from '../services/pusher.client'
import { useServerTime } from './useServerTime'
import haptic from '../utils/haptics'
import sounds from '../utils/sounds'
import type {
  DragEndEvent} from '@dnd-kit/core';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type {
  Player,
  Bid,
  Auction,
  Membership,
  SessionInfo,
  MarketProgress,
  PendingAcknowledgment,
  ReadyStatus,
  AppealStatus,
  MyRosterSlots,
  ManagerData,
  ManagersStatusData,
  FirstMarketStatus,
  ContractForModification,
} from '../types/auctionroom.types'
import type { Appeal } from '../components/admin/types'

export function useAuctionRoomState(sessionId: string, leagueId: string) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const [auction, setAuction] = useState<Auction | null>(null)
  const auctionRef = useRef<Auction | null>(null)
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
  const { getRemainingSeconds } = useServerTime()

  const [firstMarketStatus, setFirstMarketStatus] = useState<FirstMarketStatus | null>(null)
  const [turnOrderDraft, setTurnOrderDraft] = useState<string[]>([])

  const [readyStatus, setReadyStatus] = useState<ReadyStatus | null>(null)
  const [markingReady, setMarkingReady] = useState(false)

  const [pendingAck, setPendingAck] = useState<PendingAcknowledgment | null>(null)
  const pendingAckLockedRef = useRef<string | null>(null) // Holds auctionId when locally created
  // Ultima asta riapribile (= annulla ultimo movimento), indip. da pendingAck. test-session #28
  const [lastReopenableAuction, setLastReopenableAuction] = useState<
    { id: string; playerName: string; winnerName: string } | null
  >(null)
  const [prophecyContent, setProphecyContent] = useState('')
  const [ackSubmitting, setAckSubmitting] = useState(false)
  const [isAppealMode, setIsAppealMode] = useState(false)
  const [appealContent, setAppealContent] = useState('')

  const [myRosterSlots, setMyRosterSlots] = useState<MyRosterSlots | null>(null)
  const [managersStatus, setManagersStatus] = useState<ManagersStatusData | null>(null)
  const [selectedManager, setSelectedManager] = useState<ManagerData | null>(null)

  const [appealStatus, setAppealStatus] = useState<AppealStatus | null>(null)


  // Bid submission guard (T-001: debounce + loading, T-003: offline block)
  const [isBidding, setIsBidding] = useState(false)
  const lastBidTimeRef = useRef<number>(0)

  // Contract modification after winning auction
  const [pendingContractModification, setPendingContractModification] = useState<ContractForModification | null>(null)

  // Pause request notification (shown to admin)
  const [pauseRequest, setPauseRequest] = useState<{ username: string; type: string } | null>(null)

  // Admin actions panel: pending appeals of the league (admin only)
  const [pendingAppeals, setPendingAppeals] = useState<Appeal[]>([])
  const [resolvingAppealId, setResolvingAppealId] = useState<string | null>(null)

  // Keep auction ref in sync for polling phase-awareness (avoids useEffect dependency)
  useEffect(() => { auctionRef.current = auction }, [auction])

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
            teamName: data.teamName, // #25: from Pusher payload — consistent across clients in real-time
            user: { username: data.memberName }
          }
        }

        // Dedup: sul client che ha piazzato/triggerato l'offerta, loadCurrentAuction
        // può aver già inserito la stessa bid dal DB (con teamName) → evita il doppione
        // nello storico quando arriva anche l'evento Pusher. (#23)
        const alreadyPresent = prev.bids.some(
          b => b.amount === data.amount && b.bidder?.user?.username === data.memberName
        )

        return {
          ...prev,
          currentPrice: data.amount,
          bids: alreadyPresent ? prev.bids : [newBid, ...prev.bids],
          // Update timer immediately from Pusher data - NO DELAY!
          timerExpiresAt: data.timerExpiresAt,
          timerSeconds: data.timerSeconds
        }
      })
      // Auto-fill the bid input to the new minimum (offer+1) in real-time, unless the
      // user already typed a higher value (mirrors loadCurrentAuction). test-session #9
      setBidAmount(prev => (parseInt(prev) || 0) <= data.amount ? String(data.amount + 1) : prev)
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
      void loadFirstMarketStatus()
    },
    onNominationConfirmed: (data) => {
      console.log('[Pusher] Nomination confirmed:', data)
      // Nomination confirmed: reload the FULL relevant state so non-nominator
      // clients switch from the "waiting for nomination" view to the active
      // auction in real-time. loadFirstMarketStatus drives that view switch —
      // without it the others stayed on the waiting view until polling. (#19)
      void loadCurrentAuction()
      void loadReadyStatus()
      void loadFirstMarketStatus()
      void loadManagersStatus()
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
      // Refresh first-market status so non-admin managers leave the waiting room
      // immediately when the turn order is set, instead of on polling (test-session #6)
      void loadFirstMarketStatus()
      void loadCurrentAuction()
      void loadReadyStatus()
    },
    onAuctionStateChanged: (data) => {
      console.log('[Pusher] Auction state changed:', data)
      // Generic phase-transition signal for transitions without a dedicated
      // event (timer-expiry close, acknowledgment progress, appeal submit/
      // resolve, appeal decision-ack progress, ready-to-resume progress).
      // Reload the ENTIRE relevant state so every client realigns at once
      // instead of waiting for polling. (test-session #15)
      void loadCurrentAuction()
      void loadPendingAcknowledgment()
      void loadAppealStatus()
      void loadFirstMarketStatus()
      void loadManagersStatus()
      void loadMyRosterSlots()
      void loadPendingAppeals()
      // If an award was rolled back (appeal accepted OR admin reverted the last
      // movement) the auction reopens into AWAITING_RESUME and the ex-winner may
      // be stuck on the "Modifica Contratto" modal for a player that is no longer
      // theirs: close it so they fall back to the ready-check. Safe because both
      // reasons are emitted ONLY when an award is annulled — never in the
      // legitimate win-without-appeal flow. (test-session #20, #29)
      if (data.reason === 'appeal-accepted' || data.reason === 'movement-reverted') {
        setPendingContractModification(null)
      }
    },
    onAuctionResumed: (data) => {
      console.log('[Pusher] Auction resumed:', data)
      // Resume completed (status back to ACTIVE): close the "Pronto a Riprendere?"
      // modal on ALL clients immediately instead of waiting for polling. The modal
      // is gated on appealStatus.auctionStatus === 'AWAITING_RESUME', so reload it
      // along with the live auction state so bidding controls become operable for
      // everyone, admin included. The modal is also gated on
      // pendingAck?.status === 'AWAITING_RESUME', so refresh that too. (test-session #14)
      void loadAppealStatus()
      void loadPendingAcknowledgment()
      void loadCurrentAuction()
      void loadManagersStatus()
      void loadMyRosterSlots()
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
      void loadPendingAcknowledgment()
      void loadAppealStatus()
      void loadFirstMarketStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
    },
    onPauseRequested: (data) => {
      console.log('[Pusher] Pause requested:', data)
      setPauseRequest({ username: data.username, type: data.type })
      // Auto-dismiss after 10 seconds
      setTimeout(() => { setPauseRequest(null); }, 10000)
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
    return () => { document.removeEventListener('click', handleClickOutside); }
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
        lastReopenableAuction?: { id: string; playerName: string; winnerName: string } | null
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
      setLastReopenableAuction(data.lastReopenableAuction ?? null)
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
  }, [pendingAck])

  // Load PENDING appeals for the admin actions panel (admin only)
  const loadPendingAppeals = useCallback(async () => {
    if (membership?.role !== 'ADMIN') return
    const result = await auctionApi.getAppeals(leagueId, 'PENDING')
    if (result.success && result.data) {
      setPendingAppeals((result.data as { appeals: Appeal[] }).appeals || [])
    }
  }, [leagueId, membership?.role])

  const loadPlayers = useCallback(async () => {
    const filters: { available: boolean; leagueId: string; position?: string; search?: string; team?: string } = { available: true, leagueId }
    // Don't filter by position server-side — NominationPanel handles role tabs locally
    if (searchQuery) filters.search = searchQuery
    if (selectedTeam) filters.team = selectedTeam
    const result = await playerApi.getAll(filters)
    if (result.success && result.data) {
      // Ordina alfabeticamente per nome
      const sortedPlayers = (result.data as Player[]).sort((a, b) => a.name.localeCompare(b.name))
      setPlayers(sortedPlayers)
    }
  }, [leagueId, searchQuery, selectedTeam])

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
        sounds.warning() // T-020: Audio warning
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
        void loadCurrentAuction().then(() => {
          // Small delay to ensure contract is created on server
          setTimeout(() => { void loadPendingAcknowledgment() }, 500)
        })
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => { clearInterval(interval); }
  }, [auction?.timerExpiresAt, loadCurrentAuction, loadPendingAcknowledgment, getRemainingSeconds])

  // Transitional/waiting phases where state advances via short-lived counters
  // (acknowledgment "X/8", ready-check, appeal review/decision-ack/resume). In
  // these phases Pusher carries the updates, but we keep a tighter polling
  // safety net (~3s) so a missed event can't leave a client behind for up to
  // 30s; outside these phases we keep the slow 30s safety net. (test-session #15)
  const isWaitingPhase = Boolean(
    pendingAck ||
    appealStatus ||
    readyStatus?.hasPendingNomination
  )

  // Adaptive polling interval: fast when disconnected (no real-time at all),
  // medium during transitional phases (counters in flight), slow otherwise.
  const pollingMs = !isConnected ? 5000 : isWaitingPhase ? 3000 : 30000

  useEffect(() => {
    void loadCurrentAuction()
    void loadFirstMarketStatus()
    void loadPendingAcknowledgment()
    void loadReadyStatus()
    void loadMyRosterSlots()
    void loadManagersStatus()
    void loadTeams()
    void loadPendingAppeals()
    // Polling as fallback - real-time updates come from Pusher.
    // Interval is adaptive (see pollingMs above).
    const interval = setInterval(() => {
      if (document.hidden) return // Skip polling when tab is hidden
      // Always poll current auction state (lightweight)
      void loadCurrentAuction()
      void loadPendingAcknowledgment()
      void loadReadyStatus()
      // Heavy endpoints (all managers + rosters) only when NOT in active bidding
      // During active bidding, Pusher handles bid updates in real-time
      if (!auctionRef.current || auctionRef.current.status !== 'ACTIVE') {
        void loadFirstMarketStatus()
        void loadMyRosterSlots()
        void loadManagersStatus()
        void loadPendingAppeals()
      }
    }, pollingMs)

    // Page Visibility API: refresh immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadCurrentAuction()
        void loadFirstMarketStatus()
        void loadPendingAcknowledgment()
        void loadReadyStatus()
        void loadMyRosterSlots()
        void loadManagersStatus()
        void loadPendingAppeals()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadCurrentAuction, loadFirstMarketStatus, loadPendingAcknowledgment, loadReadyStatus, loadMyRosterSlots, loadManagersStatus, loadTeams, loadPendingAppeals, pollingMs])

  // Carica stato ricorso quando cambia pendingAck
  useEffect(() => {
    void loadAppealStatus()
    // Polling as fallback - real-time updates come from Pusher.
    // Same adaptive cadence as the main loop (fast during waiting phases).
    const interval = setInterval(() => {
      if (document.hidden) return
      void loadAppealStatus()
    }, pollingMs)
    return () => {
      clearInterval(interval)
    }
  }, [loadAppealStatus, pollingMs])

  // Re-sync on Pusher reconnect: when the connection transitions back to
  // 'connected' after a drop (disconnected/unavailable/connecting), a client
  // may have missed events while offline. Do a full reload of the relevant
  // state so it realigns immediately instead of waiting for the next poll.
  // (test-session #15)
  const wasConnectedRef = useRef(false)
  useEffect(() => {
    const nowConnected = connectionStatus === 'connected'
    if (nowConnected && !wasConnectedRef.current) {
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadPendingAcknowledgment()
      void loadReadyStatus()
      void loadAppealStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
      void loadPendingAppeals()
    }
    wasConnectedRef.current = nowConnected
  }, [connectionStatus, loadCurrentAuction, loadFirstMarketStatus, loadPendingAcknowledgment, loadReadyStatus, loadAppealStatus, loadMyRosterSlots, loadManagersStatus, loadPendingAppeals])

  useEffect(() => {
    // Wait until sessionInfo is loaded to know the session type
    if (!sessionInfo) return
    void loadPlayers()
  }, [searchQuery, selectedTeam, loadPlayers, sessionInfo])

  // Send heartbeat every 10 seconds to track connection status
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
    void sendHeartbeat()

    // Then send every 30 seconds
    const interval = setInterval(() => { void sendHeartbeat() }, 30000)

    return () => { clearInterval(interval); }
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
      void loadFirstMarketStatus()
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
      void loadReadyStatus()
      void loadPlayers()
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
      void loadReadyStatus()
      void loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleCancelNomination() {
    setError('')
    const result = await auctionApi.cancelNomination(sessionId)
    if (result.success) {
      setSuccessMessage('Nomination annullata, scegli un altro giocatore.')
      void loadReadyStatus()
      void loadPlayers()
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
      void loadReadyStatus()
      void loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllReady() {
    const result = await auctionApi.forceAllReady(sessionId)
    if (result.success) {
      setSuccessMessage('Asta avviata!')
      void loadReadyStatus()
      void loadCurrentAuction()
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
        setSuccessMessage(`${data.winningBot ?? 'Bot'} ha offerto ${data.newCurrentPrice}!`)
      } else {
        setSuccessMessage('Nessun bot ha fatto offerte')
      }
      void loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleBotNominate() {
    setError('')
    const result = await auctionApi.botNominate(sessionId)
    if (result.success) {
      const data = result.data as { player?: { name: string } }
      setSuccessMessage(`Bot ha scelto ${data.player?.name ?? 'giocatore'}`)
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadReadyStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleBotConfirmNomination() {
    setError('')
    const result = await auctionApi.botConfirmNomination(sessionId)
    if (result.success) {
      const data = result.data as { player?: { name: string } }
      setSuccessMessage(`Scelta confermata: ${data.player?.name ?? 'giocatore'}`)
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadReadyStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAcknowledgeAll() {
    const result = await auctionApi.forceAcknowledgeAll(sessionId)
    if (result.success) {
      setSuccessMessage('Conferme forzate!')
      void loadPendingAcknowledgment()
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
      void loadAppealStatus()
      void loadPendingAcknowledgment()
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
      void loadAppealStatus()
      void loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllAppealAcks() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllAppealAcks(appealStatus.auctionId)
    if (result.success) {
      setSuccessMessage('Conferme forzate!')
      void loadAppealStatus()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleForceAllReadyResume() {
    if (!appealStatus?.auctionId) return
    const result = await auctionApi.forceAllReadyResume(appealStatus.auctionId)
    if (result.success) {
      setSuccessMessage('Pronti forzati!')
      void loadAppealStatus()
      void loadCurrentAuction()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleResetFirstMarket() {
    const ok = await confirmDialog({
      title: 'Reset Primo Mercato',
      message: 'Sei sicuro di voler resettare il Primo Mercato? Tutti i dati verranno cancellati!',
      confirmLabel: 'Resetta',
      variant: 'danger'
    })
    if (!ok) return
    const result = await adminApi.resetFirstMarket(leagueId)
    if (result.success) {
      setSuccessMessage('Primo Mercato resettato!')
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
      void loadPlayers()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handleRequestPause() {
    setError('')
    const currentPhase = auction?.status === 'ACTIVE' ? 'auction' : 'nomination'
    const res = await auctionApi.requestPause(sessionId, currentPhase)
    if (res.success) {
      setSuccessMessage('Richiesta di pausa inviata')
      setTimeout(() => { setSuccessMessage(''); }, 3000)
    } else {
      setError(res.message || 'Errore')
    }
  }

  async function handlePauseAuction() {
    setError('')
    const res = await auctionApi.pauseAuction(leagueId)
    if (res.success) {
      void loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
  }

  async function handleResumeAuction() {
    setError('')
    const res = await auctionApi.resumeAuction(leagueId)
    if (res.success) {
      void loadCurrentAuction()
    } else {
      setError(res.message || 'Errore')
    }
  }

  async function handleCompleteAllSlots() {
    if (!sessionId) return
    const ok = await confirmDialog({
      title: 'Completa asta',
      message: 'Sei sicuro di voler completare l\'asta riempiendo tutti gli slot di tutti i Direttori Generali?',
      confirmLabel: 'Completa',
      variant: 'warning'
    })
    if (!ok) return
    const result = await auctionApi.completeAllSlots(sessionId)
    if (result.success) {
      const data = result.data as { totalPlayersAdded: number; totalContractsCreated: number; memberResults: string[] }
      setSuccessMessage(`Asta completata! ${data.totalPlayersAdded} giocatori, ${data.totalContractsCreated} contratti.`)
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
      void loadPlayers()
    } else {
      setError(result.message || 'Errore')
    }
  }

  async function handlePlaceBid() {
    if (!auction) return

    // T-003: Block bid when disconnected
    if (!isConnected) {
      setError('Connessione persa — riconnessione in corso...')
      haptic.error()
      return
    }

    // T-001: Debounce — reject rapid taps within 1000ms
    const now = Date.now()
    if (now - lastBidTimeRef.current < 1000) return
    if (isBidding) return
    lastBidTimeRef.current = now

    setError('')
    const amount = parseInt(bidAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Importo non valido')
      haptic.error()
      return
    }

    // T-001: Loading state during submission
    setIsBidding(true)
    const result = await auctionApi.placeBid(auction.id, amount)
    setIsBidding(false)

    if (result.success) {
      setSuccessMessage(`Offerta di ${amount} registrata!`)
      setBidAmount(String(amount + 1))
      haptic.bid() // Haptic feedback for successful bid
      sounds.bid() // T-020: Audio feedback
      void loadCurrentAuction()
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
      setTimeout(() => { void loadCurrentAuction(); void loadPlayers(); void loadMyRosterSlots(); void loadManagersStatus() }, 2000)
    } else {
      setError(result.message || 'Errore')
    }
  }

  // Admin: reopen the last completed auction (= annulla ultimo movimento). Irreversible.
  async function handleReopenAuction() {
    const ok = await confirmDialog({
      title: 'Annulla ultimo movimento',
      message: 'Riaprire l\'ultima asta conclusa? Il giocatore verrà tolto dalla rosa, il budget restituito e l\'asta riprenderà dall\'ultima offerta. Operazione irreversibile.',
      confirmLabel: 'Annulla movimento',
      variant: 'danger',
    })
    if (!ok) return
    // Riapribile sia durante la finestra di conferma (pendingAck) sia dopo, finché
    // non parte la prossima asta (lastReopenableAuction dal server). test-session #28
    const auctionToReopen = lastReopenableAuction?.id ?? pendingAck?.id
    if (!auctionToReopen) {
      setError('Nessuna asta da riaprire')
      return
    }
    const result = await auctionApi.reopenAuction(leagueId, auctionToReopen)
    if (result.success) {
      setSuccessMessage(result.message || 'Asta riaperta')
      // L'asta è ora in AWAITING_RESUME (come ricorso accettato), non ACTIVE: NON
      // azzerare pendingAck — getPendingAcknowledgment la ritorna in stato
      // AWAITING_RESUME e fa comparire la "Pronto a Riprendere?". Ricarico
      // pendingAck (→ appealStatus via dipendenza) così il ready-check appare
      // subito anche sull'admin che ha cliccato; gli altri client lo ricevono via
      // Pusher 'movement-reverted'. (test-session #29)
      pendingAckLockedRef.current = null
      setLastReopenableAuction(null)
      void loadPendingAcknowledgment()
      void loadAppealStatus()
      void loadCurrentAuction()
      void loadFirstMarketStatus()
      void loadMyRosterSlots()
      void loadManagersStatus()
      void loadPlayers()
    } else {
      // Il backend rifiuta se una nuova asta è già in corso → mostra il messaggio
      setError(result.message || 'Errore nella riapertura')
    }
  }

  // Admin: resolve a pending appeal (ACCEPTED annulla l'aggiudicazione, REJECTED conferma)
  async function handleResolveAppeal(
    appealId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    resolutionNote?: string
  ) {
    setError('')
    setResolvingAppealId(appealId)
    const result = await auctionApi.resolveAppeal(appealId, decision, resolutionNote)
    setResolvingAppealId(null)
    if (result.success) {
      setSuccessMessage(decision === 'ACCEPTED' ? 'Ricorso accolto: aggiudicazione annullata.' : 'Ricorso respinto: transazione confermata.')
      void loadPendingAppeals()
      void loadAppealStatus()
      void loadPendingAcknowledgment()
      void loadCurrentAuction()
      void loadManagersStatus()
    } else {
      setError(result.message || 'Errore nella risoluzione del ricorso')
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
      // Invia ricorso tramite endpoint dedicato. submitAppeal porta l'asta in
      // APPEAL_REVIEW: NON va seguito da acknowledgeAuction (che richiede stato
      // COMPLETED/NO_BIDS e fallirebbe). Un solo click invia il ricorso e
      // aggiorna subito lo stato per far comparire la AppealReviewModal. (#12)
      const appealResult = await auctionApi.submitAppeal(pendingAck.id, appealContent.trim())
      setAckSubmitting(false)
      if (!appealResult.success) {
        setError(appealResult.message || 'Errore nell\'invio del ricorso')
        return
      }
      setError('')
      setSuccessMessage('Ricorso inviato! L\'admin della lega valuterà la tua richiesta.')
      setAppealContent('')
      setIsAppealMode(false)
      // Refresh immediato: nasconde la AcknowledgmentModal e mostra la review
      void loadAppealStatus()
      void loadPendingAcknowledgment()
      void loadPendingAppeals()
      return
    }

    // Conferma normale della visione dell'asta (nessun ricorso)
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

      void loadPendingAcknowledgment()
      void loadPlayers()
      void loadMyRosterSlots()
      void loadManagersStatus()
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
      void loadPlayers()
      void loadMyRosterSlots()
    } else {
      // Propaga l'errore al componente: la modale resta usabile (mostra il
      // messaggio, riabilita i bottoni) e l'utente può correggere o uscire.
      throw new Error(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    setPendingContractModification(null)
  }

  // T-020: Sound on outbid — detect when user was leading and gets outbid
  const prevLeadBidderRef = useRef<string | null>(null)
  useEffect(() => {
    const topBidder = auction?.bids?.[0]?.bidder?.user?.username || null
    const myUsername = managersStatus?.managers.find(m => m.id === managersStatus?.myId)?.username
    if (
      myUsername &&
      prevLeadBidderRef.current === myUsername &&
      topBidder !== null &&
      topBidder !== myUsername
    ) {
      sounds.outbid()
      haptic.outbid()
    }
    prevLeadBidderRef.current = topBidder
  }, [auction?.bids?.[0]?.bidder?.user?.username, managersStatus])

  // T-020: Sound on win/lose — detect when pendingAck appears with result
  const prevPendingAckIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingAck || !membership) return
    const ackId = pendingAck.id
    if (prevPendingAckIdRef.current === ackId) return
    prevPendingAckIdRef.current = ackId
    if (pendingAck.winner) {
      const myUsername = managersStatus?.managers.find(m => m.id === managersStatus?.myId)?.username
      if (pendingAck.winner.username === myUsername) {
        sounds.win()
      } else {
        sounds.lose()
      }
    }
  }, [pendingAck?.id, pendingAck?.winner, membership, managersStatus])

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
          void handlePlaceBid()
        }
        return
      }

      if (!auction) return

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          void handlePlaceBid()
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
    return () => { window.removeEventListener('keydown', handleKeyDown); }
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

  return {
    // State
    auction,
    membership,
    players,
    bidAmount, setBidAmount,
    searchQuery, setSearchQuery,
    selectedPosition, setSelectedPosition,
    selectedTeam, setSelectedTeam,
    availableTeams,
    teamDropdownOpen, setTeamDropdownOpen,
    isLoading,
    error,
    successMessage,
    sessionInfo,
    marketProgress,
    timeLeft,
    timerSetting,
    firstMarketStatus,
    turnOrderDraft,
    readyStatus,
    markingReady,
    pendingAck,
    lastReopenableAuction,
    prophecyContent, setProphecyContent,
    ackSubmitting,
    isAppealMode, setIsAppealMode,
    appealContent, setAppealContent,
    myRosterSlots,
    managersStatus,
    selectedManager, setSelectedManager,
    appealStatus,
    pendingContractModification,

    // Admin actions panel
    pendingAppeals,
    resolvingAppealId,

    // Bid submission state (T-001)
    isBidding,

    // Derived state
    isAdmin,
    isPrimoMercato,
    hasTurnOrder,
    isMyTurn,
    currentTurnManager,
    isUserWinning,
    isTimerExpired,
    currentUsername,
    connectionStatus,
    isConnected,

    // DnD
    sensors,
    handleDragEnd,

    // Utilities
    getTimerClass,
    getTimerContainerClass,
    getBudgetPercentage,
    getBudgetBarClass,

    // Handlers
    handleSetTurnOrder,
    handleNominatePlayer,
    handleConfirmNomination,
    handleCancelNomination,
    handleMarkReady,
    handleForceAllReady,
    handleBotBid,
    handleBotNominate,
    handleBotConfirmNomination,
    handleForceAcknowledgeAll,
    handleSimulateAppeal,
    handleAcknowledgeAppealDecision,
    handleReadyToResume,
    handleForceAllAppealAcks,
    handleForceAllReadyResume,
    handleResetFirstMarket,
    handleRequestPause,
    handlePauseAuction,
    handleResumeAuction,
    pauseRequest,
    dismissPauseRequest: () => { setPauseRequest(null); },
    handleCompleteAllSlots,
    handlePlaceBid,
    handleCloseAuction,
    handleReopenAuction,
    handleResolveAppeal,
    handleUpdateTimer,
    handleAcknowledge,
    handleContractModification,
    handleSkipContractModification,
  }
}
