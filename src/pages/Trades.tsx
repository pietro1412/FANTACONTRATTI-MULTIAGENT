import { useState, useEffect, useMemo, useCallback } from 'react'
import { tradeApi, auctionApi, leagueApi, contractApi } from '../services/api'
import { usePusherTrades } from '../services/pusher.client'
import { Navigation } from '../components/Navigation'
import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { ContractModifierModal } from '../components/ContractModifier'
import { EmptyState } from '../components/ui/EmptyState'
import { BottomSheet } from '../components/ui/BottomSheet'
import { DealRosterPanel, DealTable, DealMobileFooter } from '../components/trades/deal-room'
import { PlayerStatsModal, type PlayerInfo } from '../components/PlayerStatsModal'
import { useToast } from '@/components/ui/Toast'
import { Tabs } from '@/components/ui/Tabs'
import haptic from '../utils/haptics'
import type { FinancialsData } from '../components/finance/types'
import {
  type TradeOffer, type LeagueMember, type RosterEntry, type MarketSession, type Player,
  TradeOfferCard,
  CounterOfferModal,
} from '../components/trades'

interface TradesProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  highlightOfferId?: string
}

export function Trades({ leagueId, onNavigate, highlightOfferId }: TradesProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [activeTab, setActiveTab] = useState<'create' | 'received' | 'sent' | 'history'>(
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
  const [, setCurrentSession] = useState<MarketSession | null>(null)
  const [tradeHistory, setTradeHistory] = useState<TradeOffer[]>([])
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'ACCEPTED' | 'REJECTED' | 'INVALIDATED' | 'CANCELLED'>('ALL')

  // Identity for the cockpit header
  const [leagueName, setLeagueName] = useState('')
  const [totalMembers, setTotalMembers] = useState(0)
  const [myTeamName, setMyTeamName] = useState('')

  // Create offer form
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>([])
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>([])
  const [offeredBudget, setOfferedBudget] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [message, setMessage] = useState('')
  const [offerDuration, setOfferDuration] = useState(24)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Search filters for create offer
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterManager, setFilterManager] = useState('')

  // Mobile BottomSheet state for Deal Room
  const [showMyRosterModal, setShowMyRosterModal] = useState(false)
  const [showPartnerRosterModal, setShowPartnerRosterModal] = useState(false)

  // Player stats modal
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerInfo | null>(null)

  // Counter offer modal
  const [counterOffer, setCounterOffer] = useState<TradeOffer | null>(null)

  // Ongoing trades indicator (anonymized, league-wide, not involving the user)
  const [ongoingTradesCount, setOngoingTradesCount] = useState(0)

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
    void loadData()
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
      return () => { clearTimeout(timer); }
    }
  }, [highlightedOfferId, isLoading])

  // Pusher real-time: auto-refresh when trade events arrive
  const { isConnected: pusherConnected } = usePusherTrades(leagueId, {
    onTradeOfferReceived: useCallback(() => {
      void loadData()
    }, [leagueId]),
    onTradeUpdated: useCallback(() => {
      void loadData()
    }, [leagueId]),
  })

  async function loadData() {
    setIsLoading(true)
    setLoadError('')

    try {
    const [receivedRes, sentRes, membersRes, rosterRes, sessionsRes, leagueRes, allRostersRes, financialsRes, historyRes, ongoingRes] = await Promise.all([
      tradeApi.getReceived(leagueId),
      tradeApi.getSent(leagueId),
      leagueApi.getMembers(leagueId),
      auctionApi.getRoster(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getById(leagueId),
      auctionApi.getLeagueRosters(leagueId),
      leagueApi.getFinancials(leagueId),
      tradeApi.getHistory(leagueId),
      // Non-essential indicator: a failure here must not blank the whole page
      Promise.resolve()
        .then(() => tradeApi.getOngoingIndicator(leagueId))
        .catch((): { success: boolean; data?: unknown } => ({ success: false })),
    ])

    if (ongoingRes.success && ongoingRes.data) {
      const data = ongoingRes.data as { count?: number }
      setOngoingTradesCount(typeof data.count === 'number' ? data.count : 0)
    }

    if (leagueRes.success && leagueRes.data) {
      const data = leagueRes.data as { name?: string; userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
      if (data.name) setLeagueName(data.name)
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
      for (const t of fData.teams || []) {
        financialsMap.set(t.memberId, { budget: t.budget, annualContractCost: t.annualContractCost, slotCount: t.slotCount })
      }
    }

    if (membersRes.success && membersRes.data) {
      const allMembers = (membersRes.data as { members: (LeagueMember & { teamName?: string })[] }).members || []
      setTotalMembers(allMembers.length)
      const myMember = allMembers.find(m => m.id === currentMemberId)
      if (myMember) setMyTeamName(myMember.teamName || myMember.user.username)
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
        player: { id: string; name: string; team: string; position: string; quotation?: number; age?: number | null; apiFootballId?: number | null; computedStats?: RosterEntry['player']['computedStats']; statsSyncedAt?: string | null }
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
          computedStats: r.player.computedStats,
          statsSyncedAt: r.player.statsSyncedAt,
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
          player: { id: string; name: string; position: string; team: string; quotation?: number; age?: number | null; apiFootballId?: number | null; computedStats?: RosterEntry['player']['computedStats']; statsSyncedAt?: string | null }
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
          computedStats?: RosterEntry['player']['computedStats']
          statsSyncedAt?: string | null
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

        if (memberId === currentMemberId) {
          // Extract computedStats from allRosters for own players (reliable source with stats)
          const myStatsFromAllRosters = new Map<string, RosterEntry['player']['computedStats']>()
          const myPlayers = memberRoster.players || memberRoster.roster?.map(r => ({
            id: r.player.id,
            computedStats: r.player.computedStats,
            statsSyncedAt: r.player.statsSyncedAt,
          })) || []
          for (const p of myPlayers) {
            if (p.computedStats) {
              myStatsFromAllRosters.set(p.id, p.computedStats)
            }
          }
          // Enrich myRoster with computedStats from allRosters
          if (myStatsFromAllRosters.size > 0) {
            setMyRoster(prev => prev.map(entry => ({
              ...entry,
              player: {
                ...entry.player,
                computedStats: entry.player.computedStats || myStatsFromAllRosters.get(entry.player.id) || null,
              },
            })))
          }
          continue
        }

        const players = memberRoster.players || memberRoster.roster?.map(r => ({
          id: r.player.id,
          rosterId: r.id,
          name: r.player.name,
          position: r.player.position,
          team: r.player.team,
          quotation: r.player.quotation,
          age: r.player.age,
          apiFootballId: r.player.apiFootballId,
          computedStats: r.player.computedStats,
          statsSyncedAt: r.player.statsSyncedAt,
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
              computedStats: p.computedStats,
              statsSyncedAt: p.statsSyncedAt,
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

    if (historyRes.success && historyRes.data) {
      setTradeHistory(historyRes.data as TradeOffer[])
    }

    } catch {
      setLoadError('Errore nel caricamento delle trattative. Verifica la connessione.')
    }
    setIsLoading(false)
    setHasLoadedOnce(true)
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
  const myRosterNext = myRoster.length - selectedOfferedPlayers.length + selectedRequestedPlayers.length

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
  }

  function handleViewStats(p: Player) {
    setSelectedPlayerStats({
      name: p.name,
      team: p.team,
      position: p.position,
      quotation: p.quotation,
      age: p.age,
      apiFootballId: p.apiFootballId,
      computedStats: p.computedStats,
      statsSyncedAt: p.statsSyncedAt,
    })
  }

  function handleViewStatsEntry(entry: RosterEntry) {
    handleViewStats(entry.player)
  }

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault()
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
      const warnings = (res as unknown as { warnings?: string[] }).warnings
      toast.success(warnings?.length ? `Offerta inviata! ${warnings.join(' ')}` : 'Offerta inviata!')
      resetCreateForm()
      void loadData()
      setActiveTab('sent')
    } else {
      toast.error(res.message || 'Errore durante l\'invio dell\'offerta')
    }

    setIsSubmitting(false)
  }

  async function handleAccept(tradeId: string) {
    const res = await tradeApi.accept(tradeId)
    if (res.success) {
      toast.success('Scambio accettato! I contratti dei giocatori ricevuti saranno modificabili nella fase di rinnovo contratti.')
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
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
        void loadData()
      }
    } else {
      toast.error(res.message || 'Errore durante la modifica del contratto')
    }
  }

  function handleSkipContractModification() {
    if (currentModificationIndex < pendingContractModifications.length - 1) {
      setCurrentModificationIndex(currentModificationIndex + 1)
    } else {
      setIsModifyingContract(false)
      setPendingContractModifications([])
      setCurrentModificationIndex(0)
      void loadData()
    }
  }

  async function handleReject(tradeId: string) {
    const res = await tradeApi.reject(tradeId)
    if (res.success) {
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
    }
  }

  async function handleCancel(tradeId: string) {
    const res = await tradeApi.cancel(tradeId)
    if (res.success) {
      void loadData()
    } else {
      toast.error(res.message || 'Errore')
    }
  }

  function togglePlayer(list: string[], setList: (l: string[]) => void, playerId: string) {
    if (list.includes(playerId)) {
      setList(list.filter(id => id !== playerId))
    } else {
      setList([...list, playerId])
    }
  }

  // First load: full-screen spinner. Subsequent Pusher refreshes keep the UI mounted.
  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento trattative...</p>
        </div>
      </div>
    )
  }

  // ===== Cockpit testata =====
  const header = (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap min-h-[56px]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
        <span className="text-lg" aria-hidden="true">🤝</span>
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="font-display font-bold text-sm sm:text-base text-white leading-tight truncate">
          {myTeamName ? `${myTeamName} · Trattative` : 'Trattative'}
        </h1>
        <span className="text-sm text-gray-500 leading-tight truncate">
          {leagueName ? `${leagueName} · ${totalMembers} squadre` : 'Scambi tra manager'}
        </span>
      </div>

      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold border ${
        pusherConnected ? 'bg-secondary-500/10 border-secondary-500/30 text-secondary-400' : 'bg-warning-500/10 border-warning-500/30 text-warning-400 animate-pulse'
      }`}>
        <span className={pusherConnected ? 'dot-live bg-secondary-500 shadow-[0_0_8px_theme(colors.secondary.500)]' : 'w-1.5 h-1.5 rounded-full bg-warning-400'} />
        {pusherConnected ? 'Connesso' : 'Disconnesso'}
      </span>

      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold tracking-[0.06em] border ${
        isInTradePhase ? 'text-accent-400 bg-accent-500/10 border-accent-500/50' : 'text-gray-400 bg-surface-300 border-surface-50'
      }`}>
        <span aria-hidden="true">●</span>
        {isInTradePhase ? 'Offerte pre-rinnovo' : 'Scambi non disponibili'}
      </span>

      <div className="ml-auto flex items-center gap-4">
        <div className="text-right">
          <div className="micro-label text-[9px]">Budget</div>
          <div className="budget-display text-lg sm:text-xl text-accent-400 leading-tight">{myBudget}<span className="text-xs text-gray-500">M</span></div>
        </div>
        <div className="hidden sm:block w-px h-7 bg-surface-50" />
        <div className="hidden sm:block text-right">
          <div className="micro-label text-[9px]">Monte ingaggi</div>
          <div className="budget-display text-lg sm:text-xl text-white leading-tight">{myTotalSalary}<span className="text-xs text-gray-500">M</span></div>
        </div>
        <div className="hidden md:block w-px h-7 bg-surface-50" />
        <div className="hidden md:block text-right">
          <div className="micro-label text-[9px]">Rosa</div>
          <div className="budget-display text-lg sm:text-xl text-white leading-tight">{myRoster.length}</div>
        </div>
      </div>
    </div>
  )

  // ===== Cockpit barra tab + indicatore trattative in corso =====
  const adminBar = (
    <div className="mt-2 flex items-center gap-3 flex-wrap">
      <Tabs
        className="flex-1 min-w-0"
        ariaLabel="Sezioni scambi"
        value={activeTab}
        onChange={(id) => { setActiveTab(id as typeof activeTab); }}
        tabs={[
          {
            id: 'create',
            label: 'Nuova Offerta',
            mobileLabel: 'Nuova',
            accent: 'primary',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ),
          },
          { id: 'received', label: 'Ricevute', accent: 'accent', badge: receivedOffers.length },
          { id: 'sent', label: 'Inviate', accent: 'primary', badge: sentOffers.length },
          { id: 'history', label: 'Concluse', accent: 'gray', badge: tradeHistory.length },
        ]}
      />
      {ongoingTradesCount > 0 && (
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-500/[0.12] border border-accent-500/30 text-accent-400 text-xs font-medium flex-shrink-0"
          title="Altre trattative sono in corso nella lega. I dettagli non sono visibili."
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {ongoingTradesCount} {ongoingTradesCount === 1 ? 'trattativa in corso' : 'trattative in corso'} nella lega
        </span>
      )}
    </div>
  )

  const canSubmit = !!(selectedMemberId && (selectedOfferedPlayers.length > 0 || offeredBudget > 0 || selectedRequestedPlayers.length > 0 || requestedBudget > 0))

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
      <Navigation currentPage="trades" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="w-full max-w-full mx-auto px-3 lg:px-4 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden">
        {loadError && (
          <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4 mb-3 text-center lg:flex-shrink-0">
            <p className="text-danger-400">{loadError}</p>
            <button
              onClick={() => { setLoadError(''); void loadData(); }}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
            >
              Riprova
            </button>
          </div>
        )}

        <CockpitShell header={header} adminBar={adminBar}>
          <div className="mt-3 lg:mt-3 lg:h-full lg:min-h-0">

            {/* ===== TAB: Nuova Offerta ===== */}
            {activeTab === 'create' && (
              !isInTradePhase ? (
                <div className="bg-surface-200 border border-surface-50 rounded-xl py-10 text-center">
                  <p className="text-accent-400">Puoi creare offerte solo durante la fase SCAMBI/OFFERTE</p>
                </div>
              ) : (
                <>
                  {/* 3-column deal room (desktop). Mobile: arena only + BottomSheets */}
                  <div className="lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-3">
                    {/* Sinistra: la mia rosa (desktop) */}
                    <div className="hidden lg:block lg:min-h-0">
                      <DealRosterPanel
                        side="mine"
                        myRoster={myRoster}
                        selectedOfferedPlayers={selectedOfferedPlayers}
                        onToggleOffered={(id) => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                        myBudget={myBudget}
                        onViewStats={handleViewStatsEntry}
                      />
                    </div>

                    {/* Centro: tavolo (arena oro) */}
                    <div className={`lg:min-h-0 ${hasTradeSelections ? 'pb-40 lg:pb-0' : ''}`}>
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
                        onRemoveOffered={(id) => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                        offeredBudget={offeredBudget}
                        onOfferedBudgetChange={setOfferedBudget}
                        selectedRequestedPlayers={selectedRequestedPlayers}
                        allOtherPlayers={allOtherPlayers}
                        onRemoveRequested={(id) => { togglePlayer(selectedRequestedPlayers, setSelectedRequestedPlayers, id); }}
                        requestedBudget={requestedBudget}
                        onRequestedBudgetChange={setRequestedBudget}
                        offerDuration={offerDuration}
                        onDurationChange={setOfferDuration}
                        message={message}
                        onMessageChange={setMessage}
                        budgetNow={myBudget}
                        budgetNext={myPostTradeBudget}
                        salaryNow={myTotalSalary}
                        salaryNext={myPostTradeSalary}
                        rosterNow={myRoster.length}
                        rosterNext={myRosterNext}
                        isSubmitting={isSubmitting}
                        canSubmit={canSubmit}
                        onSubmit={(e) => { void handleCreateOffer(e) }}
                        onOpenMyRoster={() => { setShowMyRosterModal(true); }}
                        onOpenPartnerRoster={() => { setShowPartnerRosterModal(true); }}
                        onViewStats={handleViewStatsEntry}
                      />
                    </div>

                    {/* Destra: rosa partner (desktop) */}
                    <div className="hidden lg:block lg:min-h-0">
                      <DealRosterPanel
                        side="partner"
                        filteredPlayers={filteredOtherPlayers}
                        selectedRequestedPlayers={selectedRequestedPlayers}
                        onToggleRequested={handleSelectRequestedPlayer}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        filterRole={filterRole}
                        onFilterRoleChange={setFilterRole}
                        targetMember={targetMember}
                        onViewStats={handleViewStatsEntry}
                      />
                    </div>
                  </div>

                  {/* Mobile BottomSheet: La Mia Rosa */}
                  <BottomSheet
                    isOpen={showMyRosterModal}
                    onClose={() => { setShowMyRosterModal(false); }}
                    title="La Mia Rosa"
                    maxHeight="85vh"
                  >
                    <DealRosterPanel
                      side="mine"
                      variant="sheet"
                      myRoster={myRoster}
                      selectedOfferedPlayers={selectedOfferedPlayers}
                      onToggleOffered={(id) => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                      myBudget={myBudget}
                      onViewStats={handleViewStatsEntry}
                    />
                    <div className="sticky bottom-0 px-4 py-3 bg-surface-200 border-t border-surface-50">
                      <button
                        onClick={() => { setShowMyRosterModal(false); }}
                        className="w-full py-3 rounded-xl font-bold text-base bg-danger-500/20 text-danger-400 border border-danger-500/30 active:scale-[0.98] transition-all"
                      >
                        Conferma selezione{selectedOfferedPlayers.length > 0 ? ` (${selectedOfferedPlayers.length})` : ''}
                      </button>
                    </div>
                  </BottomSheet>

                  {/* Mobile BottomSheet: Rosa Partner */}
                  <BottomSheet
                    isOpen={showPartnerRosterModal}
                    onClose={() => { setShowPartnerRosterModal(false); }}
                    title={targetMember ? `Rosa ${targetMember.user.username}` : 'Rosa Partner'}
                    maxHeight="85vh"
                  >
                    <DealRosterPanel
                      side="partner"
                      variant="sheet"
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
                      onViewStats={handleViewStatsEntry}
                    />
                    <div className="sticky bottom-0 px-4 py-3 bg-surface-200 border-t border-surface-50">
                      <button
                        onClick={() => { setShowPartnerRosterModal(false); }}
                        className="w-full py-3 rounded-xl font-bold text-base bg-primary-500/20 text-primary-400 border border-primary-500/30 active:scale-[0.98] transition-all"
                      >
                        Conferma selezione{selectedRequestedPlayers.length > 0 ? ` (${selectedRequestedPlayers.length})` : ''}
                      </button>
                    </div>
                  </BottomSheet>

                  {/* Mobile sticky footer */}
                  <DealMobileFooter
                    offeredCount={selectedOfferedPlayers.length}
                    requestedCount={selectedRequestedPlayers.length}
                    isSubmitting={isSubmitting}
                    onSubmit={() => { void handleCreateOffer({ preventDefault: () => {} } as React.FormEvent) }}
                    canSubmit={canSubmit}
                    hasSelections={hasTradeSelections}
                  />
                </>
              )
            )}

            {/* ===== TAB: Ricevute ===== */}
            {activeTab === 'received' && (
              <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
                <div className="px-4 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
                  <span className="micro-label">Offerte ricevute · in attesa di risposta</span>
                  <span className="ml-auto font-mono text-[10.5px] text-gray-500">{receivedOffers.length} offerte</span>
                </div>
                {receivedOffers.length === 0 ? (
                  <div className="py-8">
                    <EmptyState icon="📥" title="Nessuna offerta ricevuta" description="Le offerte che riceverai appariranno qui" />
                  </div>
                ) : (
                  <div className="panel-scroll flex-1 min-h-0">
                    {receivedOffers.map(offer => (
                      <TradeOfferCard
                        key={offer.id}
                        offer={offer}
                        variant="received"
                        isInTradePhase={isInTradePhase}
                        isHighlighted={offer.id === highlightedOfferId}
                        onAccept={(id) => { void handleAccept(id) }}
                        onCounter={(o) => { setCounterOffer(o); }}
                        onReject={(id) => { void handleReject(id) }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== TAB: Inviate ===== */}
            {activeTab === 'sent' && (
              <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
                <div className="px-4 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
                  <span className="micro-label">Offerte inviate · in attesa di risposta</span>
                  <span className="ml-auto font-mono text-[10.5px] text-gray-500">{sentOffers.length} offerte</span>
                </div>
                {sentOffers.length === 0 ? (
                  <div className="py-8">
                    <EmptyState icon="📤" title="Nessuna offerta inviata" description="Le tue offerte appariranno qui" />
                  </div>
                ) : (
                  <div className="panel-scroll flex-1 min-h-0">
                    {sentOffers.map(offer => (
                      <TradeOfferCard
                        key={offer.id}
                        offer={offer}
                        variant="sent"
                        isInTradePhase={isInTradePhase}
                        isHighlighted={offer.id === highlightedOfferId}
                        onCancel={(id) => { void handleCancel(id) }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== TAB: Concluse ===== */}
            {activeTab === 'history' && (
              <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0">
                <div className="px-4 py-2.5 border-b border-surface-50 flex items-center gap-2 flex-wrap flex-shrink-0">
                  <span className="micro-label flex-shrink-0">Trattative concluse</span>
                  <div className="flex flex-wrap gap-1.5 ml-auto">
                    {([
                      { key: 'ALL', label: 'Tutte' },
                      { key: 'ACCEPTED', label: 'Accettate' },
                      { key: 'REJECTED', label: 'Rifiutate' },
                      { key: 'INVALIDATED', label: 'Decadute' },
                      { key: 'CANCELLED', label: 'Annullate' },
                    ] as const).map(chip => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => { setHistoryFilter(chip.key); }}
                        className={`px-2.5 py-1 rounded-full font-mono text-[9.5px] font-bold border transition-colors ${
                          historyFilter === chip.key
                            ? 'bg-accent-400 text-dark-300 border-accent-400'
                            : 'bg-surface-300 text-gray-400 border-surface-50 hover:text-gray-300'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const filtered = historyFilter === 'ALL'
                    ? tradeHistory
                    : tradeHistory.filter(o => o.status === historyFilter)

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8">
                        <EmptyState
                          icon="📋"
                          title="Nessuna trattativa conclusa"
                          description={historyFilter === 'ALL' ? 'Le trattative concluse appariranno qui' : 'Nessuna trattativa con questo stato'}
                        />
                      </div>
                    )
                  }

                  return (
                    <div className="panel-scroll flex-1 min-h-0">
                      {filtered.map(offer => (
                        <TradeOfferCard key={offer.id} offer={offer} variant="history" />
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </CockpitShell>
      </main>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => { setSelectedPlayerStats(null); }}
        player={selectedPlayerStats}
      />

      {/* Counter Offer Modal */}
      {counterOffer && (
        <CounterOfferModal
          isOpen={true}
          onClose={() => { setCounterOffer(null); }}
          offer={counterOffer}
          myRoster={myRoster}
          allOtherPlayers={allOtherPlayers}
          onCountered={() => {
            toast.success('Controfferta inviata!')
            haptic.send()
            void loadData()
            setActiveTab('sent')
          }}
        />
      )}

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
