import { useState, useEffect } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { leagueApi, auctionApi, superadminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Navigation } from '../components/Navigation'
import {
  LeagueDetailHeader,
  AdminBanner,
  RosterOverview,
  type RosterMemberData,
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

export function LeagueDetail({ leagueId, onNavigate }: LeagueDetailProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()
  // Core state
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembership, setUserMembership] = useState<{ id: string; currentBudget: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authExpired, setAuthExpired] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  // Action state
  const [isLeaving, setIsLeaving] = useState(false)
  const [showAuctionConfirm, setShowAuctionConfirm] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [marketOpeningSummary, setMarketOpeningSummary] = useState<MarketOpeningSummary | null>(null)

  // Lazy-loaded data: rose di tutti i manager (mia + avversari), budget e composizione per ruolo.
  const [rosters, setRosters] = useState<RosterMemberData[] | null>(null)
  const [lazyLoaded, setLazyLoaded] = useState(false)

  // Phase 1: Critical path load
  useEffect(() => {
    async function checkSuperAdmin() {
      const response = await superadminApi.getStatus()
      if (response.success && response.data) {
        const data = response.data as { isSuperAdmin: boolean }
        setIsSuperAdmin(data.isSuperAdmin)
      } else {
        setIsSuperAdmin(false)
      }
      // Superadmin can open any league (e.g. to review feedback/rosters) even without membership.
      void loadCriticalData()
    }
    void checkSuperAdmin()
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
    } else if (leagueResult.authExpired) {
      // 401 non recuperabile: la sessione è scaduta, non è una lega mancante
      setAuthExpired(true)
    }

    if (sessionsResult.success && sessionsResult.data) {
      setSessions(sessionsResult.data as Session[])
    }

    setIsLoading(false)
  }

  // Phase 2: Lazy load after first render — rose di tutti i manager (budget +
  // composizione per ruolo), uniche informazioni "post primo mercato" mostrate qui.
  useEffect(() => {
    if (!league || isLoading || lazyLoaded) return

    const hasFinancialData = sessions.some(
      s => s.type === 'PRIMO_MERCATO' && (s.status === 'COMPLETED' || s.status === 'ACTIVE')
    )

    if (!hasFinancialData) return

    setLazyLoaded(true)

    void auctionApi.getLeagueRosters(leagueId).then(result => {
      if (result.success && result.data) {
        setRosters(result.data as RosterMemberData[])
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
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
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

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* CTA dell'azione corrente (fase attiva) — unica fonte "in che fase siamo/cosa fare ora" */}
        <AdminBanner
          leagueStatus={league.status}
          isAdmin={isAdmin}
          activeSession={activeSession}
          isFirstMarketCompleted={isFirstMarketCompleted()}
          leagueId={leagueId}
          onNavigate={onNavigate}
          onOpenAuctionClick={() => { setShowAuctionConfirm(true); }}
        />

        {/* Rose: mia (budget + composizione) + avversari (solo composizione), ogni rosa cliccabile.
            Nessuna classifica bilanci / KPI di lega / movimenti qui: vivono già in Finanze e Storico
            (mockup docs/reviews/mockups/28-dashboard-lega/E-rose.html, scelto da Pietro). */}
        {hasFinancialData && rosters && (
          <RosterOverview
            rosters={rosters}
            myMemberId={userMembership?.id ?? null}
            slotLimits={{
              P: league.goalkeeperSlots,
              D: league.defenderSlots,
              C: league.midfielderSlots,
              A: league.forwardSlots,
            }}
            leagueId={leagueId}
            onNavigate={onNavigate}
          />
        )}

        {hasFinancialData && !rosters && (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Pre-market: nessuna rosa esiste ancora */}
        {!hasFinancialData && league && (
          <>
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
            {!isAdmin && league.status === 'DRAFT' && (
              <div className="text-center">
                <button
                  onClick={() => void handleLeaveLeague()}
                  disabled={isLeaving}
                  className="text-sm text-danger-400 hover:text-danger-300 font-medium disabled:opacity-50"
                >
                  {isLeaving ? 'Abbandono...' : 'Abbandona lega'}
                </button>
              </div>
            )}
          </>
        )}
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
