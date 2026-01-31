/**
 * WatchlistOverview - Dashboard overview tab for the Strategie page
 *
 * Features:
 * - Category cards with player counts (5 columns desktop, 2 mobile)
 * - Top priorities section (players with 4+ stars)
 * - Alerts/notifications placeholder
 */

import { useMemo, useState, useEffect } from 'react'
import type { WatchlistCategory, WatchlistEntry, NewsArticle } from '../services/api'
import { newsApi } from '../services/api'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from './ui/PositionBadge'
import { PlayerFormBadge, getFormRating, calculateFormTrend } from './PlayerFormBadge'
import { ROSTER_MANAGEMENT_TAGS } from './PlayerStrategyPanel'
import type { PlayerStats } from './PlayerStatsModal'

// Player type that matches DisplayPlayer from StrategieRubata
interface OverviewPlayer {
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string
  playerAge?: number | null
  playerApiFootballId?: number | null
  playerApiFootballStats?: PlayerStats | null
  type: 'myRoster' | 'owned' | 'svincolato'
  // Only for owned/myRoster
  ownerUsername?: string
  ownerTeamName?: string | null
  rubataPrice?: number
  contractSalary?: number
  contractDuration?: number
  contractClause?: number
  playerQuotation?: number
}

// Local strategy state
interface LocalStrategy {
  maxBid: string
  priority: number
  notes: string
  isDirty: boolean
}

interface WatchlistOverviewProps {
  categories: WatchlistCategory[]
  entries: WatchlistEntry[]
  players: OverviewPlayer[]
  localStrategies: Record<string, LocalStrategy>
  onCategoryClick: (categoryId: string) => void
  onPlayerClick: (player: OverviewPlayer) => void
  onOpenStrategy?: (player: OverviewPlayer) => void
  currentBudget?: number
  totalTargetBids?: number
}

// Category color mapping
const CATEGORY_COLORS = {
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', hoverBg: 'hover:bg-red-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/20' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/20' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', hoverBg: 'hover:bg-green-500/20' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/20' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', hoverBg: 'hover:bg-pink-500/20' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/20' },
} as const

type CategoryColorKey = keyof typeof CATEGORY_COLORS
type CategoryColorValue = typeof CATEGORY_COLORS[CategoryColorKey]

function getCategoryColors(color: string | null | undefined): CategoryColorValue {
  if (!color) return CATEGORY_COLORS.blue
  if (color in CATEGORY_COLORS) {
    return CATEGORY_COLORS[color as CategoryColorKey]
  }
  return CATEGORY_COLORS.blue
}

export function WatchlistOverview({
  categories,
  entries,
  players,
  localStrategies,
  onCategoryClick,
  onPlayerClick,
  onOpenStrategy,
  currentBudget = 0,
  totalTargetBids = 0,
}: WatchlistOverviewProps) {
  // Count players per category
  const categoryPlayerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach(cat => {
      counts[cat.id] = entries.filter(e => e.categoryId === cat.id).length
    })
    return counts
  }, [categories, entries])

  // Helper to get player's category
  const getPlayerCategory = (playerId: string): WatchlistCategory | null => {
    const entry = entries.find(e => e.playerId === playerId)
    if (!entry) return null
    return categories.find(c => c.id === entry.categoryId) || null
  }

  // Get top priority players (4+ stars) - max 5
  const topPriorityPlayers = useMemo(() => {
    return players
      .filter(p => {
        const strat = localStrategies[p.playerId]
        return strat && strat.priority >= 4
      })
      .sort((a, b) => {
        const stratA = localStrategies[a.playerId]
        const stratB = localStrategies[b.playerId]
        return (stratB?.priority || 0) - (stratA?.priority || 0)
      })
      .slice(0, 5)
  }, [players, localStrategies])

  // Get total watchlist players count (players in any category)
  const totalWatchlistCount = useMemo(() => {
    const playerIdsInCategories = new Set(entries.map(e => e.playerId))
    return playerIdsInCategories.size
  }, [entries])

  // Calculate strategy progress for gamification
  const strategyStats = useMemo(() => {
    const totalPlayers = players.length
    const playersWithCategory = entries.length
    const playersWithPriority = Object.values(localStrategies).filter(s => s.priority > 0).length
    const playersWithMaxBid = Object.values(localStrategies).filter(s => s.maxBid).length
    const playersWithNotes = Object.values(localStrategies).filter(s => s.notes).length

    return {
      totalPlayers,
      playersWithCategory,
      playersWithPriority,
      playersWithMaxBid,
      playersWithNotes,
      categoryPercent: Math.round((playersWithCategory / Math.max(1, totalPlayers)) * 100),
      priorityPercent: Math.round((playersWithPriority / Math.max(1, totalPlayers)) * 100),
    }
  }, [players.length, entries.length, localStrategies])

  // Smart Ranking - players sorted by "value" score
  const smartRanking = useMemo(() => {
    return players
      .filter(p => {
        const strat = localStrategies[p.playerId]
        // Only include players with some strategy set
        return strat && (strat.priority > 0 || strat.maxBid)
      })
      .map(p => {
        const strat = localStrategies[p.playerId]
        const rating = p.playerApiFootballStats?.games?.rating
          ? Number(p.playerApiFootballStats.games.rating)
          : 6.5
        const clause = p.type !== 'svincolato' ? (p.contractClause || 0) : 0
        const maxBid = parseInt(strat?.maxBid || '0') || 0

        // Score formula: priority weight + form bonus - price penalty
        let score = (strat?.priority || 0) * 20 // 0-100 from priority
        score += (rating - 6) * 15 // Bonus for good rating (6.0 = 0, 7.0 = +15, 8.0 = +30)
        if (clause > 0 && maxBid > 0) {
          score += maxBid >= clause ? 10 : -10 // Bonus if bid covers clause
        }
        if (p.playerAge && p.playerAge < 26) score += 5 // Youth bonus

        return { player: p, strat, score, rating, clause, maxBid }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [players, localStrategies])

  // Budget remaining calculation
  const budgetRemaining = currentBudget - totalTargetBids

  // My Roster players grouped by management tags
  const rosterByTags = useMemo(() => {
    const myRosterPlayers = players.filter(p => p.type === 'myRoster')
    const tagGroups: Record<string, OverviewPlayer[]> = {}

    // Initialize all tag groups
    ROSTER_MANAGEMENT_TAGS.forEach(tag => {
      tagGroups[tag.id] = []
    })

    // Group players by their roster management tags (from notes)
    myRosterPlayers.forEach(player => {
      const strategy = localStrategies[player.playerId]
      const notes = strategy?.notes || ''

      ROSTER_MANAGEMENT_TAGS.forEach(tag => {
        if (notes.includes(tag.label)) {
          tagGroups[tag.id].push(player)
        }
      })
    })

    // Filter out empty groups
    return ROSTER_MANAGEMENT_TAGS
      .map(tag => ({
        tag,
        players: tagGroups[tag.id],
      }))
      .filter(group => group.players.length > 0)
  }, [players, localStrategies])

  // News state
  const [news, setNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)

  // Fetch news for priority players
  useEffect(() => {
    const playersToWatch = topPriorityPlayers.length > 0
      ? topPriorityPlayers
      : smartRanking.slice(0, 5).map(r => r.player)

    if (playersToWatch.length === 0) return

    const playerNames = playersToWatch.map(p => p.playerName)

    setNewsLoading(true)
    setNewsError(null)

    newsApi.getPlayerNews(playerNames)
      .then(res => {
        if (res.success && res.data) {
          setNews(res.data)
        } else {
          setNewsError(res.message || 'Errore nel caricamento notizie')
        }
      })
      .catch(err => {
        console.error('Error fetching news:', err)
        setNewsError('Errore di connessione')
      })
      .finally(() => setNewsLoading(false))
  }, [topPriorityPlayers, smartRanking])

  return (
    <div className="p-4 space-y-6">
      {/* Welcome/Tips Banner */}
      {strategyStats.categoryPercent < 20 && (
        <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <h3 className="font-semibold text-white mb-1">Prepara la tua strategia!</h3>
              <p className="text-sm text-gray-300">
                Organizza i giocatori in <strong>categorie</strong> per tenere traccia di chi vuoi acquistare alle prossime aste.
                Imposta <strong>priorità (★)</strong> e <strong>offerta massima (M)</strong> per non dimenticare quanto vuoi spendere.
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs">
                <div className="flex items-center gap-1 bg-surface-300/50 px-2 py-1 rounded">
                  <span>📂</span>
                  <span className="text-gray-400">Categoria = tipo di interesse</span>
                </div>
                <div className="flex items-center gap-1 bg-surface-300/50 px-2 py-1 rounded">
                  <span>⭐</span>
                  <span className="text-gray-400">Priorità = quanto lo vuoi</span>
                </div>
                <div className="flex items-center gap-1 bg-surface-300/50 px-2 py-1 rounded">
                  <span>💰</span>
                  <span className="text-gray-400">Max = budget massimo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar / Gamification */}
      <div className="bg-surface-300/30 rounded-xl p-4 border border-surface-50/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>📊</span>
            La Tua Preparazione
          </h3>
          <span className="text-xs text-gray-500">{strategyStats.playersWithCategory} / {strategyStats.totalPlayers} organizzati</span>
        </div>
        <div className="h-3 bg-surface-300 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${strategyStats.categoryPercent}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-surface-300/50 rounded-lg p-2">
            <div className="text-lg font-bold text-purple-400">{strategyStats.playersWithCategory}</div>
            <div className="text-gray-500">In watchlist</div>
          </div>
          <div className="bg-surface-300/50 rounded-lg p-2">
            <div className="text-lg font-bold text-yellow-400">{strategyStats.playersWithPriority}</div>
            <div className="text-gray-500">Con priorità</div>
          </div>
          <div className="bg-surface-300/50 rounded-lg p-2">
            <div className="text-lg font-bold text-green-400">{strategyStats.playersWithMaxBid}</div>
            <div className="text-gray-500">Con budget</div>
          </div>
        </div>
      </div>

      {/* Budget Simulator */}
      {currentBudget > 0 && (
        <div className={`rounded-xl p-4 border ${budgetRemaining >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <span>💰</span>
            Simulatore Budget
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">{currentBudget}M</div>
              <div className="text-xs text-gray-500">Budget attuale</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">{totalTargetBids}M</div>
              <div className="text-xs text-gray-500">Tot. offerte max</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {budgetRemaining >= 0 ? budgetRemaining : budgetRemaining}M
              </div>
              <div className="text-xs text-gray-500">
                {budgetRemaining >= 0 ? 'Restante' : 'Deficit!'}
              </div>
            </div>
          </div>
          {budgetRemaining < 0 && (
            <p className="text-xs text-red-400 mt-3 text-center">
              ⚠️ Le tue offerte superano il budget! Rivedi le priorità.
            </p>
          )}
          {budgetRemaining >= 0 && totalTargetBids > 0 && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              Se ottieni tutti i target al max bid, ti restano {budgetRemaining}M
            </p>
          )}
        </div>
      )}

      {/* Section: Category Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📂</span>
          Le Tue Categorie
          <span className="text-sm text-gray-500 font-normal">({totalWatchlistCount} giocatori)</span>
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Clicca su una categoria per vedere i giocatori assegnati. Usa le categorie per organizzare chi vuoi rubare, osservare o cedere.
        </p>

        {categories.length === 0 ? (
          <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-400">Nessuna categoria configurata.</p>
            <p className="text-gray-500 text-sm mt-1">Le categorie aiutano a organizzare i giocatori nella watchlist.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {categories.map(category => {
              const colors = getCategoryColors(category.color)
              const count = categoryPlayerCounts[category.id] || 0

              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryClick(category.id)}
                  className={`
                    p-4 rounded-xl border-2 transition-all cursor-pointer text-left
                    ${colors.bg} ${colors.border} ${colors.hoverBg}
                    hover:scale-[1.02] hover:shadow-lg
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{category.icon || '📋'}</span>
                    <span className={`font-semibold ${colors.text}`}>{category.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">{count}</span>
                    <span className="text-xs text-gray-500">giocatori</span>
                  </div>
                  {category.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{category.description}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Section: Roster Management (My Players by Tag) */}
      {rosterByTags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-xl">🏠</span>
            La Tua Rosa - Piani di Gestione
            <span className="text-sm text-gray-500 font-normal">({rosterByTags.reduce((sum, g) => sum + g.players.length, 0)} giocatori taggati)</span>
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Giocatori della tua rosa organizzati per intenzione. Clicca per aprire la strategia.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rosterByTags.map(({ tag, players: tagPlayers }) => (
              <div
                key={tag.id}
                className={`rounded-xl border-2 overflow-hidden ${tag.color.replace('text-', 'border-').replace('/20', '/30')}`}
              >
                {/* Tag Header */}
                <div className={`px-4 py-3 ${tag.color.split(' ')[0]} border-b ${tag.color.replace('text-', 'border-').replace('/20', '/30')}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{tag.label.split(' ')[0]}</span>
                      <span className={`font-semibold ${tag.color.split(' ')[1]}`}>
                        {tag.label.split(' ').slice(1).join(' ')}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">{tagPlayers.length}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{tag.description}</p>
                </div>

                {/* Players List */}
                <div className="divide-y divide-surface-50/10 bg-surface-300/20">
                  {tagPlayers.slice(0, 5).map(player => {
                    const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                    const posColors = POSITION_COLORS[player.playerPosition as keyof typeof POSITION_COLORS] || { bg: 'bg-gray-500', text: 'text-white' }
                    const strategy = localStrategies[player.playerId]

                    return (
                      <div
                        key={player.playerId}
                        onClick={() => onOpenStrategy ? onOpenStrategy(player) : onPlayerClick(player)}
                        className="px-4 py-2 flex items-center gap-3 hover:bg-surface-300/30 cursor-pointer transition-colors"
                      >
                        {/* Photo */}
                        <div className="relative flex-shrink-0">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={player.playerName}
                              className="w-8 h-8 rounded-full object-cover bg-surface-300"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold`}>
                              {player.playerPosition}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white truncate block">{player.playerName}</span>
                          <span className="text-xs text-gray-500">{player.playerTeam}</span>
                        </div>

                        {/* Min Sale Price (if set) */}
                        {strategy?.maxBid && (
                          <span className="text-xs text-emerald-400 font-medium">
                            {strategy.maxBid}M
                          </span>
                        )}

                        {/* Priority */}
                        {strategy?.priority && strategy.priority > 0 && (
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span
                                key={star}
                                className={`text-xs ${strategy.priority >= star ? 'text-yellow-400' : 'text-gray-700'}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {tagPlayers.length > 5 && (
                    <div className="px-4 py-2 text-center text-xs text-gray-500">
                      +{tagPlayers.length - 5} altri giocatori
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section: Top Priority Players */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">⭐</span>
          I Tuoi Obiettivi Principali
          <span className="text-sm text-gray-500 font-normal">(4-5 stelle)</span>
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          I giocatori con priorità più alta. Vai su <strong>"Tutti i Giocatori"</strong> e clicca le stelle ★★★★★ per aggiungere nuovi obiettivi.
        </p>

        {topPriorityPlayers.length === 0 ? (
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-6 text-center border border-yellow-500/20">
            <span className="text-5xl mb-3 block">🎯</span>
            <p className="text-white font-medium mb-1">Nessun obiettivo ancora</p>
            <p className="text-gray-400 text-sm">
              Vai alla tab <strong className="text-blue-400">"Tutti i Giocatori"</strong> e assegna ★★★★ o ★★★★★ ai giocatori che vuoi assolutamente prendere!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topPriorityPlayers.map(player => {
              const strategy = localStrategies[player.playerId]
              const category = getPlayerCategory(player.playerId)
              const catColors = category ? getCategoryColors(category.color) : null
              const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
              const posColors = POSITION_COLORS[player.playerPosition as keyof typeof POSITION_COLORS] || { bg: 'bg-gray-500', text: 'text-white' }

              return (
                <div
                  key={player.playerId}
                  onClick={() => onOpenStrategy ? onOpenStrategy(player) : onPlayerClick(player)}
                  className="bg-surface-300/50 rounded-xl p-3 border border-purple-500/20 hover:border-purple-500/40 hover:bg-surface-300/70 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {/* Player Photo */}
                    <div className="relative flex-shrink-0">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={player.playerName}
                          className="w-12 h-12 rounded-full object-cover bg-surface-300 border-2 border-purple-500/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                            const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-12 h-12 rounded-full ${posColors.bg} ${posColors.text} items-center justify-center text-sm font-bold ${photoUrl ? 'hidden' : 'flex'}`}
                      >
                        {player.playerPosition}
                      </div>
                      {/* Team logo badge */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white p-0.5 border border-surface-50/20">
                        <img
                          src={getTeamLogo(player.playerTeam)}
                          alt={player.playerTeam}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{player.playerName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${posColors.bg} ${posColors.text}`}>
                          {player.playerPosition}
                        </span>
                        {/* Category Badge */}
                        {category && catColors && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColors.bg} ${catColors.text} ${catColors.border} border flex items-center gap-1`}>
                            <span>{category.icon || '📋'}</span>
                            <span className="hidden sm:inline">{category.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{player.playerTeam}</span>
                        {player.type === 'svincolato' ? (
                          <span className="text-xs text-emerald-400">Svincolato</span>
                        ) : (
                          <span className="text-xs text-gray-500">{player.ownerTeamName || player.ownerUsername}</span>
                        )}
                      </div>
                    </div>

                    {/* Form Badge */}
                    <div className="hidden sm:block">
                      <PlayerFormBadge
                        rating={getFormRating(player.playerApiFootballStats)}
                        trend={calculateFormTrend(
                          getFormRating(player.playerApiFootballStats),
                          getFormRating(player.playerApiFootballStats)
                        )}
                        size="sm"
                      />
                    </div>

                    {/* Max Bid */}
                    {strategy?.maxBid && (
                      <div className="text-center px-3 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="text-[10px] text-gray-500 uppercase">Max</div>
                        <div className="font-bold text-green-400 text-lg">{strategy.maxBid}M</div>
                      </div>
                    )}

                    {/* Priority Stars - larger size */}
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span
                          key={star}
                          className={`text-xl sm:text-2xl ${(strategy?.priority || 0) >= star ? 'text-yellow-400' : 'text-gray-700'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Smart Ranking Section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">🏆</span>
          I Migliori Affari
          <span className="text-sm text-gray-500 font-normal">(classifica smart)</span>
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Giocatori ordinati per valore: priorità + forma + rapporto prezzo/qualità
        </p>

        {smartRanking.length === 0 ? (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-6 text-center border border-amber-500/20">
            <span className="text-5xl mb-3 block">🔍</span>
            <p className="text-white font-medium mb-1">Nessun giocatore valutato</p>
            <p className="text-gray-400 text-sm">
              Imposta priorità e offerte massime ai giocatori per vederli nella classifica intelligente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {smartRanking.map(({ player, score, rating, clause, maxBid }, index) => {
              const category = getPlayerCategory(player.playerId)
              const catColors = category ? getCategoryColors(category.color) : null
              const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
              const posColors = POSITION_COLORS[player.playerPosition as keyof typeof POSITION_COLORS] || { bg: 'bg-gray-500', text: 'text-white' }
              const medalColors = index === 0 ? 'from-yellow-500 to-amber-600' : index === 1 ? 'from-gray-400 to-gray-500' : index === 2 ? 'from-amber-700 to-amber-800' : 'from-surface-100 to-surface-200'

              return (
                <div
                  key={player.playerId}
                  className="bg-surface-300/50 rounded-xl p-3 border border-amber-500/20 hover:border-amber-500/40 hover:bg-surface-300/70 transition-all cursor-pointer"
                  onClick={() => onOpenStrategy ? onOpenStrategy(player) : onPlayerClick(player)}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${medalColors} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {index + 1}
                    </div>

                    {/* Player Photo */}
                    <div className="relative flex-shrink-0">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={player.playerName}
                          className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-amber-500/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-xs font-bold`}>
                          {player.playerPosition}
                        </div>
                      )}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{player.playerName}</span>
                        {/* Category Badge */}
                        {category && catColors && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColors.bg} ${catColors.text} ${catColors.border} border flex items-center gap-0.5`}>
                            <span>{category.icon || '📋'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{player.playerTeam}</span>
                        {rating > 0 && <span className="text-cyan-400">⭐ {rating.toFixed(1)}</span>}
                      </div>
                    </div>

                    {/* Score & Price Info */}
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Valore</div>
                      <div className="text-lg font-bold text-amber-400">{Math.round(score)}</div>
                    </div>

                    {maxBid > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Max</div>
                        <div className={`text-sm font-bold ${maxBid >= clause ? 'text-green-400' : 'text-orange-400'}`}>
                          {maxBid}M
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* News Section - External news about watched players */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📰</span>
          Notizie sui Tuoi Obiettivi
          <span className="text-sm text-gray-500 font-normal">(Google News)</span>
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Ultime notizie sui giocatori che stai osservando
        </p>

        {/* Loading State */}
        {newsLoading && (
          <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Caricamento notizie...</p>
          </div>
        )}

        {/* Error State */}
        {newsError && !newsLoading && (
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 text-center">
            <span className="text-2xl mb-2 block">⚠️</span>
            <p className="text-red-400 text-sm">{newsError}</p>
          </div>
        )}

        {/* No Players State */}
        {!newsLoading && !newsError && topPriorityPlayers.length === 0 && smartRanking.length === 0 && (
          <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20">
            <span className="text-4xl mb-3 block">📰</span>
            <p className="text-gray-400">Imposta priorità ai giocatori per vedere le notizie su di loro</p>
          </div>
        )}

        {/* News List - Grouped by Player */}
        {!newsLoading && !newsError && news.length > 0 && (() => {
          // Group news by player name
          const newsByPlayer = news.reduce((acc, article) => {
            const key = article.playerName || 'Altro'
            if (!acc[key]) acc[key] = []
            acc[key].push(article)
            return acc
          }, {} as Record<string, NewsArticle[]>)

          return (
            <div className="space-y-4">
              {Object.entries(newsByPlayer).map(([playerName, articles]) => {
                // Find the player object for photo/team
                const playerObj = [...topPriorityPlayers, ...smartRanking.map(r => r.player)]
                  .find(p => p.playerName === playerName)
                const photoUrl = playerObj ? getPlayerPhotoUrl(playerObj.playerApiFootballId) : null
                const posColors = playerObj
                  ? POSITION_COLORS[playerObj.playerPosition as keyof typeof POSITION_COLORS] || { bg: 'bg-gray-500', text: 'text-white' }
                  : { bg: 'bg-gray-500', text: 'text-white' }

                return (
                  <div key={playerName} className="bg-surface-300/20 rounded-xl border border-surface-50/20 overflow-hidden">
                    {/* Player Header */}
                    <div className="bg-surface-300/50 px-4 py-3 border-b border-surface-50/20 flex items-center gap-3">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={playerName}
                          className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-blue-500/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-sm font-bold`}>
                          {playerObj?.playerPosition || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <span className="font-semibold text-white">{playerName}</span>
                        {playerObj && (
                          <span className="text-xs text-gray-500 ml-2">{playerObj.playerTeam}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 bg-surface-300 px-2 py-1 rounded">
                        {articles.length} {articles.length === 1 ? 'notizia' : 'notizie'}
                      </span>
                    </div>

                    {/* Articles for this player */}
                    <div className="divide-y divide-surface-50/10">
                      {articles.map(article => (
                        <a
                          key={article.id}
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-4 py-3 hover:bg-surface-300/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm flex-shrink-0">
                              📰
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white line-clamp-2">
                                {article.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span>{article.source}</span>
                                <span>•</span>
                                <span>{article.timeAgo}</span>
                              </div>
                            </div>
                            <div className="text-gray-500 text-sm">
                              →
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* No News Found */}
        {!newsLoading && !newsError && news.length === 0 && (topPriorityPlayers.length > 0 || smartRanking.length > 0) && (
          <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20">
            <span className="text-4xl mb-3 block">🔍</span>
            <p className="text-gray-400">Nessuna notizia recente trovata per i tuoi obiettivi</p>
            <p className="text-gray-500 text-xs mt-2">Prova con giocatori più conosciuti</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default WatchlistOverview
