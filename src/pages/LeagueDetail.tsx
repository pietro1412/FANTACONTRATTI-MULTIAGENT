import { useState, useEffect } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { leagueApi, auctionApi, superadminApi, movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Navigation } from '../components/Navigation'
import { computeLeagueTotals, type LeagueTotals, type FinancialsData } from '../components/finance/types'
import type { LeagueSummary } from '../components/league/attention'
import {
  LeagueDetailHeader,
  AdminBanner,
  AttentionRail,
  QuickAccessTiles,
  FinancialKPIs,
  StrategySummary,
  RecentMovements,
  ManagersSidebar,
  AuctionConfirmModal,
  MarketOpeningSummaryModal,
  type MarketOpeningSummary,
  PreMarketOverview,
} from '../components/league-detail'

interface LeagueDetailProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  description?: string
  imageUrl?: string | null
  inviteCode?: string
  minParticipants: number
  maxParticipants: number
  initialBudget: number
  status: string
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
  members: Array<{
    id: string
    role: string
    status: string
    currentBudget: number
    teamName?: string
    user: { id: string; username: string; profilePhoto?: string }
    totalSalaries?: number
    balance?: number
  }>
}

interface Session {
  id: string
  type: string
  status: string
  currentPhase: string
  createdAt: string
  startsAt: string | null
  phaseStartedAt: string | null
}

interface StrategySummaryData {
  targets: number
  topPriority: number
  watching: number
  toSell: number
  total: number
}

interface MovementData {
  id: string
  type: string
  player: { name: string; position: string; team: string }
  from: { username: string } | null
  to: { username: string } | null
  price: number | null
  createdAt: string
}

export function LeagueDetail({ leagueId, onNavigate }: LeagueDetailProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()
  // Core state
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembership, setUserMembership] = useState<{ id: string; currentBudget: number } | null>(null)
  const [summary, setSummary] = useState<LeagueSummary | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [authExpired, setAuthExpired] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  // Action state
  const [isLeaving, setIsLeaving] = useState(false)
  const [showAuctionConfirm, setShowAuctionConfirm] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [marketOpeningSummary, setMarketOpeningSummary] = useState<MarketOpeningSummary | null>(null)

  // Lazy-loaded data
  const [leagueTotals, setLeagueTotals] = useState<LeagueTotals | null>(null)
  const [recentMovements, setRecentMovements] = useState<MovementData[]>([])
  const [strategySummary, setStrategySummary] = useState<StrategySummaryData | null>(null)
  const [lazyLoaded, setLazyLoaded] = useState(false)

  // Phase 1: Critical path load
  useEffect(() => {
    async function checkSuperAdmin() {
      const response = await superadminApi.getStatus()
      if (response.success && response.data) {
        const data = response.data as { isSuperAdmin: boolean }
        setIsSuperAdmin(data.isSuperAdmin)
        if (data.isSuperAdmin) {
          onNavigate('dashboard')
          return
        }
      } else {
        setIsSuperAdmin(false)
      }
      void loadCriticalData()
    }
    void checkSuperAdmin()
  }, [leagueId, onNavigate])

  async function loadCriticalData() {
    // Per-league attention signals: stesso endpoint della Dashboard, filtrato sulla lega corrente.
    // Failure non bloccante (la rotaia attenzione semplicemente non appare).
    const [leagueResult, sessionsResult, summaryResult] = await Promise.all([
      leagueApi.getById(leagueId),
      auctionApi.getSessions(leagueId),
      leagueApi.getDashboardSummary(),
    ])

    if (leagueResult.success && leagueResult.data) {
      const data = leagueResult.data as { league: League; isAdmin: boolean; userMembership: { id: string; currentBudget: number } }
      setLeague(data.league)
      setIsAdmin(data.isAdmin)
      setUserMembership(data.userMembership)
    } else if (leagueResult.authExpired) {
      // 401 non recuperabile: la sessione è scaduta, non è una lega mancante
      setAuthExpired(true)
    }

    if (sessionsResult.success && sessionsResult.data) {
      setSessions(sessionsResult.data as Session[])
    }

    if (summaryResult.success && summaryResult.data) {
      const data = summaryResult.data as { summaries?: Record<string, LeagueSummary> }
      setSummary(data.summaries?.[leagueId])
    }

    setIsLoading(false)
  }

  // Phase 2: Lazy load after first render
  useEffect(() => {
    if (!league || isLoading || lazyLoaded) return

    const hasFinancialData = sessions.some(
      s => s.type === 'PRIMO_MERCATO' && (s.status === 'COMPLETED' || s.status === 'ACTIVE')
    )

    if (!hasFinancialData) return

    setLazyLoaded(true)

    void Promise.all([
      leagueApi.getFinancials(leagueId),
      movementApi.getLeagueMovements(leagueId, { limit: 5 }),
      leagueApi.getStrategySummary(leagueId),
    ]).then(([financialsResult, movementsResult, strategyResult]) => {
      if (financialsResult.success && financialsResult.data) {
        const totals = computeLeagueTotals(financialsResult.data as FinancialsData)
        setLeagueTotals(totals)
      }
      if (movementsResult.success && movementsResult.data) {
        const movements = movementsResult.data as MovementData[]
        movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setRecentMovements(movements.slice(0, 5))
      }
      if (strategyResult.success && strategyResult.data) {
        setStrategySummary(strategyResult.data as StrategySummaryData)
      }
    })
  }, [league, isLoading, sessions, leagueId, lazyLoaded])

  // Helpers
  function getActiveSession() {
    return sessions.find(s => s.status === 'ACTIVE') || null
  }

  function isFirstMarketCompleted() {
    return sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  }

  const hasFinancialData = sessions.some(
    s => s.type === 'PRIMO_MERCATO' && (s.status === 'COMPLETED' || s.status === 'ACTIVE')
  )

  // Actions
  async function handleConfirmCreateSession() {
    setIsCreatingSession(true)
    const isRegularMarket = isFirstMarketCompleted()
    const result = await auctionApi.createSession(leagueId, isRegularMarket)
    setShowAuctionConfirm(false)
    if (result.success) {
      // Mercato ricorrente: il backend restituisce il riepilogo degli eventi di apertura
      // (decremento durata, svincoli per scadenza, svincoli ritirati). Mostralo all'admin.
      if (isRegularMarket && result.data) {
        const data = result.data as {
          contractsDecremented?: number
          playersReleased?: string[]
          ritiratiAutoReleased?: { released: number; players: string[] }
        }
        setMarketOpeningSummary({
          contractsDecremented: data.contractsDecremented ?? 0,
          playersReleased: data.playersReleased ?? [],
          ritiratiAutoReleased: data.ritiratiAutoReleased,
        })
      }
      const sessionsResult = await auctionApi.getSessions(leagueId)
      if (sessionsResult.success && sessionsResult.data) {
        setSessions(sessionsResult.data as Session[])
      }
    } else {
      toast.error(result.message || 'Errore nella creazione della sessione')
    }
    setIsCreatingSession(false)
  }

  async function handleLeaveLeague() {
    const ok = await confirmDialog({
      title: 'Abbandona lega',
      message: 'Sei sicuro di voler abbandonare questa lega?',
      confirmLabel: 'Abbandona',
      variant: 'danger'
    })
    if (!ok) return
    setIsLeaving(true)
    const result = await leagueApi.leave(leagueId)
    if (result.success) {
      onNavigate('dashboard')
    } else {
      toast.error(result.message || "Errore nell'abbandono della lega")
    }
    setIsLeaving(false)
  }

  // Loading states
  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (authExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-danger-400 mb-4">Sessione scaduta, effettua di nuovo il login</p>
          <Button variant="primary" onClick={() => { onNavigate('login'); }}>
            Vai al login
          </Button>
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-danger-400 mb-4">Lega non trovata</p>
          <Button variant="outline" onClick={() => { onNavigate('dashboard'); }}>
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const activeSession = getActiveSession()
  const activeMembers = league.members.filter(m => m.status === 'ACTIVE')

  return (
    <div className="min-h-screen">
      <Navigation currentPage="leagueDetail" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* Header: crest + nome + indicatore fase unico + budget */}
      <LeagueDetailHeader
        leagueName={league.name}
        leagueStatus={league.status}
        leagueImageUrl={league.imageUrl}
        memberCount={activeMembers.length}
        sessions={sessions}
        userBudget={userMembership?.currentBudget || 0}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* Richiede la tua attenzione (per-lega, riuso getDashboardSummary) */}
        <AttentionRail leagueId={leagueId} summary={summary} onNavigate={onNavigate} />

        {/* CTA dell'azione corrente (fase attiva) */}
        <AdminBanner
          leagueStatus={league.status}
          isAdmin={isAdmin}
          activeSession={activeSession}
          isFirstMarketCompleted={isFirstMarketCompleted()}
          leagueId={leagueId}
          onNavigate={onNavigate}
          onOpenAuctionClick={() => { setShowAuctionConfirm(true); }}
        />

        {/* Smistatore: accessi rapidi alle sezioni */}
        <QuickAccessTiles
          leagueId={leagueId}
          onNavigate={onNavigate}
          tradeOffers={summary?.tradeOffersReceived ?? 0}
        />

        {/* Main grid: 2/3 content + 1/3 sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial KPIs - only after first market */}
            {hasFinancialData && leagueTotals && (
              <FinancialKPIs
                totals={leagueTotals}
                initialBudget={league.initialBudget}
                teamCount={activeMembers.length}
              />
            )}

            {/* Financial KPIs skeleton */}
            {hasFinancialData && !leagueTotals && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Strategy Summary */}
            {hasFinancialData && strategySummary && (
              <StrategySummary data={strategySummary} onNavigate={onNavigate} leagueId={leagueId} />
            )}

            {/* Recent Movements */}
            {hasFinancialData && (
              <RecentMovements movements={recentMovements} onNavigate={onNavigate} leagueId={leagueId} />
            )}

            {/* Pre-market overview when no financial data yet */}
            {!hasFinancialData && league && (
              <PreMarketOverview
                initialBudget={league.initialBudget}
                teamCount={activeMembers.length}
                goalkeeperSlots={league.goalkeeperSlots}
                defenderSlots={league.defenderSlots}
                midfielderSlots={league.midfielderSlots}
                forwardSlots={league.forwardSlots}
                onNavigate={onNavigate}
                leagueId={leagueId}
              />
            )}
          </div>

          {/* Right: sidebar */}
          <div>
            <ManagersSidebar
              members={league.members}
              maxParticipants={league.maxParticipants}
              leagueId={leagueId}
              leagueStatus={league.status}
              isAdmin={isAdmin}
              isLeaving={isLeaving}
              totals={leagueTotals}
              inviteCode={league.inviteCode}
              onLeaveLeague={() => void handleLeaveLeague()}
            />
          </div>
        </div>
      </main>

      {/* Auction confirm modal */}
      {showAuctionConfirm && (
        <AuctionConfirmModal
          isRegularMarket={isFirstMarketCompleted()}
          activeMembers={activeMembers.length}
          isCreating={isCreatingSession}
          onConfirm={() => void handleConfirmCreateSession()}
          onCancel={() => { setShowAuctionConfirm(false); }}
        />
      )}

      {/* Market opening events summary (recurrent market) */}
      {marketOpeningSummary && (
        <MarketOpeningSummaryModal
          summary={marketOpeningSummary}
          onClose={() => { setMarketOpeningSummary(null); }}
        />
      )}
    </div>
  )
}
