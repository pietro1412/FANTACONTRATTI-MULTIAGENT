import { useState, useEffect, useCallback, useRef } from 'react'
import { auctionApi, playerApi, firstMarketApi, adminApi, contractApi } from '../services/api'
import { usePusherAuction } from '../services/pusher.client'
import { useServerTime } from './useServerTime'
import haptic from '../utils/haptics'
import { useAuctionLayout } from '../components/auction'
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
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

export function useAuctionRoomState(sessionId: string, leagueId: string) {
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
    prophecyContent, setProphecyContent,
    ackSubmitting,
    isAppealMode, setIsAppealMode,
    appealContent, setAppealContent,
    myRosterSlots,
    managersStatus,
    selectedManager, setSelectedManager,
    appealStatus,
    auctionLayout, setAuctionLayout,
    pendingContractModification,

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
    handlePauseAuction,
    handleResumeAuction,
    handleCompleteAllSlots,
    handlePlaceBid,
    handleCloseAuction,
    handleUpdateTimer,
    handleAcknowledge,
    handleContractModification,
    handleSkipContractModification,
  }
}
