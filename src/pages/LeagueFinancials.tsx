import { useState, useEffect } from 'react'
import { Navigation } from '../components/Navigation'
import { PullToRefresh } from '../components/PullToRefresh'
import { ShareButton } from '../components/ShareButton'
import { leagueApi } from '../services/api'
import { FinanceDashboard } from '../components/finance/FinanceDashboard'
import { TeamComparison } from '../components/finance/TeamComparison'
import { TeamFinanceDetail } from '../components/finance/TeamFinanceDetail'
import { FinanceTimeline } from '../components/finance/FinanceTimeline'
import type { FinancialsData } from '../components/finance/types'

// ============================================================================
// Navigation state for multi-level drill-down
// ============================================================================

type ViewLevel =
  | { level: 'panoramica' }
  | { level: 'squadre' }
  | { level: 'dettaglio'; memberId: string }
  | { level: 'movimenti'; memberId?: string }

// Tab definitions
const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'squadre', label: 'Squadre' },
  { key: 'movimenti', label: 'Movimenti' },
] as const

interface LeagueFinancialsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export default function LeagueFinancials({ leagueId, onNavigate }: LeagueFinancialsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancialsData | null>(null)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | undefined>(undefined)
  const [view, setView] = useState<ViewLevel>({ level: 'panoramica' })

  useEffect(() => {
    loadFinancials()
  }, [leagueId, selectedSession])

  async function loadFinancials() {
    if (!leagueId) return
    setLoading(true)
    setError(null)

    try {
      const result = await leagueApi.getFinancials(leagueId, selectedSession)
      if (result.success && result.data) {
        setData(result.data as FinancialsData)
        setIsLeagueAdmin(result.data.isAdmin || false)
      } else {
        setError(result.message || 'Errore nel caricamento dei dati finanziari')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  // Navigation handlers
  const handleTabClick = (tab: string) => {
    if (tab === 'panoramica') setView({ level: 'panoramica' })
    else if (tab === 'squadre') setView({ level: 'squadre' })
    else if (tab === 'movimenti') setView({ level: 'movimenti' })
  }

  const handleTeamClick = (memberId: string) => {
    setView({ level: 'dettaglio', memberId })
  }

  const handleBackToComparison = () => {
    setView({ level: 'squadre' })
  }

  const handleNavigateToTimeline = (memberId: string) => {
    setView({ level: 'movimenti', memberId })
  }

  const handleBackFromTimeline = () => {
    setView({ level: 'panoramica' })
  }

  const handleNavigateToPlayers = (teamName: string) => {
    onNavigate('allPlayers', { team: teamName })
  }

  // Get active tab key from current view
  const activeTab = view.level === 'dettaglio' ? 'squadre' : view.level

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation
          currentPage="financials"
          leagueId={leagueId}
          leagueName={data?.leagueName}
          isLeagueAdmin={isLeagueAdmin}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-surface-300 rounded w-1/3"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-surface-300 rounded-lg" />
              ))}
            </div>
            <div className="h-48 bg-surface-300 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation
          currentPage="financials"
          leagueId={leagueId}
          isLeagueAdmin={isLeagueAdmin}
          onNavigate={onNavigate}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-6 text-center">
            <p className="text-danger-400">{error}</p>
            <button
              onClick={loadFinancials}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-surface-200">
      <Navigation
        currentPage="financials"
        leagueId={leagueId}
        leagueName={data.leagueName}
        isLeagueAdmin={isLeagueAdmin}
        onNavigate={onNavigate}
      />

      <PullToRefresh onRefresh={loadFinancials}>
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 md:mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Finanze Lega</h1>
            <p className="text-gray-400 mt-1 text-sm md:text-base">
              {data.leagueName}
            </p>
          </div>
          <ShareButton title="Finanze Lega" text={`Finanze - ${data.leagueName}`} compact />
        </div>

        {/* Tab navigation + Session selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-surface-300/30 rounded-lg p-1 border border-surface-50/10">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Session selector */}
          {data.availableSessions && data.availableSessions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] md:text-xs text-gray-500">Fase:</span>
              <button
                onClick={() => setSelectedSession(undefined)}
                className={`px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium transition-colors ${
                  !selectedSession
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                Attuale
              </button>
              {data.availableSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session.id)}
                  className={`px-2 md:px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium transition-colors ${
                    selectedSession === session.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                  }`}
                >
                  {session.sessionType === 'PRIMO_MERCATO' ? 'PM' : 'MR'}
                  {session.currentPhase ? ` ${session.currentPhase}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* #193: CONTRATTI Phase Banner */}
        {data.inContrattiPhase && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-base">$</span>
              <div>
                <div className="font-medium text-amber-400 text-sm">Fase Contratti in Corso</div>
                <div className="text-xs text-amber-400/70">Confronto costi pre/post-rinnovo</div>
              </div>
            </div>
          </div>
        )}

        {/* OSS-6: Historical mode banner */}
        {data.isHistorical && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span>&#128197;</span>
              <span className="font-medium">
                Dati storici: {data.historicalSessionType === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                {data.historicalPhase ? ` - ${data.historicalPhase}` : ''}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Stai visualizzando uno snapshot dei dati finanziari. I dettagli giocatori non sono disponibili nella vista storica.
            </p>
          </div>
        )}

        {/* Level 1: Panoramica */}
        {view.level === 'panoramica' && (
          <FinanceDashboard data={data} />
        )}

        {/* Level 2: Confronto Squadre */}
        {view.level === 'squadre' && (
          <TeamComparison
            data={data}
            onTeamClick={handleTeamClick}
          />
        )}

        {/* Level 3: Dettaglio Squadra */}
        {view.level === 'dettaglio' && (() => {
          const team = data.teams.find(t => t.memberId === view.memberId)
          if (!team) {
            setView({ level: 'squadre' })
            return null
          }
          return (
            <TeamFinanceDetail
              team={team}
              data={data}
              onBack={handleBackToComparison}
              onNavigateToPlayers={handleNavigateToPlayers}
              onNavigateToTimeline={handleNavigateToTimeline}
            />
          )
        })()}

        {/* Level 4: Movimenti */}
        {view.level === 'movimenti' && (
          <FinanceTimeline
            leagueId={leagueId}
            data={data}
            initialMemberId={view.memberId}
            onBack={handleBackFromTimeline}
          />
        )}
      </div>
      </PullToRefresh>
    </div>
  )
}
