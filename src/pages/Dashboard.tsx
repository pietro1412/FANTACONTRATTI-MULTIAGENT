import { useState, useEffect } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { leagueApi, superadminApi, movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { SearchLeaguesModal } from '../components/SearchLeaguesModal'
import { SkeletonCard } from '../components/ui/Skeleton'

interface DashboardProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  status: string
  members: Array<{ id: string; role: string }>
}

interface Membership {
  id: string
  role: string
  status: string
  currentBudget: number
}

interface LeagueData {
  membership: Membership
  league: League
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ora'
  if (mins < 60) return `${mins}m fa`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h fa`
  const days = Math.floor(hours / 24)
  return `${days}g fa`
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'In preparazione',
  ACTIVE: 'Attiva',
  COMPLETED: 'Completata',
}

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Membro',
  PENDING: 'In attesa di approvazione',
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const [leagues, setLeagues] = useState<LeagueData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [cancellingLeagueId, setCancellingLeagueId] = useState<string | null>(null)

  // T-022: Activity feed
  interface ActivityItem {
    id: string
    type: string
    playerName: string
    playerPosition: string
    fromUser: string | null
    toUser: string | null
    price: number | null
    createdAt: string
    leagueName: string
  }
  const [activities, setActivities] = useState<ActivityItem[]>([])

  async function handleCancelRequest(e: React.MouseEvent, leagueId: string) {
    e.stopPropagation()
    if (cancellingLeagueId) return

    const ok = await confirmDialog({
      title: 'Annulla richiesta',
      message: 'Sei sicuro di voler annullare la richiesta di partecipazione?',
      confirmLabel: 'Annulla richiesta',
      variant: 'warning'
    })
    if (!ok) return

    setCancellingLeagueId(leagueId)
    try {
      const response = await leagueApi.cancelRequest(leagueId)
      if (response.success) {
        setLeagues(prev => prev.filter(l => l.league.id !== leagueId))
      }
    } catch (err) {
      console.error('Error cancelling request:', err)
    }
    setCancellingLeagueId(null)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Check if user is superadmin
    const statusResponse = await superadminApi.getStatus()
    if (statusResponse.success && statusResponse.data) {
      const isAdmin = (statusResponse.data as { isSuperAdmin: boolean }).isSuperAdmin
      setIsSuperAdmin(isAdmin)
      if (isAdmin) {
        // Redirect superadmin directly to admin panel
        onNavigate('superadmin')
        return
      }
    }
    await loadLeagues()
  }

  async function loadLeagues() {
    const response = await leagueApi.getAll()
    if (response.success && response.data) {
      const leagueData = response.data as LeagueData[]
      setLeagues(leagueData)

      // T-022: Load recent activity from active leagues
      const activeLeagues = leagueData.filter(l => l.membership.status === 'ACTIVE')
      if (activeLeagues.length > 0) {
        const movementPromises = activeLeagues.slice(0, 3).map(async ({ league }) => {
          const res = await movementApi.getLeagueMovements(league.id, { limit: 5 })
          if (res.success && res.data) {
            const movements = (res.data as { movements: Array<{ id: string; type: string; player: { name: string; position: string }; from: { username: string } | null; to: { username: string } | null; price: number | null; createdAt: string }> }).movements || []
            return movements.map(m => ({
              id: m.id,
              type: m.type,
              playerName: m.player.name,
              playerPosition: m.player.position,
              fromUser: m.from?.username || null,
              toUser: m.to?.username || null,
              price: m.price,
              createdAt: m.createdAt,
              leagueName: league.name,
            }))
          }
          return []
        })
        const allMovements = (await Promise.all(movementPromises)).flat()
        allMovements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setActivities(allMovements.slice(0, 10))
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="dashboard" onNavigate={onNavigate} />

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">Le mie Leghe</h2>
            <p className="text-gray-400">
              {isSuperAdmin ? 'Sei un superadmin - usa il pannello di controllo per gestire la piattaforma' : 'Gestisci le tue leghe fantasy'}
            </p>
          </div>
          {!isSuperAdmin && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" onClick={() => setShowSearchModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Cerca Leghe
              </Button>
              <Button size="lg" onClick={() => onNavigate('create-league')}>
                <span className="mr-2">+</span> Crea Nuova Lega
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 sm:p-16 text-center">
            <div className="w-24 h-24 rounded-full bg-surface-300 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">{isSuperAdmin ? '🛡️' : '🏆'}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {isSuperAdmin ? 'Nessuna lega da visualizzare' : 'Benvenuto su Fantacontratti!'}
            </h3>
            <p className="text-lg text-gray-400 mb-8 max-w-md mx-auto">
              {isSuperAdmin
                ? 'Come superadmin, puoi gestire la piattaforma dal pannello di controllo. Non partecipi direttamente alle leghe.'
                : 'Inizia la tua avventura dynasty in 3 semplici passi.'}
            </p>

            {isSuperAdmin ? (
              <Button size="xl" onClick={() => onNavigate('superadmin')}>
                Vai al Pannello di Controllo
              </Button>
            ) : (
              <>
                {/* T-019: Onboarding steps */}
                <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                  <div className="bg-surface-300 rounded-xl p-5 border border-surface-50/20">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg font-bold text-primary-400">1</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-1">Crea o Cerca</h4>
                    <p className="text-xs text-gray-400">Crea una nuova lega o cerca una lega esistente a cui unirti</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-5 border border-surface-50/20">
                    <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg font-bold text-accent-400">2</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-1">Invita Amici</h4>
                    <p className="text-xs text-gray-400">Invita i tuoi amici a unirsi alla lega per competere insieme</p>
                  </div>
                  <div className="bg-surface-300 rounded-xl p-5 border border-surface-50/20">
                    <div className="w-10 h-10 rounded-full bg-secondary-500/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-lg font-bold text-secondary-400">3</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-1">Inizia l'Asta</h4>
                    <p className="text-xs text-gray-400">L'admin avvia l'asta e tutti competono per costruire la rosa</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="xl" onClick={() => onNavigate('create-league')}>
                    <span className="mr-2">+</span> Crea la tua prima lega
                  </Button>
                  <Button size="xl" variant="outline" onClick={() => setShowSearchModal(true)}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Cerca Lega Esistente
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map(({ membership, league }) => {
              const isPending = membership.status === 'PENDING'

              return (
                <div
                  key={league.id}
                  className={`bg-surface-200 rounded-xl border overflow-hidden transition-all duration-300 ${
                    isPending
                      ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent'
                      : 'border-surface-50/20'
                  } ${
                    isSuperAdmin
                      ? 'opacity-75'
                      : isPending
                        ? ''
                        : 'hover:border-primary-500/40 hover:shadow-glow cursor-pointer group'
                  }`}
                  onClick={() => !isSuperAdmin && !isPending && onNavigate('leagueDetail', { leagueId: league.id })}
                >
                  {/* Pending Banner (#49) */}
                  {isPending && (
                    <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
                      <span className="text-amber-400 animate-pulse">⏳</span>
                      <span className="text-amber-400 text-sm font-medium">
                        {MEMBERSHIP_STATUS_LABELS.PENDING}
                      </span>
                    </div>
                  )}

                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-surface-300 to-surface-200 p-5 border-b border-surface-50/20">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-lg ${
                          isPending
                            ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                            : 'bg-gradient-to-br from-primary-500 to-primary-700'
                        }`}>
                          <span className="text-xl">{isPending ? '⏳' : '🏟️'}</span>
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold transition-colors ${
                            isPending ? 'text-amber-200' : 'text-white group-hover:text-primary-400'
                          }`}>
                            {league.name}
                          </h3>
                          <p className="text-sm text-gray-400">{league.members.length} DG</p>
                        </div>
                      </div>
                      {!isPending && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            membership.role === 'ADMIN'
                              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                              : 'bg-surface-50/20 text-gray-400 border border-surface-50/30'
                          }`}
                        >
                          {membership.role === 'ADMIN' ? 'Presidente' : 'DG'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="bg-surface-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Stato Lega</p>
                        <p className={`text-base font-bold ${
                          league.status === 'ACTIVE' ? 'text-secondary-400' :
                          league.status === 'DRAFT' ? 'text-accent-400' : 'text-gray-400'
                        }`}>
                          {STATUS_LABELS[league.status] || league.status}
                        </p>
                      </div>
                      <div className="bg-surface-300 rounded-lg p-4 text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                          {isPending ? 'Stato' : 'Budget'}
                        </p>
                        {isPending ? (
                          <p className="text-base font-bold text-amber-400">In attesa</p>
                        ) : (
                          <div>
                            <p className={`text-base font-bold ${
                              membership.currentBudget > 200 ? 'text-secondary-400' :
                              membership.currentBudget > 50 ? 'text-accent-400' : 'text-danger-400'
                            }`}>
                              {membership.currentBudget}M
                            </p>
                            {/* T-011: Budget progress bar */}
                            <div className="mt-2 h-1.5 bg-surface-400 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  membership.currentBudget > 200 ? 'bg-secondary-400' :
                                  membership.currentBudget > 50 ? 'bg-accent-400' : 'bg-danger-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, (membership.currentBudget / 500) * 100))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* T-010: Quick action buttons */}
                    {!isPending && !isSuperAdmin && league.status === 'ACTIVE' && (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('rose', { leagueId: league.id }) }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-surface-50/20"
                        >
                          <span>📋</span> Rosa
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('contracts', { leagueId: league.id }) }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-surface-50/20"
                        >
                          <span>📝</span> Contratti
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('financials', { leagueId: league.id }) }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-surface-50/20"
                        >
                          <span>💰</span> Finanze
                        </button>
                      </div>
                    )}

                    {isSuperAdmin ? (
                      <p className="text-center text-gray-500 text-sm">
                        I superadmin non possono partecipare alle leghe
                      </p>
                    ) : isPending ? (
                      <Button
                        variant="outline"
                        className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        onClick={(e) => handleCancelRequest(e, league.id)}
                        disabled={cancellingLeagueId === league.id}
                      >
                        {cancellingLeagueId === league.id ? 'Annullando...' : '✕ Annulla Richiesta'}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full">
                        Entra nella Lega →
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* T-022: Activity Feed */}
        {activities.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold text-white mb-4">Attivita Recente</h3>
            <div className="bg-surface-200 rounded-xl border border-surface-50/20 divide-y divide-surface-50/10">
              {activities.map(activity => {
                const timeAgo = getTimeAgo(activity.createdAt)
                const typeIcon = activity.type === 'ACQUISITION' ? '🔨' :
                  activity.type === 'TRADE' ? '🔄' :
                  activity.type === 'RUBATA' ? '🎯' :
                  activity.type === 'RELEASE' ? '📤' : '📋'

                return (
                  <div key={activity.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-base flex-shrink-0">{typeIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="font-medium">{activity.playerName}</span>
                        {activity.toUser && (
                          <span className="text-gray-400"> → {activity.toUser}</span>
                        )}
                        {activity.price != null && (
                          <span className="text-accent-400 ml-1">{activity.price}M</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500">{activity.leagueName} · {timeAgo}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Search Leagues Modal */}
      <SearchLeaguesModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onNavigate={onNavigate}
      />
    </div>
  )
}
