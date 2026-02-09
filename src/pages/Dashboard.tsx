import { useState, useEffect } from 'react'
import { leagueApi, superadminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { SearchLeaguesModal } from '../components/SearchLeaguesModal'

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
  const [leagues, setLeagues] = useState<LeagueData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [cancellingLeagueId, setCancellingLeagueId] = useState<string | null>(null)

  async function handleCancelRequest(e: React.MouseEvent, leagueId: string) {
    e.stopPropagation()
    if (cancellingLeagueId) return

    if (!confirm('Sei sicuro di voler annullare la richiesta di partecipazione?')) return

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
      setLeagues(response.data as LeagueData[])
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="dashboard" onNavigate={onNavigate} />

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">Le mie Leghe</h2>
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
              <div key={i} className="bg-surface-200 rounded-xl p-4 space-y-3 border border-surface-50/20 animate-pulse">
                <div className="h-4 w-3/4 bg-surface-100 rounded" />
                <div className="h-4 w-1/2 bg-surface-100 rounded" />
                <div className="h-8 w-full bg-surface-100 rounded" />
              </div>
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-16 text-center">
            <div className="w-24 h-24 rounded-full bg-surface-300 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">{isSuperAdmin ? '🛡️' : '🏆'}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              {isSuperAdmin ? 'Nessuna lega da visualizzare' : 'Nessuna lega ancora'}
            </h3>
            <p className="text-lg text-gray-400 mb-8 max-w-md mx-auto">
              {isSuperAdmin
                ? 'Come superadmin, puoi gestire la piattaforma dal pannello di controllo. Non partecipi direttamente alle leghe.'
                : 'Non sei ancora membro di nessuna lega. Crea la tua prima lega e inizia a competere!'}
            </p>
            {isSuperAdmin ? (
              <Button size="xl" onClick={() => onNavigate('superadmin')}>
                Vai al Pannello di Controllo
              </Button>
            ) : (
              <Button size="xl" onClick={() => onNavigate('create-league')}>
                Crea la tua prima lega
              </Button>
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
                        <p className={`text-base font-bold ${isPending ? 'text-amber-400' : 'text-accent-400'}`}>
                          {isPending ? 'In attesa' : membership.currentBudget}
                        </p>
                      </div>
                    </div>

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
