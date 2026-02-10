import { useState, useEffect, useMemo, useCallback } from 'react'
import { tradeApi, auctionApi, leagueApi, contractApi, movementApi } from '../services/api'
import { usePusherTrades } from '../services/pusher.client'
import haptic from '../utils/haptics'
import type {
  TradeOffer,
  LeagueMember,
  RosterEntry,
  MarketSession,
  TradeMovement,
  ReceivedPlayerForModification,
} from '../types/trades.types'

export function useTradesState(leagueId: string, highlightOfferId?: string) {
  const [isLoading, setIsLoading] = useState(true)
  // If we have a highlighted offer, start on 'received' tab
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'create' | 'history'>(highlightOfferId ? 'received' : 'create')
  const [highlightedOfferId, setHighlightedOfferId] = useState<string | undefined>(highlightOfferId)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Data
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([])
  const [sentOffers, setSentOffers] = useState<TradeOffer[]>([])
  const [tradeHistory, setTradeHistory] = useState<TradeOffer[]>([])
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [myRoster, setMyRoster] = useState<RosterEntry[]>([])
  const [allOtherPlayers, setAllOtherPlayers] = useState<RosterEntry[]>([])
  const [myBudget, setMyBudget] = useState(0)
  const [myFinancials, setMyFinancials] = useState<{ annualContractCost: number; slotCount: number }>({ annualContractCost: 0, slotCount: 0 })
  const [isInTradePhase, setIsInTradePhase] = useState(false)
  const [currentSession, setCurrentSession] = useState<MarketSession | null>(null)
  const [tradeMovements, setTradeMovements] = useState<TradeMovement[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'offers' | 'movements'>('all')

  // Create offer form
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>([])
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>([])
  const [offeredBudget, setOfferedBudget] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [message, setMessage] = useState('')
  const [offerDuration, setOfferDuration] = useState(24) // Default 24 hours
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search filters for create offer
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterManager, setFilterManager] = useState('')

  // Contract modification after trade acceptance
  const [pendingContractModifications, setPendingContractModifications] = useState<ReceivedPlayerForModification[]>([])
  const [currentModificationIndex, setCurrentModificationIndex] = useState(0)
  const [isModifyingContract, setIsModifyingContract] = useState(false)

  useEffect(() => {
    loadData()
  }, [leagueId])

  // Scroll to highlighted offer and clear highlight after a few seconds
  useEffect(() => {
    if (highlightedOfferId && !isLoading) {
      const element = document.getElementById(`offer-${highlightedOfferId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedOfferId(undefined)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [highlightedOfferId, isLoading])

  // Pusher real-time: auto-refresh when trade events arrive
  const { isConnected: pusherConnected } = usePusherTrades(leagueId, {
    onTradeOfferReceived: useCallback(() => {
      loadData()
    }, [leagueId]),
    onTradeUpdated: useCallback(() => {
      loadData()
    }, [leagueId]),
  })

  async function loadData() {
    setIsLoading(true)

    // Load all data in parallel
    const [receivedRes, sentRes, historyRes, membersRes, rosterRes, sessionsRes, leagueRes, allRostersRes, financialsRes, movementsRes] = await Promise.all([
      tradeApi.getReceived(leagueId),
      tradeApi.getSent(leagueId),
      tradeApi.getHistory(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getRoster(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getById(leagueId),
      auctionApi.getLeagueRosters(leagueId),
      leagueApi.getFinancials(leagueId),
      movementApi.getLeagueMovements(leagueId, { movementType: 'TRADE', limit: 50 }),
    ])

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }

    if (receivedRes.success && receivedRes.data) {
      setReceivedOffers(receivedRes.data as TradeOffer[])
    }
    if (sentRes.success && sentRes.data) {
      setSentOffers(sentRes.data as TradeOffer[])
    }
    if (historyRes.success && historyRes.data) {
      setTradeHistory(historyRes.data as TradeOffer[])
    }

    // Get my member ID first
    const rosterData = rosterRes.data as { member?: { id: string, currentBudget: number } } | undefined
    const currentMemberId = rosterData?.member?.id || ''

    // Build financials lookup from getFinancials API
    const financialsMap = new Map<string, { budget: number; annualContractCost: number; slotCount: number }>()
    if (financialsRes.success && financialsRes.data) {
      const fData = financialsRes.data as { teams: Array<{ memberId: string; budget: number; annualContractCost: number; slotCount: number }> }
      for (const t of fData.teams || []) {
        financialsMap.set(t.memberId, { budget: t.budget, annualContractCost: t.annualContractCost, slotCount: t.slotCount })
      }
    }

    if (membersRes.success && membersRes.data) {
      const allMembers = (membersRes.data as { members: LeagueMember[] }).members || []
      // Merge financial data into members
      const enriched = allMembers.map(m => {
        const fin = financialsMap.get(m.id)
        return fin
          ? { ...m, currentBudget: fin.budget, annualContractCost: fin.annualContractCost, slotCount: fin.slotCount }
          : m
      })
      setMembers(enriched.filter(m => m.id !== currentMemberId))
    }

    // Also fix myBudget from financials if available
    if (currentMemberId && financialsMap.has(currentMemberId)) {
      const myFin = financialsMap.get(currentMemberId)!
      setMyBudget(myFin.budget)
      setMyFinancials({ annualContractCost: myFin.annualContractCost, slotCount: myFin.slotCount })
    }

    if (rosterRes.success && rosterRes.data) {
      interface RosterApiEntry {
        id: string
        player: { id: string; name: string; team: string; position: string; quotation?: number; age?: number | null; apiFootballId?: number | null }
        contract?: { salary: number; duration: number; rescissionClause?: number } | null
        acquisitionPrice: number
      }
      const data = rosterRes.data as {
        member: { currentBudget: number }
        roster: { P: RosterApiEntry[], D: RosterApiEntry[], C: RosterApiEntry[], A: RosterApiEntry[] }
      }
      // Only set budget from roster if financials didn't provide it
      if (!financialsMap.has(currentMemberId)) {
        setMyBudget(data.member.currentBudget)
      }
      // Map roster entries to include contract inside player
      const mapEntry = (r: RosterApiEntry): RosterEntry => ({
        id: r.id,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          contract: r.contract,
          quotation: r.player.quotation,
          age: r.player.age,
          apiFootballId: r.player.apiFootballId,
        },
        acquisitionPrice: r.acquisitionPrice,
      })
      const allPlayers = [
        ...data.roster.P.map(mapEntry),
        ...data.roster.D.map(mapEntry),
        ...data.roster.C.map(mapEntry),
        ...data.roster.A.map(mapEntry),
      ]
      setMyRoster(allPlayers)
    }

    // Load all other players from all rosters
    // Handle both formats: { data: [...] } (auctions.ts) and { data: { members: [...] } } (leagues.ts)
    if (allRostersRes.success && allRostersRes.data) {
      let rostersData: Array<{
        id?: string
        memberId?: string
        username?: string
        user?: { username: string }
        roster?: Array<{
          id: string
          player: { id: string; name: string; position: string; team: string; quotation?: number; age?: number | null; apiFootballId?: number | null }
          contract?: { salary: number; duration: number; rescissionClause?: number } | null
        }>
        players?: Array<{
          id: string
          rosterId: string
          name: string
          position: string
          team: string
          quotation?: number
          age?: number | null
          apiFootballId?: number | null
          contract?: { salary: number; duration: number; rescissionClause?: number } | null
        }>
      }> = []

      // Check which format we received
      if (Array.isArray(allRostersRes.data)) {
        // Format from auctions.ts: data is array directly
        rostersData = allRostersRes.data
      } else if ((allRostersRes.data as { members?: unknown }).members) {
        // Format from leagues.ts: data.members is the array
        rostersData = (allRostersRes.data as { members: typeof rostersData }).members
      }

      const otherPlayers: RosterEntry[] = []
      for (const memberRoster of rostersData) {
        const memberId = memberRoster.memberId || memberRoster.id || ''
        const username = memberRoster.username || memberRoster.user?.username || ''

        if (memberId === currentMemberId) continue

        // Handle both player formats
        const players = memberRoster.players || memberRoster.roster?.map(r => ({
          id: r.player.id,
          rosterId: r.id,
          name: r.player.name,
          position: r.player.position,
          team: r.player.team,
          quotation: r.player.quotation,
          age: r.player.age,
          apiFootballId: r.player.apiFootballId,
          contract: r.contract,
        })) || []

        for (const p of players) {
          otherPlayers.push({
            id: p.rosterId || p.id,
            player: {
              id: p.id,
              name: p.name,
              position: p.position,
              team: p.team,
              contract: p.contract,
              quotation: p.quotation,
              age: p.age,
              apiFootballId: p.apiFootballId,
            },
            acquisitionPrice: 0,
            memberId: memberId,
            memberUsername: username,
          })
        }
      }
      setAllOtherPlayers(otherPlayers)
    }

    if (sessionsRes.success && sessionsRes.data) {
      const sessions = sessionsRes.data as MarketSession[]
      const active = sessions.find(s => s.status === 'ACTIVE')
      setCurrentSession(active || null)
      setIsInTradePhase(
        !!active &&
        (active.currentPhase === 'OFFERTE_PRE_RINNOVO' || active.currentPhase === 'OFFERTE_POST_ASTA_SVINCOLATI')
      )
    }

    if (movementsRes.success && movementsRes.data) {
      setTradeMovements((movementsRes.data as { movements: TradeMovement[] }).movements || [])
    }

    setIsLoading(false)
  }

  // Helper to select a requested player and auto-set the target member
  function handleSelectRequestedPlayer(entry: RosterEntry) {
    if (!entry.memberId) return

    // If no member selected yet, or same member, just toggle the player
    if (!selectedMemberId || selectedMemberId === entry.memberId) {
      setSelectedMemberId(entry.memberId)
      if (selectedRequestedPlayers.includes(entry.id)) {
        setSelectedRequestedPlayers(selectedRequestedPlayers.filter(id => id !== entry.id))
      } else {
        setSelectedRequestedPlayers([...selectedRequestedPlayers, entry.id])
      }
    } else {
      // Different member - ask to switch or ignore
      // For simplicity, we'll switch to new member and reset requested players
      setSelectedMemberId(entry.memberId)
      setSelectedRequestedPlayers([entry.id])
    }
  }

  // Filter other players based on search criteria
  const filteredOtherPlayers = allOtherPlayers.filter(entry => {
    // Filter by selected member if already selected
    if (selectedMemberId && entry.memberId !== selectedMemberId) return false

    // Filter by DG dropdown
    if (filterManager && entry.memberId !== filterManager) return false

    // Filter by role
    if (filterRole && entry.player.position !== filterRole) return false

    // Filter by search query (name or team)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!entry.player.name.toLowerCase().includes(query) &&
          !entry.player.team.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })

  // Get target member info
  const targetMember = members.find(m => m.id === selectedMemberId)

  // Financial calculations - use API data from getFinancials for consistency with Finanze page
  const myTotalSalary = myFinancials.annualContractCost
  const targetTotalSalary = targetMember?.annualContractCost ?? 0
  const targetRosterCount = targetMember?.slotCount ?? 0

  // Simulated post-trade impact
  const offeredSalaryTotal = useMemo(() =>
    selectedOfferedPlayers.reduce((sum, id) => {
      const r = myRoster.find(e => e.id === id)
      return sum + (r?.player.contract?.salary || 0)
    }, 0),
    [selectedOfferedPlayers, myRoster]
  )
  const requestedSalaryTotal = useMemo(() =>
    selectedRequestedPlayers.reduce((sum, id) => {
      const r = allOtherPlayers.find(e => e.id === id)
      return sum + (r?.player.contract?.salary || 0)
    }, 0),
    [selectedRequestedPlayers, allOtherPlayers]
  )
  const myPostTradeBudget = myBudget - offeredBudget + requestedBudget
  const myPostTradeSalary = myTotalSalary - offeredSalaryTotal + requestedSalaryTotal

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    const res = await tradeApi.create(leagueId, {
      toMemberId: selectedMemberId,
      offeredPlayerIds: selectedOfferedPlayers,
      requestedPlayerIds: selectedRequestedPlayers,
      offeredBudget,
      requestedBudget,
      message: message || undefined,
      durationHours: offerDuration,
    })

    if (res.success) {
      haptic.send()
      setSuccess('Offerta inviata!')
      // Reset form
      setSelectedMemberId('')
      setSelectedOfferedPlayers([])
      setSelectedRequestedPlayers([])
      setOfferedBudget(0)
      setRequestedBudget(0)
      setMessage('')
      setOfferDuration(24)
      setSearchQuery('')
      setFilterRole('')
      setFilterManager('')
      // Reload sent offers
      const sentRes = await tradeApi.getSent(leagueId)
      if (sentRes.success && sentRes.data) {
        setSentOffers(sentRes.data as TradeOffer[])
      }
      setActiveTab('sent')
    } else {
      setError(res.message || 'Errore durante l\'invio dell\'offerta')
    }

    setIsSubmitting(false)
  }

  async function handleAccept(tradeId: string) {
    const res = await tradeApi.accept(tradeId)
    if (res.success) {
      // #135: I contratti dei giocatori ricevuti NON vengono modificati
      // Il contratto rimane quello originale - la modifica avverrà nella fase CONTRATTI
      setSuccess('Scambio accettato! I contratti dei giocatori ricevuti saranno modificabili nella fase di rinnovo contratti.')
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  // Get current player for contract modification
  const currentPlayerForModification = pendingContractModifications[currentModificationIndex]

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!currentPlayerForModification?.contractId) return

    const res = await contractApi.modify(currentPlayerForModification.contractId, newSalary, newDuration)

    if (res.success) {
      // Move to next player or finish
      if (currentModificationIndex < pendingContractModifications.length - 1) {
        setCurrentModificationIndex(currentModificationIndex + 1)
      } else {
        // All done
        setIsModifyingContract(false)
        setPendingContractModifications([])
        setCurrentModificationIndex(0)
        loadData()
      }
    } else {
      alert(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    // Move to next player or finish
    if (currentModificationIndex < pendingContractModifications.length - 1) {
      setCurrentModificationIndex(currentModificationIndex + 1)
    } else {
      // All done
      setIsModifyingContract(false)
      setPendingContractModifications([])
      setCurrentModificationIndex(0)
      loadData()
    }
  }

  async function handleReject(tradeId: string) {
    const res = await tradeApi.reject(tradeId)
    if (res.success) {
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  async function handleCancel(tradeId: string) {
    const res = await tradeApi.cancel(tradeId)
    if (res.success) {
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  function togglePlayer(list: string[], setList: (l: string[]) => void, playerId: string) {
    if (list.includes(playerId)) {
      setList(list.filter(id => id !== playerId))
    } else {
      setList([...list, playerId])
    }
  }

  return {
    // Loading / auth
    isLoading,
    isLeagueAdmin,

    // Tab state
    activeTab,
    setActiveTab,
    highlightedOfferId,

    // Data
    receivedOffers,
    sentOffers,
    tradeHistory,
    members,
    myRoster,
    allOtherPlayers,
    myBudget,
    myFinancials,
    isInTradePhase,
    currentSession,
    tradeMovements,
    historyFilter,
    setHistoryFilter,

    // Create offer form
    selectedMemberId,
    setSelectedMemberId,
    selectedOfferedPlayers,
    setSelectedOfferedPlayers,
    selectedRequestedPlayers,
    setSelectedRequestedPlayers,
    offeredBudget,
    setOfferedBudget,
    requestedBudget,
    setRequestedBudget,
    message,
    setMessage,
    offerDuration,
    setOfferDuration,
    isSubmitting,
    error,
    success,

    // Search filters
    searchQuery,
    setSearchQuery,
    filterRole,
    setFilterRole,
    filterManager,
    setFilterManager,

    // Contract modification
    pendingContractModifications,
    currentModificationIndex,
    isModifyingContract,
    currentPlayerForModification,

    // Derived state
    filteredOtherPlayers,
    targetMember,
    myTotalSalary,
    targetTotalSalary,
    targetRosterCount,
    offeredSalaryTotal,
    requestedSalaryTotal,
    myPostTradeBudget,
    myPostTradeSalary,

    // Pusher
    pusherConnected,

    // Handlers
    handleSelectRequestedPlayer,
    handleCreateOffer,
    handleAccept,
    handleContractModification,
    handleSkipContractModification,
    handleReject,
    handleCancel,
    togglePlayer,
  }
}
