import { useState, useEffect } from 'react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { leagueApi, superadminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'
import { SearchLeaguesModal } from '../components/SearchLeaguesModal'
import { SkeletonPlayerRow } from '../components/ui/Skeleton'
import { LeagueCrest } from '../components/ui/LeagueCrest'
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
  isPublic: boolean
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

// Chips secondarie del tabellone (stati "a riposo" / non interattivi)
const CHIP_REST = 'bg-secondary-500/15 text-secondary-400 border border-secondary-500/30'
const CHIP_GRAY = 'bg-surface-50/20 text-gray-400 border border-surface-50/30'

// ---- Riga del tabellone "stile classifica" ----
interface LeagueRow {
  ld: LeagueData
  rank: number
  live: boolean
  dim: boolean
  order: number
  phase: string
  phaseActive: boolean
  chip: { label: string; cls: string } | null
  budget: string | null
  cta: { label: string; go: () => void } | null
  nav: () => void
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

  async function cancelRequest(leagueId: string) {
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
      } else {
        setError('Errore nel caricamento delle leghe.')
      }
    } catch {
      setError('Errore di connessione.')
    }
    setIsLoading(false)
  }

  // Carica i dati al mount (dichiarato dopo loadData/loadLeagues per evitare use-before-declared)
  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leghe ACTIVE con azioni pendenti (riuso la logica di attention.tsx, senza duplicarla)
  const actionMap = new Map<string, DashAction[]>()
  for (const ld of leagues) {
    if (ld.membership.status === 'ACTIVE') {
      const actions = buildActions(ld.league.id, summaries[ld.league.id], onNavigate)
      if (actions.length > 0) actionMap.set(ld.league.id, actions)
    }
  }

  // Costruzione righe tabellone
  const rows: LeagueRow[] = leagues.map(ld => {
    const { league, membership } = ld
    const isPending = membership.status === 'PENDING'
    const isAdmin = membership.role === 'ADMIN'
    const isActive = league.status === 'ACTIVE'
    const primary = actionMap.get(league.id)?.[0]

    let order: number
    let phase = ''
    let phaseActive = false
    let chip: LeagueRow['chip'] = null
    let budget: string | null = null
    let cta: LeagueRow['cta'] = null
    let nav: () => void = () => { onNavigate('leagueDetail', { leagueId: league.id }) }

    if (isPending) {
      order = 3
      phase = 'In attesa di approvazione'
      chip = { label: 'In attesa', cls: CHIP_GRAY }
      nav = () => { void cancelRequest(league.id) }
    } else if (isActive) {
      order = primary ? 0 : 1
      phase = phaseLabel(summaries[league.id]) ?? '—'
      phaseActive = true
      budget = `${membership.currentBudget}M`
      if (primary) {
        chip = { label: primary.chip, cls: TONE_CHIP[primary.tone] }
        cta = { label: primary.ctaLabel, go: primary.go }
        nav = primary.go
      } else {
        chip = { label: 'A riposo', cls: CHIP_REST }
      }
    } else if (league.status === 'DRAFT') {
      order = 2
      phase = 'In preparazione'
      if (isAdmin) {
        chip = { label: 'Pannello Admin', cls: TONE_CHIP.admin }
        nav = () => { onNavigate('adminPanel', { leagueId: league.id }) }
      }
    } else {
      order = 4
      phase = 'Stagione conclusa'
      chip = { label: 'Storico', cls: CHIP_GRAY }
      nav = () => { onNavigate('history', { leagueId: league.id }) }
    }

    return {
      ld,
      rank: 0,
      live: order === 0,
      dim: order >= 2,
      order,
      phase,
      phaseActive,
      chip,
      budget,
      cta,
      nav,
    }
  })

  rows.sort((a, b) => a.order - b.order || a.ld.league.name.localeCompare(b.ld.league.name, 'it'))
  rows.forEach((row, i) => { row.rank = i + 1 })

  const nInGioco = leagues.filter(l => l.league.status === 'ACTIVE').length
  const nAttention = actionMap.size

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
                : nAttention > 0
                  ? <>{nInGioco} {nInGioco === 1 ? 'lega' : 'leghe'} in gioco · <b className="text-danger-400">{nAttention}</b> con la tua attenzione</>
                  : nInGioco > 0
                    ? <>{nInGioco} {nInGioco === 1 ? 'lega' : 'leghe'} in gioco</>
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
          <div className="bg-surface-200 border border-surface-50/20 rounded-2xl divide-y divide-surface-50/10">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonPlayerRow key={i} />
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
            {/* ===== Tabellone desktop (md+) ===== */}
            <div className="hidden md:block bg-surface-200 border border-surface-50/20 rounded-2xl overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[34%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-20" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-surface-50/30 bg-surface-300">
                    <th className="text-left pl-4 pr-2 py-3 micro-label">#</th>
                    <th className="text-left px-3 py-3 micro-label">Lega</th>
                    <th className="text-left px-3 py-3 micro-label">Fase</th>
                    <th className="text-left px-3 py-3 micro-label">Azioni</th>
                    <th className="text-right px-3 py-3 micro-label">Budget</th>
                    <th className="text-right pr-4 pl-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const { league, membership } = row.ld
                    return (
                      <tr
                        key={league.id}
                        onClick={row.nav}
                        className={`group cursor-pointer transition-colors hover:bg-surface-100 ${row.dim ? 'opacity-60 hover:opacity-100' : ''}`}
                      >
                        <td className="py-3 pl-4 pr-2 align-middle">
                          <span className="flex items-center gap-2">
                            {row.live && <span className="dot-live bg-danger-500 animate-pulse" />}
                            <span className={`font-sport text-lg font-semibold tabular-nums ${row.live ? 'text-accent-400' : 'text-gray-500'}`}>
                              {row.rank}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-3 align-middle overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
                            <LeagueCrest name={league.name} imageUrl={league.imageUrl} size="sm" />
                            <div className="min-w-0">
                              <p className="font-display font-bold leading-tight truncate text-white">{league.name}</p>
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                                <RoleTag role={membership.role} />
                                {league.members.length}{league.maxParticipants ? `/${league.maxParticipants}` : ''} manager
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 align-middle overflow-hidden">
                          <span className="inline-flex items-center gap-2 text-xs text-gray-300 whitespace-nowrap">
                            <span className={`w-1.5 h-1.5 rounded-full ${row.phaseActive ? 'bg-secondary-400 shadow-[0_0_0_3px_rgba(34,197,94,0.14)]' : 'bg-surface-50'}`} />
                            {row.phase}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-middle overflow-hidden">
                          {row.chip && (
                            <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${row.chip.cls}`}>
                              {row.chip.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-middle text-right">
                          {row.budget
                            ? <span className="font-mono font-bold text-accent-400">{row.budget}</span>
                            : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="py-3 pr-4 pl-2 align-middle text-right">
                          {row.cta ? (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full text-xs truncate"
                              onClick={(e) => { e.stopPropagation(); row.cta?.go() }}
                            >
                              {row.cta.label}
                            </Button>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-300 border border-surface-50/30 text-gray-400 group-hover:text-primary-400 group-hover:border-primary-500/40 transition-colors text-sm">
                              →
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== Tabellone mobile (3 zone, niente troncamenti) ===== */}
            <div className="md:hidden bg-surface-200 border border-surface-50/20 rounded-2xl divide-y divide-surface-50/10">
              {rows.map(row => {
                const { league, membership } = row.ld
                return (
                  <div
                    key={league.id}
                    onClick={row.nav}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-surface-100 transition-colors"
                  >
                    {/* Zona sinistra: Crest + Nome */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <LeagueCrest name={league.name} imageUrl={league.imageUrl} size="sm" />
                      <div className="min-w-0">
                        <p className={`font-display font-bold leading-tight ${row.dim ? 'text-gray-300' : 'text-white'}`}>
                          {league.name}
                        </p>
                      </div>
                    </div>
                    {/* Zona centrale: Fase + Ruolo */}
                    <div className="flex-shrink-0 max-w-[35%]">
                      {row.live && row.chip ? (
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${row.chip.cls}`}>
                          {row.chip.label}
                        </span>
                      ) : (
                        <p className="text-[11px] text-gray-400 leading-tight">
                          {row.phase}
                          {league.status === 'ACTIVE' && <>{' '}<span className="text-gray-500">{membership.role === 'ADMIN' ? 'Presidente' : 'DG'}</span></>}
                        </p>
                      )}
                    </div>
                    {/* Zona destra: Budget + Arrow */}
                    <div className="w-16 flex-shrink-0 text-right">
                      {row.budget
                        ? <span className="font-mono font-bold text-accent-400">{row.budget}</span>
                        : <span className="text-gray-500">→</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
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
