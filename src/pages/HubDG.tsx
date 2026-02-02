/**
 * HubDG - Hub Direttore Generale
 *
 * Dashboard riepilogativa con:
 * - KPIs della rosa (età media, rating, clausole, stipendi)
 * - Overview watchlist e obiettivi
 * - Budget summary
 * - Link rapido alla pagina Giocatori
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { rubataApi, leagueApi, gameApi } from '../services/api'
import { Navigation } from '../components/Navigation'
import { MarketPhaseBanner, type DisplayPhase } from '../components/MarketPhaseBanner'
import { PlayerTrendBadge, getFormQuality } from '../components/PlayerTrendBadge'
import { extractRatingsFromStats } from '../components/PlayerFormChart'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'
import type { PlayerStats } from '../components/PlayerStatsModal'

interface StrategyPlayer {
  rosterId: string
  memberId: string
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerQuotation: number
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  ownerUsername: string
  ownerTeamName: string | null
  ownerRubataOrder: number | null
  rubataPrice: number
  contractSalary: number
  contractDuration: number
  contractClause: number
  preference?: {
    id: string
    playerId: string
    memberId: string
    maxBid: number | null
    priority: number | null
    notes: string | null
    isWatchlist: boolean
    isAutoPass: boolean
  } | null
}

interface SvincolatoPlayer {
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  preference?: {
    id: string
    playerId: string
    memberId: string
    maxBid: number | null
    priority: number | null
    notes: string | null
    isWatchlist: boolean
    isAutoPass: boolean
  } | null
}

// KPI Card Component
function KPICard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  trend
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  trend?: 'up' | 'down' | 'stable'
}) {
  const colorClasses = {
    primary: 'from-primary-500/20 to-primary-600/10 border-primary-500/30 text-primary-400',
    secondary: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    success: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
    warning: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
    danger: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
  }

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-sm font-bold ${
            trend === 'up' ? 'text-emerald-400' :
            trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}

// Category Badge
function CategoryBadge({
  label,
  count,
  color
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${color}`}>
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">{count}</span>
    </div>
  )
}

// Position colors
const POS_COLORS: Record<string, string> = {
  P: 'bg-yellow-500',
  D: 'bg-green-500',
  C: 'bg-blue-500',
  A: 'bg-red-500',
}

// Objective Card
function ObjectiveCard({
  player,
  priority,
  maxBid,
  type
}: {
  player: { name: string; position: string; team: string; clause?: number; apiFootballId?: number | null }
  priority: number
  maxBid: number | null
  type: 'owned' | 'svincolato'
}) {
  const priorityColors = {
    1: 'border-l-emerald-500 bg-emerald-500/10',
    2: 'border-l-yellow-500 bg-yellow-500/10',
    3: 'border-l-orange-500 bg-orange-500/10',
  }

  const photoUrl = getPlayerPhotoUrl(player.apiFootballId)
  const teamLogoUrl = getTeamLogo(player.team)

  return (
    <div className={`border-l-4 ${priorityColors[priority as keyof typeof priorityColors] || 'border-l-gray-500 bg-gray-500/10'} rounded-r-lg p-3`}>
      <div className="flex items-center gap-3">
        {/* Player photo */}
        <div className="relative flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={player.name}
              className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <span
            className={`w-10 h-10 rounded-full text-xs font-bold text-white items-center justify-center ${POS_COLORS[player.position] || 'bg-gray-500'} ${photoUrl ? 'hidden' : 'flex'}`}
          >
            {player.position}
          </span>
          {/* Position badge */}
          {photoUrl && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${POS_COLORS[player.position] || 'bg-gray-500'} border border-surface-200`}>
              {player.position}
            </span>
          )}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white">{player.name}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            {teamLogoUrl && (
              <img
                src={teamLogoUrl}
                alt={player.team}
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            {player.team}
            {type === 'svincolato' && <span className="ml-1 text-emerald-400">(Svincolato)</span>}
          </div>
        </div>

        {/* Bid info */}
        <div className="text-right flex-shrink-0">
          {maxBid && <div className="text-lg font-bold text-primary-400">{maxBid}M</div>}
          {player.clause && <div className="text-xs text-gray-500">Clausola: {player.clause}M</div>}
        </div>
      </div>
    </div>
  )
}

export function HubDG({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [strategiesData, setStrategiesData] = useState<{ players: StrategyPlayer[]; myMemberId: string } | null>(null)
  const [svincolatiData, setSvincolatiData] = useState<{ players: SvincolatoPlayer[] } | null>(null)

  const [gameStatus, setGameStatus] = useState<{
    phase: DisplayPhase
    phaseLabel: string
    marketPhase: string | null
    nextClauseDay: string
    daysRemaining: number
    isActive: boolean
  } | null>(null)

  const [budgetData, setBudgetData] = useState<{
    budgetTotal: number
    budgetUsed: number
  } | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    if (!leagueId) return
    setLoading(true)

    try {
      const [ownedRes, svincolatiRes, gameStatusRes, financialsRes] = await Promise.all([
        rubataApi.getAllPlayersForStrategies(leagueId),
        rubataApi.getAllSvincolatiForStrategies(leagueId),
        gameApi.getStatus(leagueId),
        leagueApi.getFinancials(leagueId),
      ])

      if (gameStatusRes.success && gameStatusRes.data) {
        setGameStatus(gameStatusRes.data)
      }

      if (financialsRes.success && financialsRes.data) {
        const data = financialsRes.data as { teams: Array<{ budget: number; annualContractCost: number }> }
        const myTeam = data.teams?.[0]
        if (myTeam) {
          setBudgetData({
            budgetTotal: myTeam.budget || 100,
            budgetUsed: myTeam.annualContractCost || 0,
          })
        }
      }

      if (ownedRes.success && ownedRes.data) {
        setStrategiesData(ownedRes.data)
      }

      if (svincolatiRes.success && svincolatiRes.data) {
        setSvincolatiData(svincolatiRes.data)
      }
    } catch (err) {
      setError('Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Compute KPIs for my roster
  const rosterKPIs = useMemo(() => {
    if (!strategiesData) return null

    const myPlayers = strategiesData.players.filter(
      p => p.memberId === strategiesData.myMemberId
    )

    if (myPlayers.length === 0) return null

    // Age calculation
    const playersWithAge = myPlayers.filter(p => p.playerAge != null)
    const avgAge = playersWithAge.length > 0
      ? playersWithAge.reduce((sum, p) => sum + (p.playerAge || 0), 0) / playersWithAge.length
      : null

    // Rating calculation
    const playersWithRating = myPlayers.filter(p => p.playerApiFootballStats?.games?.rating != null)
    const avgRating = playersWithRating.length > 0
      ? playersWithRating.reduce((sum, p) => sum + (p.playerApiFootballStats?.games?.rating || 0), 0) / playersWithRating.length
      : null

    // Clause calculation
    const avgClause = myPlayers.reduce((sum, p) => sum + p.contractClause, 0) / myPlayers.length

    // Total salaries
    const totalSalaries = myPlayers.reduce((sum, p) => sum + p.contractSalary, 0)

    // Position breakdown
    const positions = { P: 0, D: 0, C: 0, A: 0 }
    myPlayers.forEach(p => {
      if (positions[p.playerPosition as keyof typeof positions] !== undefined) {
        positions[p.playerPosition as keyof typeof positions]++
      }
    })

    return {
      count: myPlayers.length,
      avgAge: avgAge ? avgAge.toFixed(1) : '-',
      avgRating: avgRating ? avgRating.toFixed(2) : '-',
      avgClause: avgClause.toFixed(1),
      totalSalaries,
      positions,
    }
  }, [strategiesData])

  // Compute objectives and categories
  const objectives = useMemo(() => {
    const allObjectives: Array<{
      player: { name: string; position: string; team: string; clause?: number; apiFootballId?: number | null }
      priority: number
      maxBid: number | null
      type: 'owned' | 'svincolato'
    }> = []

    // From owned players (not mine)
    strategiesData?.players
      .filter(p => p.memberId !== strategiesData.myMemberId && p.preference?.maxBid)
      .forEach(p => {
        allObjectives.push({
          player: {
            name: p.playerName,
            position: p.playerPosition,
            team: p.playerTeam,
            clause: p.contractClause,
            apiFootballId: p.playerApiFootballId,
          },
          priority: p.preference?.priority || 99,
          maxBid: p.preference?.maxBid || null,
          type: 'owned',
        })
      })

    // From svincolati
    svincolatiData?.players
      .filter(p => p.preference?.maxBid)
      .forEach(p => {
        allObjectives.push({
          player: {
            name: p.playerName,
            position: p.playerPosition,
            team: p.playerTeam,
            apiFootballId: p.playerApiFootballId,
          },
          priority: p.preference?.priority || 99,
          maxBid: p.preference?.maxBid || null,
          type: 'svincolato',
        })
      })

    // Sort by priority
    return allObjectives.sort((a, b) => a.priority - b.priority)
  }, [strategiesData, svincolatiData])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      watchlist: 0,
      autoPass: 0,
      withStrategy: 0,
      topTargets: 0,
    }

    strategiesData?.players
      .filter(p => p.memberId !== strategiesData.myMemberId)
      .forEach(p => {
        if (p.preference?.isWatchlist) counts.watchlist++
        if (p.preference?.isAutoPass) counts.autoPass++
        if (p.preference?.maxBid || p.preference?.priority) counts.withStrategy++
        if (p.preference?.priority === 1) counts.topTargets++
      })

    svincolatiData?.players.forEach(p => {
      if (p.preference?.isWatchlist) counts.watchlist++
      if (p.preference?.isAutoPass) counts.autoPass++
      if (p.preference?.maxBid || p.preference?.priority) counts.withStrategy++
      if (p.preference?.priority === 1) counts.topTargets++
    })

    return counts
  }, [strategiesData, svincolatiData])

  // Budget calculations
  const budgetSummary = useMemo(() => {
    const total = budgetData?.budgetTotal || 100
    const used = budgetData?.budgetUsed || 0
    const available = total - used

    // Sum of all maxBids set
    let committed = 0
    strategiesData?.players
      .filter(p => p.memberId !== strategiesData.myMemberId)
      .forEach(p => {
        if (p.preference?.maxBid) committed += p.preference.maxBid
      })
    svincolatiData?.players.forEach(p => {
      if (p.preference?.maxBid) committed += p.preference.maxBid
    })

    const remaining = available - committed

    return { total, used, available, committed, remaining }
  }, [budgetData, strategiesData, svincolatiData])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-200">
        <Navigation currentPage="hub-dg" onNavigate={onNavigate} />
        <div className="p-6 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-200">
      <Navigation currentPage="hub-dg" onNavigate={onNavigate} />

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Phase Banner */}
        {gameStatus && (
          <MarketPhaseBanner
            phase={gameStatus.phase}
            phaseLabel={gameStatus.phaseLabel}
            nextClauseDay={gameStatus.nextClauseDay}
            daysRemaining={gameStatus.daysRemaining}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              Hub Direttore Generale
            </h1>
            <p className="text-gray-400 mt-1">
              Panoramica strategica della tua squadra e obiettivi di mercato
            </p>
          </div>
          <Link
            to={`/leagues/${leagueId}/strategie-rubata`}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>📋</span>
            Vai a Giocatori
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: KPIs */}
          <div className="lg:col-span-2 space-y-6">
            {/* KPI Cards */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📊</span> La Mia Rosa
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  icon="👥"
                  title="Giocatori"
                  value={rosterKPIs?.count || 0}
                  subtitle={rosterKPIs ? `P:${rosterKPIs.positions.P} D:${rosterKPIs.positions.D} C:${rosterKPIs.positions.C} A:${rosterKPIs.positions.A}` : undefined}
                  color="primary"
                />
                <KPICard
                  icon="🎂"
                  title="Età Media"
                  value={rosterKPIs?.avgAge || '-'}
                  color={
                    rosterKPIs?.avgAge && parseFloat(rosterKPIs.avgAge) < 26 ? 'success' :
                    rosterKPIs?.avgAge && parseFloat(rosterKPIs.avgAge) > 30 ? 'danger' : 'warning'
                  }
                />
                <KPICard
                  icon="⭐"
                  title="Rating Medio"
                  value={rosterKPIs?.avgRating || '-'}
                  color={
                    rosterKPIs?.avgRating && parseFloat(rosterKPIs.avgRating) >= 7 ? 'success' :
                    rosterKPIs?.avgRating && parseFloat(rosterKPIs.avgRating) < 6 ? 'danger' : 'warning'
                  }
                />
                <KPICard
                  icon="💰"
                  title="Clausola Media"
                  value={`${rosterKPIs?.avgClause || '-'}M`}
                  color="secondary"
                />
                <KPICard
                  icon="💸"
                  title="Stipendi Totali"
                  value={`${rosterKPIs?.totalSalaries || 0}M`}
                  color="warning"
                />
              </div>
            </div>

            {/* Budget Summary */}
            <div className="bg-surface-300/50 rounded-xl border border-surface-50/20 p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>💼</span> Budget Mercato
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-surface-200/50 rounded-lg">
                  <div className="text-2xl font-bold text-white">{budgetSummary.total}M</div>
                  <div className="text-xs text-gray-400">Budget Totale</div>
                </div>
                <div className="text-center p-3 bg-surface-200/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-400">-{budgetSummary.used}M</div>
                  <div className="text-xs text-gray-400">Impegnato</div>
                </div>
                <div className="text-center p-3 bg-surface-200/50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{budgetSummary.available}M</div>
                  <div className="text-xs text-gray-400">Disponibile</div>
                </div>
                <div className="text-center p-3 bg-surface-200/50 rounded-lg">
                  <div className={`text-2xl font-bold ${budgetSummary.remaining >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                    {budgetSummary.remaining}M
                  </div>
                  <div className="text-xs text-gray-400">
                    Residuo ({budgetSummary.committed}M offerte)
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all"
                    style={{ width: `${Math.min(100, (budgetSummary.committed / budgetSummary.available) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{Math.round((budgetSummary.committed / budgetSummary.available) * 100)}% allocato</span>
                  <span>{budgetSummary.remaining}M rimanenti</span>
                </div>
              </div>
            </div>

            {/* Top Objectives */}
            <div className="bg-surface-300/50 rounded-xl border border-surface-50/20 p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🎯</span> I Tuoi Obiettivi Principali
              </h2>
              {objectives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p>Nessun obiettivo impostato</p>
                  <Link
                    to={`/leagues/${leagueId}/strategie-rubata`}
                    className="inline-block mt-3 text-primary-400 hover:text-primary-300"
                  >
                    Vai a Giocatori per impostare le tue strategie →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {objectives.slice(0, 5).map((obj, idx) => (
                    <ObjectiveCard
                      key={idx}
                      player={obj.player}
                      priority={obj.priority}
                      maxBid={obj.maxBid}
                      type={obj.type}
                    />
                  ))}
                  {objectives.length > 5 && (
                    <Link
                      to={`/leagues/${leagueId}/strategie-rubata`}
                      className="block text-center text-sm text-primary-400 hover:text-primary-300 py-2"
                    >
                      +{objectives.length - 5} altri obiettivi →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Categories & Quick Stats */}
          <div className="space-y-6">
            {/* Categories Overview */}
            <div className="bg-surface-300/50 rounded-xl border border-surface-50/20 p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📁</span> Categorie
              </h2>
              <div className="space-y-2">
                <CategoryBadge
                  label="Top Target"
                  count={categoryCounts.topTargets}
                  color="bg-emerald-500/30"
                />
                <CategoryBadge
                  label="Watchlist"
                  count={categoryCounts.watchlist}
                  color="bg-yellow-500/30"
                />
                <CategoryBadge
                  label="Con Strategia"
                  count={categoryCounts.withStrategy}
                  color="bg-blue-500/30"
                />
                <CategoryBadge
                  label="Auto-Pass"
                  count={categoryCounts.autoPass}
                  color="bg-gray-500/30"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-surface-300/50 rounded-xl border border-surface-50/20 p-4">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span> Azioni Rapide
              </h2>
              <div className="space-y-2">
                <Link
                  to={`/leagues/${leagueId}/strategie-rubata`}
                  className="flex items-center justify-between p-3 bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 rounded-lg transition-colors"
                >
                  <span className="text-white font-medium">📋 Gestisci Strategie</span>
                  <span className="text-primary-400">→</span>
                </Link>
                <Link
                  to={`/leagues/${leagueId}/finanze`}
                  className="flex items-center justify-between p-3 bg-surface-200/50 hover:bg-surface-200/70 border border-surface-50/20 rounded-lg transition-colors"
                >
                  <span className="text-white font-medium">💰 Finanze Lega</span>
                  <span className="text-gray-400">→</span>
                </Link>
                <Link
                  to={`/leagues/${leagueId}/storico`}
                  className="flex items-center justify-between p-3 bg-surface-200/50 hover:bg-surface-200/70 border border-surface-50/20 rounded-lg transition-colors"
                >
                  <span className="text-white font-medium">📜 Storico Mercato</span>
                  <span className="text-gray-400">→</span>
                </Link>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 rounded-xl border border-primary-500/20 p-4">
              <h3 className="font-semibold text-white mb-2">💡 Suggerimento</h3>
              <p className="text-sm text-gray-400">
                Imposta le tue strategie prima del Clause Day!
                Definisci priorità e offerte massime per ogni obiettivo
                nella pagina Giocatori.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HubDG
