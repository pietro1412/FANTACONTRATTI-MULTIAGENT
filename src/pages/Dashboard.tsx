import { useState, useEffect } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { leagueApi, superadminApi, movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { SearchLeaguesModal } from '../components/SearchLeaguesModal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { LeagueCrest, getLeagueIdentity } from '../components/ui/LeagueCrest'
import {
  buildActions,
  phaseLabel,
  RoleTag,
  TONE_CHIP,
  type DashAction,
  type LeagueSummary,
} from '../components/league/attention'

interface DashboardProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  status: string
  imageUrl?: string | null
  maxParticipants?: number
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

// ---- Attention card (rotaia "Richiede la tua attenzione") ----
function AttentionCard({
  ld,
  summary,
  actions,
}: {
  ld: LeagueData
  summary?: LeagueSummary
  actions: DashAction[]
}) {
  const { league, membership } = ld
  const identity = getLeagueIdentity(league.name)
  const primary = actions[0]
  const ph = phaseLabel(summary)
  const phaseText = ph ?? (league.status === 'DRAFT' ? 'In preparazione · in attesa di avvio' : '—')
  const isUrgent = primary?.tone === 'urgent'

  return (
    <div
      className={`relative bg-surface-200 rounded-2xl border p-4 overflow-hidden flex flex-col shadow-lg ${
        isUrgent ? 'border-danger-500/60 ring-1 ring-danger-500/40' : 'border-surface-50/30'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${identity.gradient}`} aria-hidden="true" />

      <div className="flex items-center gap-3 mb-3">
        <LeagueCrest name={league.name} imageUrl={league.imageUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white leading-tight truncate">{league.name}</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
            <RoleTag role={membership.role} />
            {league.members.length}{league.maxParticipants ? `/${league.maxParticipants}` : ''} manager
          </span>
        </div>
        {primary && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${TONE_CHIP[primary.tone]}`}>
            {primary.chip}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span aria-hidden="true">📍</span>
        <span className="font-medium text-gray-200">{phaseText}</span>
      </div>

      {primary && (
        <div className="bg-surface-300 border border-surface-50/20 rounded-xl p-3 flex items-start gap-2.5 mb-3">
          <span className="text-lg leading-none flex-shrink-0" aria-hidden="true">{primary.emoji}</span>
          <span className="text-[13px] font-semibold text-white leading-snug">
            {primary.text}
            {actions.length > 1 && (
              <span className="block text-[11px] font-normal text-gray-400 mt-0.5">
                e altre {actions.length - 1} azioni in sospeso
              </span>
            )}
            {primary.sub && actions.length === 1 && (
              <span className="block text-[11px] font-normal text-gray-500 mt-0.5">{primary.sub}</span>
            )}
          </span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-3">
        {league.status === 'ACTIVE' && (
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Budget</p>
            <p className="text-base font-bold font-mono text-accent-400 leading-tight">{membership.currentBudget}M</p>
          </div>
        )}
        {primary && (
          <Button
            variant={primary.ctaVariant}
            size="sm"
            className={league.status === 'ACTIVE' ? '' : 'flex-1'}
            onClick={() => { primary.go() }}
          >
            {primary.ctaLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

// ---- Calm card (griglia "Tutte le mie leghe") ----
function LeagueCard({
  ld,
  summary,
  onNavigate,
  onCancel,
  cancelling,
}: {
  ld: LeagueData
  summary?: LeagueSummary
  onNavigate: DashboardProps['onNavigate']
  onCancel: (e: React.MouseEvent, leagueId: string) => void
  cancelling: boolean
}) {
  const { league, membership } = ld
  const isPending = membership.status === 'PENDING'
  const isAdmin = membership.role === 'ADMIN'
  const ph = phaseLabel(summary)

  const stateBadge = isPending ? (
    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">⏳ In attesa</span>
  ) : league.status === 'ACTIVE' ? (
    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-secondary-500/15 text-secondary-400 border border-secondary-500/30">● Attiva</span>
  ) : league.status === 'DRAFT' ? (
    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30">◌ In preparazione</span>
  ) : (
    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-surface-50/20 text-gray-400 border border-surface-50/30">✓ Completata</span>
  )

  const clickable = !isPending && league.status !== 'COMPLETED'

  return (
    <div
      className={`bg-surface-200 rounded-2xl border p-4 flex flex-col transition-all ${
        isPending ? 'border-amber-500/30' : 'border-surface-50/20'
      } ${league.status === 'COMPLETED' ? 'opacity-75' : ''} ${
        clickable ? 'hover:border-primary-500/40 hover:shadow-glow cursor-pointer group' : ''
      }`}
      onClick={() => { if (clickable) onNavigate('leagueDetail', { leagueId: league.id }) }}
    >
      <div className="flex items-center gap-3 mb-3">
        <LeagueCrest name={league.name} imageUrl={league.imageUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <p className={`font-bold leading-tight truncate ${isPending ? 'text-amber-200' : 'text-white group-hover:text-primary-400 transition-colors'}`}>
            {league.name}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
            <RoleTag role={membership.role} />
            {league.members.length}{league.maxParticipants ? `/${league.maxParticipants}` : ''}
          </span>
        </div>
        {stateBadge}
      </div>

      {/* Body coerente con lo stato */}
      {isPending ? (
        <div className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
          Richiesta di adesione in attesa di approvazione
        </div>
      ) : league.status === 'ACTIVE' ? (
        <>
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-gray-500">Fase</span>
            <span className="font-medium text-gray-200">{ph ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-gray-500">Budget</span>
            <span className="font-mono font-bold text-accent-400">{membership.currentBudget}M</span>
          </div>
        </>
      ) : league.status === 'DRAFT' ? (
        <>
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-gray-500">Membri</span>
            <span className="font-mono font-medium text-gray-200">
              {league.members.length}{league.maxParticipants ? ` / ${league.maxParticipants}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-gray-500">Stato</span>
            <span className="font-medium text-gray-200">In attesa di avvio</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-400 bg-surface-300 border border-surface-50/20 rounded-lg px-3 py-2 mb-3">
          Stagione conclusa
        </div>
      )}

      {/* Footer azioni coerenti con lo stato */}
      <div className="mt-auto flex gap-2" onClick={(e) => { e.stopPropagation() }}>
        {isPending ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            onClick={(e) => { onCancel(e, league.id) }}
            disabled={cancelling}
          >
            {cancelling ? 'Annullando...' : '✕ Annulla Richiesta'}
          </Button>
        ) : league.status === 'COMPLETED' ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => { onNavigate('history', { leagueId: league.id }) }}>
            📊 Storico
          </Button>
        ) : league.status === 'DRAFT' && isAdmin ? (
          <>
            <Button variant="accent" size="sm" className="flex-1" onClick={() => { onNavigate('adminPanel', { leagueId: league.id }) }}>
              Pannello Admin
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { onNavigate('adminPanel', { leagueId: league.id, tab: 'members' }) }}>
              Invita
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => { onNavigate('leagueDetail', { leagueId: league.id }) }}>
            Entra nella Lega →
          </Button>
        )}
      </div>
    </div>
  )
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const [leagues, setLeagues] = useState<LeagueData[]>([])
  const [summaries, setSummaries] = useState<Record<string, LeagueSummary>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [cancellingLeagueId, setCancellingLeagueId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    void loadData()
  }, [])

  async function loadData() {
    setError(null)
    setIsLoading(true)
    try {
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
    } catch {
      setError('Errore nel caricamento dei dati. Verifica la connessione.')
      setIsLoading(false)
    }
  }

  async function loadLeagues() {
    try {
      // Leagues + per-league attention signals in parallel (summary failure is non-blocking)
      const [response, summaryRes] = await Promise.all([
        leagueApi.getAll(),
        leagueApi.getDashboardSummary(),
      ])

      if (summaryRes.success && summaryRes.data) {
        const data = summaryRes.data as { summaries?: Record<string, LeagueSummary> }
        setSummaries(data.summaries || {})
      }

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
      } else {
        setError('Errore nel caricamento delle leghe.')
      }
    } catch {
      setError('Errore di connessione.')
    }
    setIsLoading(false)
  }

  // Derive attention leagues (membership ACTIVE with at least one pending action) vs the calm full list
  const attention = leagues
    .filter(ld => ld.membership.status === 'ACTIVE')
    .map(ld => ({ ld, actions: buildActions(ld.league.id, summaries[ld.league.id], onNavigate) }))
    .filter(item => item.actions.length > 0)

  const CALM_RANK: Record<string, number> = { ACTIVE: 0, DRAFT: 1, COMPLETED: 3 }
  const calm = [...leagues].sort((a, b) => {
    const ra = a.membership.status === 'PENDING' ? 2 : (CALM_RANK[a.league.status] ?? 4)
    const rb = b.membership.status === 'PENDING' ? 2 : (CALM_RANK[b.league.status] ?? 4)
    return ra - rb
  })

  return (
    <div className="min-h-screen">
      <Navigation currentPage="dashboard" onNavigate={onNavigate} />

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">Le mie Leghe</h2>
            <p className="text-gray-400">
              {isSuperAdmin
                ? 'Sei un superadmin - usa il pannello di controllo per gestire la piattaforma'
                : attention.length > 0
                  ? <>Hai <b className="text-danger-400">{attention.length} {attention.length === 1 ? 'lega che richiede' : 'leghe che richiedono'} la tua attenzione</b> · {leagues.length} totali</>
                  : 'Gestisci le tue leghe fantasy'}
            </p>
          </div>
          {!isSuperAdmin && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" onClick={() => { setShowSearchModal(true); }}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Cerca Leghe
              </Button>
              <Button size="lg" onClick={() => { onNavigate('create-league'); }}>
                <span className="mr-2">+</span> Crea Nuova Lega
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-6 text-center mb-6">
            <p className="text-danger-400">{error}</p>
            <button
              onClick={() => { setError(null); void loadData(); }}
              className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg transition-colors min-h-[44px]"
            >
              Riprova
            </button>
          </div>
        )}

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
              <Button size="xl" onClick={() => { onNavigate('superadmin'); }}>
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
                  <Button size="xl" onClick={() => { onNavigate('create-league'); }}>
                    <span className="mr-2">+</span> Crea la tua prima lega
                  </Button>
                  <Button size="xl" variant="outline" onClick={() => { setShowSearchModal(true); }}>
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
          <>
            {/* ===== Richiede la tua attenzione ===== */}
            {attention.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-7 h-7 rounded-lg bg-danger-500/15 text-danger-400 border border-danger-500/30 flex items-center justify-center">⚡</span>
                  <h3 className="text-lg font-bold text-white">Richiede la tua attenzione</h3>
                  <span className="ml-auto text-xs font-mono text-gray-400 bg-surface-200 border border-surface-50/20 rounded-full px-3 py-1">
                    {attention.length} {attention.length === 1 ? 'lega' : 'leghe'}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attention.map(({ ld, actions }) => (
                    <AttentionCard key={ld.league.id} ld={ld} summary={summaries[ld.league.id]} actions={actions} />
                  ))}
                </div>
              </section>
            )}

            {/* ===== Tutte le mie leghe ===== */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-lg bg-surface-300 text-gray-400 border border-surface-50/20 flex items-center justify-center">📚</span>
                <h3 className="text-lg font-bold text-white">Tutte le mie leghe</h3>
                <span className="ml-auto text-xs font-mono text-gray-400 bg-surface-200 border border-surface-50/20 rounded-full px-3 py-1">
                  {leagues.length} {leagues.length === 1 ? 'lega' : 'leghe'}
                </span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calm.map(ld => (
                  <LeagueCard
                    key={ld.league.id}
                    ld={ld}
                    summary={summaries[ld.league.id]}
                    onNavigate={onNavigate}
                    onCancel={(e, id) => { void handleCancelRequest(e, id) }}
                    cancelling={cancellingLeagueId === ld.league.id}
                  />
                ))}
              </div>
            </section>
          </>
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
        onClose={() => { setShowSearchModal(false); }}
        onNavigate={onNavigate}
      />
    </div>
  )
}
