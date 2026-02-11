import { useState, useEffect } from 'react'
import { leagueApi, auctionApi, superadminApi, movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { computeLeagueTotals, type LeagueTotals, type FinancialsData } from '../components/finance/types'
import {
  LeagueDetailHeader,
  AdminBanner,
  FinancialKPIs,
  StrategySummary,
  RecentMovements,
  ManagersSidebar,
  AuctionConfirmModal,
} from '../components/league-detail'

interface LeagueDetailProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  description?: string
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
  // Core state
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembership, setUserMembership] = useState<{ id: string; currentBudget: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  // Action state
  const [isLeaving, setIsLeaving] = useState(false)
  const [showAuctionConfirm, setShowAuctionConfirm] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)

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
      loadCriticalData()
    }
    checkSuperAdmin()
  }, [leagueId, onNavigate])

  async function loadCriticalData() {
    const [leagueResult, sessionsResult] = await Promise.all([
      leagueApi.getById(leagueId),
      auctionApi.getSessions(leagueId),
    ])

    if (leagueResult.success && leagueResult.data) {
      const data = leagueResult.data as { league: League; isAdmin: boolean; userMembership: { id: string; currentBudget: number } }
      setLeague(data.league)
      setIsAdmin(data.isAdmin)
      setUserMembership(data.userMembership)
    }

    if (sessionsResult.success && sessionsResult.data) {
      setSessions(sessionsResult.data as Session[])
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

    Promise.all([
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
    setError('')
    setIsCreatingSession(true)
    const isRegularMarket = isFirstMarketCompleted()
    const result = await auctionApi.createSession(leagueId, isRegularMarket)
    setShowAuctionConfirm(false)
    if (result.success) {
      const sessionsResult = await auctionApi.getSessions(leagueId)
      if (sessionsResult.success && sessionsResult.data) {
        setSessions(sessionsResult.data as Session[])
      }
    } else {
      setError(result.message || 'Errore nella creazione della sessione')
    }
    setIsCreatingSession(false)
  }

  async function handleLeaveLeague() {
    if (!confirm('Sei sicuro di voler abbandonare questa lega?')) return
    setIsLeaving(true)
    const result = await leagueApi.leave(leagueId)
    if (result.success) {
      onNavigate('dashboard')
    } else {
      setError(result.message || "Errore nell'abbandono della lega")
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-surface-100 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface-200 rounded-xl p-4 space-y-3 border border-surface-50/20">
                <div className="h-4 w-3/4 bg-surface-100 rounded" />
                <div className="h-8 w-full bg-surface-100 rounded" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-surface-200 rounded-lg border border-surface-50/20" />
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface-200 rounded-lg border border-surface-50/20" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-danger-400 mb-4">Lega non trovata</p>
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
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

      {/* Header: nome + stepper + budget */}
      <LeagueDetailHeader
        leagueName={league.name}
        leagueStatus={league.status}
        sessions={sessions}
        userBudget={userMembership?.currentBudget || 0}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-surface-200 border border-danger-500/50 rounded-xl p-4 flex items-center gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="w-8 h-8 rounded-full bg-danger-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-danger-400 text-sm">!</span>
            </div>
            <p className="text-gray-300 text-sm flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 p-1">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Admin / Phase Banner */}
        <AdminBanner
          leagueStatus={league.status}
          isAdmin={isAdmin}
          activeSession={activeSession}
          isFirstMarketCompleted={isFirstMarketCompleted()}
          leagueId={leagueId}
          onNavigate={onNavigate}
          onOpenAuctionClick={() => setShowAuctionConfirm(true)}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-surface-200 rounded-xl p-4 space-y-2 border border-surface-50/20">
                    <div className="h-3 w-20 bg-surface-100 rounded" />
                    <div className="h-7 w-16 bg-surface-100 rounded" />
                    <div className="h-1.5 w-full bg-surface-100 rounded-full" />
                  </div>
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
              onLeaveLeague={handleLeaveLeague}
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
          onConfirm={handleConfirmCreateSession}
          onCancel={() => setShowAuctionConfirm(false)}
        />
      )}
    </div>
  )
}
