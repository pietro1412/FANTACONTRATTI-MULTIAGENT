import { useState, useEffect, useMemo, useCallback } from 'react'
import { tradeApi, auctionApi, leagueApi, contractApi } from '../services/api'
import { usePusherTrades } from '../services/pusher.client'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'
import { ContractModifierModal } from '../components/ContractModifier'
import { EmptyState } from '../components/ui/EmptyState'
import { BottomSheet } from '../components/ui/BottomSheet'
import { DealFinanceBar, DealRosterPanel, DealTable, DealMobileFooter } from '../components/trades/deal-room'
import haptic from '../utils/haptics'
import type { FinancialsData, TeamData } from '../components/finance/types'
import {
  type TradeOffer, type LeagueMember, type RosterEntry, type MarketSession,
  getTimeRemaining,
  PlayersTable,
} from '../components/trades'

interface TradesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  highlightOfferId?: string
}

export function Trades({ leagueId, onNavigate, highlightOfferId }: TradesProps) {
  const [isLoading, setIsLoading] = useState(true)
  // Simple 3-tab layout: create (default), received, sent
  const [activeTab, setActiveTab] = useState<'create' | 'received' | 'sent'>(
    highlightOfferId ? 'received' : 'create'
  )
  const [highlightedOfferId, setHighlightedOfferId] = useState<string | undefined>(highlightOfferId)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)

  // Data
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([])
  const [sentOffers, setSentOffers] = useState<TradeOffer[]>([])
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [myRoster, setMyRoster] = useState<RosterEntry[]>([])
  const [allOtherPlayers, setAllOtherPlayers] = useState<RosterEntry[]>([])
  const [myBudget, setMyBudget] = useState(0)
  const [myFinancials, setMyFinancials] = useState<{ annualContractCost: number; slotCount: number }>({ annualContractCost: 0, slotCount: 0 })
  const [isInTradePhase, setIsInTradePhase] = useState(false)
  const [currentSession, setCurrentSession] = useState<MarketSession | null>(null)

  // Financial data for DealFinanceBar
  const [financialsData, setFinancialsData] = useState<FinancialsData | null>(null)
  const [myTeamData, setMyTeamData] = useState<TeamData | null>(null)

  // Create offer form
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>([])
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>([])
  const [offeredBudget, setOfferedBudget] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [message, setMessage] = useState('')
  const [offerDuration, setOfferDuration] = useState(24)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search filters for create offer
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterManager, setFilterManager] = useState('')

  // Mobile BottomSheet state for Deal Room
  const [showMyRosterModal, setShowMyRosterModal] = useState(false)
  const [showPartnerRosterModal, setShowPartnerRosterModal] = useState(false)

  // Contract modification after trade acceptance
  interface ReceivedPlayerForModification {
    rosterId: string
    contractId?: string
    playerId: string
    playerName: string
    playerTeam: string
    playerPosition: string
    contract: {
      salary: number
      duration: number
      initialSalary: number
      rescissionClause: number
    } | null
  }
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

    const [receivedRes, sentRes, membersRes, rosterRes, sessionsRes, leagueRes, allRostersRes, financialsRes] = await Promise.all([
      tradeApi.getReceived(leagueId),
      tradeApi.getSent(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getRoster(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getById(leagueId),
      auctionApi.getLeagueRosters(leagueId),
      leagueApi.getFinancials(leagueId),
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

    const rosterData = rosterRes.data as { member?: { id: string, currentBudget: number } } | undefined
    const currentMemberId = rosterData?.member?.id || ''

    const financialsMap = new Map<string, { budget: number; annualContractCost: number; slotCount: number }>()
    if (financialsRes.success && financialsRes.data) {
      const fData = financialsRes.data as FinancialsData
      setFinancialsData(fData)
      for (const t of fData.teams || []) {
        financialsMap.set(t.memberId, { budget: t.budget, annualContractCost: t.annualContractCost, slotCount: t.slotCount })
      }
      const myTeam = fData.teams.find(t => t.memberId === currentMemberId)
      if (myTeam) setMyTeamData(myTeam)
    }

    if (membersRes.success && membersRes.data) {
      const allMembers = (membersRes.data as { members: LeagueMember[] }).members || []
      const enriched = allMembers.map(m => {
        const fin = financialsMap.get(m.id)
        return fin
          ? { ...m, currentBudget: fin.budget, annualContractCost: fin.annualContractCost, slotCount: fin.slotCount }
          : m
      })
      setMembers(enriched.filter(m => m.id !== currentMemberId))
    }

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
      if (!financialsMap.has(currentMemberId)) {
        setMyBudget(data.member.currentBudget)
      }
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

      if (Array.isArray(allRostersRes.data)) {
        rostersData = allRostersRes.data
      } else if ((allRostersRes.data as { members?: unknown }).members) {
        rostersData = (allRostersRes.data as { members: typeof rostersData }).members
      }

      const otherPlayers: RosterEntry[] = []
      for (const memberRoster of rostersData) {
        const memberId = memberRoster.memberId || memberRoster.id || ''
        const username = memberRoster.username || memberRoster.user?.username || ''

        if (memberId === currentMemberId) continue

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

    setIsLoading(false)
  }

  // Helper to select a requested player and auto-set the target member
  function handleSelectRequestedPlayer(entry: RosterEntry) {
    if (!entry.memberId) return

    if (!selectedMemberId || selectedMemberId === entry.memberId) {
      setSelectedMemberId(entry.memberId)
      if (selectedRequestedPlayers.includes(entry.id)) {
        setSelectedRequestedPlayers(selectedRequestedPlayers.filter(id => id !== entry.id))
      } else {
        setSelectedRequestedPlayers([...selectedRequestedPlayers, entry.id])
      }
    } else {
      setSelectedMemberId(entry.memberId)
      setSelectedRequestedPlayers([entry.id])
    }
  }

  // Filter other players based on search criteria
  const filteredOtherPlayers = allOtherPlayers.filter(entry => {
    if (selectedMemberId && entry.memberId !== selectedMemberId) return false
    if (filterManager && entry.memberId !== filterManager) return false
    if (filterRole && entry.player.position !== filterRole) return false
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

  // Financial calculations
  const myTotalSalary = myFinancials.annualContractCost

  // Has financial details flag
  const hasFinancialDetails = useMemo(() => {
    if (!financialsData) return false
    return financialsData.teams.some(t => t.totalReleaseCosts !== null || t.totalIndemnities !== null) && !financialsData.inContrattiPhase
  }, [financialsData])

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

  const hasTradeSelections = selectedOfferedPlayers.length > 0 || selectedRequestedPlayers.length > 0 || offeredBudget > 0 || requestedBudget > 0

  // Reset form helper
  function resetCreateForm() {
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
    setError('')
    setSuccess('')
  }

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
      resetCreateForm()
      loadData()
      setActiveTab('sent')
    } else {
      setError(res.message || 'Errore durante l\'invio dell\'offerta')
    }

    setIsSubmitting(false)
  }

  async function handleAccept(tradeId: string) {
    const res = await tradeApi.accept(tradeId)
    if (res.success) {
      setSuccess('Scambio accettato! I contratti dei giocatori ricevuti saranno modificabili nella fase di rinnovo contratti.')
      loadData()
    } else {
      alert(res.message || 'Errore')
    }
  }

  const currentPlayerForModification = pendingContractModifications[currentModificationIndex]

  async function handleContractModification(newSalary: number, newDuration: number) {
    if (!currentPlayerForModification?.contractId) return

    const res = await contractApi.modify(currentPlayerForModification.contractId, newSalary, newDuration)

    if (res.success) {
      if (currentModificationIndex < pendingContractModifications.length - 1) {
        setCurrentModificationIndex(currentModificationIndex + 1)
      } else {
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
    if (currentModificationIndex < pendingContractModifications.length - 1) {
      setCurrentModificationIndex(currentModificationIndex + 1)
    } else {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento trattative...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="trades" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      {/* === Page Header (aligned with Svincolati) === */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-2xl">🤝</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Trattative</h1>
                  <span className={`w-2 h-2 rounded-full ${pusherConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} title={pusherConnected ? 'Real-time attivo' : 'Real-time disconnesso'} />
                </div>
                <p className="text-gray-400 text-sm">
                  {isInTradePhase ? 'Scambi attivi' : 'Scambi non disponibili'}
                </p>
              </div>
            </div>
            {myTeamData && (
              <div className="text-right bg-surface-200 rounded-xl px-5 py-3 border border-surface-50/20">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Budget</p>
                <p className="text-3xl font-bold text-accent-400">{myTeamData.budget}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:py-6">
        {/* === DealFinanceBar - always visible === */}
        <DealFinanceBar
          isInTradePhase={isInTradePhase}
          currentPhase={currentSession?.currentPhase || null}
          pusherConnected={pusherConnected}
          myTeam={myTeamData}
          hasFinancialDetails={hasFinancialDetails}
          postTradeImpact={
            activeTab === 'create' && hasTradeSelections
              ? { budgetDelta: -offeredBudget + requestedBudget, newBudget: myPostTradeBudget, newSalary: myPostTradeSalary, rosterDelta: selectedRequestedPlayers.length - selectedOfferedPlayers.length }
              : null
          }
        />

        {/* === Tab Bar === */}
        <div className="flex items-center gap-1 mt-3 mb-4 border-b border-surface-50/20">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'create'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nuova Offerta</span>
            <span className="sm:hidden">Nuova</span>
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'received'
                ? 'border-accent-500 text-accent-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Ricevute
            {receivedOffers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'received' ? 'bg-accent-500/20 text-accent-400' : 'bg-surface-300 text-gray-400'
              }`}>
                {receivedOffers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'sent'
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Inviate
            {sentOffers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'sent' ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-300 text-gray-400'
              }`}>
                {sentOffers.length}
              </span>
            )}
          </button>
        </div>

        {/* Success/Error messages */}
        <div className="space-y-2 mb-4">
          {error && activeTab !== 'create' && (
            <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg text-sm">{success}</div>
          )}
        </div>

        {/* ============================= */}
        {/* === TAB: Nuova Offerta === */}
        {/* ============================= */}
        {activeTab === 'create' && (
          <div className={`space-y-4 ${hasTradeSelections ? 'pb-40 lg:pb-4' : ''}`}>
            {!isInTradePhase ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-accent-400">
                    Puoi creare offerte solo durante la fase SCAMBI/OFFERTE
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {error && (
                  <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Mobile trigger buttons */}
                <div className="flex gap-2 lg:hidden">
                  <button
                    onClick={() => setShowMyRosterModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl text-sm font-medium text-white active:scale-[0.98] transition-all"
                  >
                    <svg className="w-4 h-4 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    La Mia Rosa
                    {selectedOfferedPlayers.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-500/20 text-danger-400">
                        {selectedOfferedPlayers.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowPartnerRosterModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl text-sm font-medium text-white active:scale-[0.98] transition-all"
                  >
                    <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    Rosa Partner
                    {selectedRequestedPlayers.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/20 text-primary-400">
                        {selectedRequestedPlayers.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* 3-column grid layout */}
                <div className="lg:grid lg:grid-cols-12 lg:gap-4">
                  {/* Left: My Roster (desktop only) */}
                  <div className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-4">
                      <DealRosterPanel
                        side="mine"
                        myRoster={myRoster}
                        selectedOfferedPlayers={selectedOfferedPlayers}
                        onToggleOffered={(id) => togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id)}
                        myBudget={myBudget}
                      />
                    </div>
                  </div>

                  {/* Center: Deal Table */}
                  <div className="lg:col-span-6">
                    <DealTable
                      members={members}
                      selectedMemberId={selectedMemberId}
                      targetMember={targetMember}
                      onMemberChange={(id) => {
                        if (id !== selectedMemberId) {
                          setSelectedMemberId(id)
                          setSelectedRequestedPlayers([])
                          setFilterManager(id)
                        }
                      }}
                      myBudget={myBudget}
                      selectedOfferedPlayers={selectedOfferedPlayers}
                      myRoster={myRoster}
                      onRemoveOffered={(id) => togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id)}
                      offeredBudget={offeredBudget}
                      onOfferedBudgetChange={setOfferedBudget}
                      selectedRequestedPlayers={selectedRequestedPlayers}
                      allOtherPlayers={allOtherPlayers}
                      onRemoveRequested={(id) => togglePlayer(selectedRequestedPlayers, setSelectedRequestedPlayers, id)}
                      requestedBudget={requestedBudget}
                      onRequestedBudgetChange={setRequestedBudget}
                      offerDuration={offerDuration}
                      onDurationChange={setOfferDuration}
                      message={message}
                      onMessageChange={setMessage}
                      isSubmitting={isSubmitting}
                      canSubmit={!!(selectedMemberId && (selectedOfferedPlayers.length > 0 || offeredBudget > 0 || selectedRequestedPlayers.length > 0 || requestedBudget > 0))}
                      onSubmit={handleCreateOffer}
                      onOpenMyRoster={() => setShowMyRosterModal(true)}
                      onOpenPartnerRoster={() => setShowPartnerRosterModal(true)}
                    />
                  </div>

                  {/* Right: Partner Roster (desktop only) */}
                  <div className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-4">
                      <DealRosterPanel
                        side="partner"
                        filteredPlayers={filteredOtherPlayers}
                        selectedRequestedPlayers={selectedRequestedPlayers}
                        onToggleRequested={handleSelectRequestedPlayer}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        filterRole={filterRole}
                        onFilterRoleChange={setFilterRole}
                        members={members}
                        selectedMemberId={selectedMemberId || filterManager}
                        onMemberChange={(id) => {
                          setFilterManager(id)
                          if (id !== selectedMemberId) {
                            setSelectedMemberId(id)
                            setSelectedRequestedPlayers([])
                          }
                        }}
                        targetMember={targetMember}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile BottomSheet: La Mia Rosa */}
                <BottomSheet
                  isOpen={showMyRosterModal}
                  onClose={() => setShowMyRosterModal(false)}
                  title="La Mia Rosa"
                  maxHeight="85vh"
                >
                  <DealRosterPanel
                    side="mine"
                    myRoster={myRoster}
                    selectedOfferedPlayers={selectedOfferedPlayers}
                    onToggleOffered={(id) => togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id)}
                    myBudget={myBudget}
                  />
                </BottomSheet>

                {/* Mobile BottomSheet: Rosa Partner */}
                <BottomSheet
                  isOpen={showPartnerRosterModal}
                  onClose={() => setShowPartnerRosterModal(false)}
                  title={targetMember ? `Rosa ${targetMember.user.username}` : 'Rosa Partner'}
                  maxHeight="85vh"
                >
                  <DealRosterPanel
                    side="partner"
                    filteredPlayers={filteredOtherPlayers}
                    selectedRequestedPlayers={selectedRequestedPlayers}
                    onToggleRequested={handleSelectRequestedPlayer}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterRole={filterRole}
                    onFilterRoleChange={setFilterRole}
                    members={members}
                    selectedMemberId={selectedMemberId || filterManager}
                    onMemberChange={(id) => {
                      setFilterManager(id)
                      if (id !== selectedMemberId) {
                        setSelectedMemberId(id)
                        setSelectedRequestedPlayers([])
                      }
                    }}
                    targetMember={targetMember}
                  />
                </BottomSheet>

                {/* Mobile sticky footer */}
                <DealMobileFooter
                  offeredCount={selectedOfferedPlayers.length}
                  requestedCount={selectedRequestedPlayers.length}
                  isSubmitting={isSubmitting}
                  onSubmit={() => handleCreateOffer({ preventDefault: () => {} } as React.FormEvent)}
                  canSubmit={!!(selectedMemberId && (selectedOfferedPlayers.length > 0 || offeredBudget > 0 || selectedRequestedPlayers.length > 0 || requestedBudget > 0))}
                  hasSelections={hasTradeSelections}
                />
              </>
            )}
          </div>
        )}

        {/* ============================= */}
        {/* === TAB: Ricevute === */}
        {/* ============================= */}
        {activeTab === 'received' && (
          <div className="space-y-4">
            {receivedOffers.length === 0 ? (
              <EmptyState icon="📥" title="Nessuna offerta ricevuta" description="Le offerte che riceverai appariranno qui" />
            ) : (
              receivedOffers.map(offer => {
                const timeRemaining = getTimeRemaining(offer.expiresAt)
                const isHighlighted = offer.id === highlightedOfferId
                return (
                  <Card
                    key={offer.id}
                    id={`offer-${offer.id}`}
                    className={`overflow-hidden border-l-4 ${isHighlighted ? 'border-l-primary-500 ring-2 ring-primary-500/50 bg-primary-500/5' : 'border-l-accent-500'}`}
                  >
                    <div className="bg-gradient-to-r from-surface-200 to-transparent px-5 py-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center">
                          <span className="text-accent-400 font-bold text-sm">
                            {(offer.sender?.username?.[0] || offer.fromMember?.user?.username?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">{offer.sender?.username || offer.fromMember?.user?.username}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(offer.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                          timeRemaining.isExpired
                            ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40'
                            : timeRemaining.isUrgent
                              ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                              : 'bg-surface-300 text-gray-400 border border-surface-50/30'
                        }`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{timeRemaining.text}</span>
                        </div>
                        <span className="px-3 py-1.5 bg-accent-500/20 text-accent-400 text-xs font-semibold rounded-full border border-accent-500/40 uppercase tracking-wide">
                          In attesa
                        </span>
                      </div>
                    </div>

                    <CardContent className="py-5">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* What you receive */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary-500/20 flex items-center justify-center">
                              <svg className="w-3 h-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-secondary-400 uppercase tracking-wide">Riceveresti</p>
                          </div>
                          <div className="pl-8">
                            <PlayersTable players={offer.offeredPlayerDetails || offer.offeredPlayers || []} />
                            {offer.offeredBudget > 0 && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                                <div className="w-6 h-6 rounded bg-secondary-500/20 flex items-center justify-center">
                                  <span className="text-secondary-400 font-bold text-xs">€</span>
                                </div>
                                <span className="text-sm text-secondary-400 font-medium">+ {offer.offeredBudget} crediti</span>
                              </div>
                            )}
                            {(!offer.offeredPlayerDetails?.length && !offer.offeredPlayers?.length && offer.offeredBudget === 0) && (
                              <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito offerto</p>
                            )}
                          </div>
                        </div>

                        {/* What you give */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center">
                              <svg className="w-3 h-3 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-danger-400 uppercase tracking-wide">Cederesti</p>
                          </div>
                          <div className="pl-8">
                            <PlayersTable players={offer.requestedPlayerDetails || offer.requestedPlayers || []} />
                            {offer.requestedBudget > 0 && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                                <div className="w-6 h-6 rounded bg-danger-500/20 flex items-center justify-center">
                                  <span className="text-danger-400 font-bold text-xs">€</span>
                                </div>
                                <span className="text-sm text-danger-400 font-medium">+ {offer.requestedBudget} crediti</span>
                              </div>
                            )}
                            {(!offer.requestedPlayerDetails?.length && !offer.requestedPlayers?.length && offer.requestedBudget === 0) && (
                              <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito richiesto</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {offer.message && (
                        <div className="mt-5 p-4 bg-surface-200/50 rounded-lg border-l-2 border-gray-500">
                          <p className="text-sm text-gray-400 italic">"{offer.message}"</p>
                        </div>
                      )}

                      {isInTradePhase && !timeRemaining.isExpired && (
                        <div className="flex gap-3 mt-6 pt-5 border-t border-surface-50/20">
                          <Button variant="primary" onClick={() => handleAccept(offer.id)} className="flex-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Accetta Scambio
                          </Button>
                          <Button variant="outline" onClick={() => handleReject(offer.id)} className="flex-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Rifiuta
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ============================= */}
        {/* === TAB: Inviate === */}
        {/* ============================= */}
        {activeTab === 'sent' && (
          <div className="space-y-4">
            {sentOffers.length === 0 ? (
              <EmptyState icon="📤" title="Nessuna offerta inviata" description="Le tue offerte appariranno qui" />
            ) : (
              sentOffers.map(offer => {
                const timeRemaining = getTimeRemaining(offer.expiresAt)
                const isHighlighted = offer.id === highlightedOfferId
                return (
                  <Card
                    key={offer.id}
                    id={`offer-${offer.id}`}
                    className={`overflow-hidden border-l-4 ${isHighlighted ? 'border-l-primary-500 ring-2 ring-primary-500/50 bg-primary-500/5' : 'border-l-primary-500'}`}
                  >
                    <div className="bg-gradient-to-r from-surface-200 to-transparent px-5 py-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                          <span className="text-primary-400 font-bold text-sm">
                            {(offer.receiver?.username?.[0] || offer.toMember?.user?.username?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">A: {offer.receiver?.username || offer.toMember?.user?.username}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(offer.createdAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                          timeRemaining.isExpired
                            ? 'bg-danger-500/20 text-danger-400 border border-danger-500/40'
                            : timeRemaining.isUrgent
                              ? 'bg-warning-500/20 text-warning-400 border border-warning-500/40'
                              : 'bg-surface-300 text-gray-400 border border-surface-50/30'
                        }`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{timeRemaining.text}</span>
                        </div>
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full uppercase tracking-wide border ${
                          offer.status === 'PENDING'
                            ? 'bg-accent-500/20 text-accent-400 border-accent-500/40'
                            : 'bg-primary-500/20 text-primary-400 border-primary-500/40'
                        }`}>
                          {offer.status === 'PENDING' ? 'In attesa' : 'Controfferta'}
                        </span>
                      </div>
                    </div>

                    <CardContent className="py-5">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* What you offer */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center">
                              <svg className="w-3 h-3 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-danger-400 uppercase tracking-wide">Offri</p>
                          </div>
                          <div className="pl-8">
                            <PlayersTable players={offer.offeredPlayerDetails || offer.offeredPlayers || []} />
                            {offer.offeredBudget > 0 && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                                <div className="w-6 h-6 rounded bg-danger-500/20 flex items-center justify-center">
                                  <span className="text-danger-400 font-bold text-xs">€</span>
                                </div>
                                <span className="text-sm text-danger-400 font-medium">+ {offer.offeredBudget} crediti</span>
                              </div>
                            )}
                            {(!offer.offeredPlayerDetails?.length && !offer.offeredPlayers?.length && offer.offeredBudget === 0) && (
                              <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito offerto</p>
                            )}
                          </div>
                        </div>

                        {/* What you request */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary-500/20 flex items-center justify-center">
                              <svg className="w-3 h-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-secondary-400 uppercase tracking-wide">Richiedi</p>
                          </div>
                          <div className="pl-8">
                            <PlayersTable players={offer.requestedPlayerDetails || offer.requestedPlayers || []} />
                            {offer.requestedBudget > 0 && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-50/20">
                                <div className="w-6 h-6 rounded bg-secondary-500/20 flex items-center justify-center">
                                  <span className="text-secondary-400 font-bold text-xs">€</span>
                                </div>
                                <span className="text-sm text-secondary-400 font-medium">+ {offer.requestedBudget} crediti</span>
                              </div>
                            )}
                            {(!offer.requestedPlayerDetails?.length && !offer.requestedPlayers?.length && offer.requestedBudget === 0) && (
                              <p className="text-gray-600 text-sm italic py-2">Nessun giocatore o credito richiesto</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {offer.status === 'PENDING' && !timeRemaining.isExpired && (
                        <div className="mt-6 pt-5 border-t border-surface-50/20">
                          <Button variant="outline" onClick={() => handleCancel(offer.id)} className="text-danger-400 border-danger-500/40 hover:bg-danger-500/10">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Annulla Offerta
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

      </main>

      {/* Contract Modification Modal after Trade Acceptance */}
      {isModifyingContract && currentPlayerForModification && currentPlayerForModification.contract && (
        <ContractModifierModal
          isOpen={true}
          onClose={handleSkipContractModification}
          player={{
            id: currentPlayerForModification.playerId,
            name: currentPlayerForModification.playerName,
            team: currentPlayerForModification.playerTeam,
            position: currentPlayerForModification.playerPosition,
          }}
          contract={{
            salary: currentPlayerForModification.contract.salary,
            duration: currentPlayerForModification.contract.duration,
            initialSalary: currentPlayerForModification.contract.initialSalary,
            rescissionClause: currentPlayerForModification.contract.rescissionClause,
          }}
          onConfirm={handleContractModification}
          title={`Modifica Contratto (${currentModificationIndex + 1}/${pendingContractModifications.length})`}
          description="Hai appena ricevuto questo giocatore via scambio. Puoi modificare il suo contratto seguendo le regole del rinnovo."
        />
      )}
    </div>
  )
}
