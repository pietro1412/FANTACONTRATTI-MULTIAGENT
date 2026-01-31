/**
 * WatchlistOverview - Dashboard overview tab for the Strategie page
 *
 * Features:
 * - Category cards with player counts (5 columns desktop, 2 mobile)
 * - Top priorities section (players with 4+ stars)
 * - Alerts/notifications placeholder
 */

import { useMemo } from 'react'
import type { WatchlistCategory, WatchlistEntry } from '../services/api'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from './ui/PositionBadge'
import { PlayerFormBadge, getFormRating, calculateFormTrend } from './PlayerFormBadge'
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
}

// Category color mapping
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', hoverBg: 'hover:bg-red-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/20' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/20' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', hoverBg: 'hover:bg-green-500/20' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/20' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', hoverBg: 'hover:bg-pink-500/20' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/20' },
}

function getCategoryColors(color: string | null): { bg: string; border: string; text: string; hoverBg: string } {
  return CATEGORY_COLORS[color || 'blue'] || CATEGORY_COLORS.blue
}

export function WatchlistOverview({
  categories,
  entries,
  players,
  localStrategies,
  onCategoryClick,
  onPlayerClick,
}: WatchlistOverviewProps) {
  // Count players per category
  const categoryPlayerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach(cat => {
      counts[cat.id] = entries.filter(e => e.categoryId === cat.id).length
    })
    return counts
  }, [categories, entries])

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

  return (
    <div className="p-4 space-y-6">
      {/* Section: Category Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📂</span>
          Categorie Watchlist
          <span className="text-sm text-gray-500 font-normal">({totalWatchlistCount} giocatori totali)</span>
        </h2>

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

      {/* Section: Top Priority Players */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">⭐</span>
          I Miei Top Priorita
          <span className="text-sm text-gray-500 font-normal">(4+ stelle)</span>
        </h2>

        {topPriorityPlayers.length === 0 ? (
          <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20">
            <span className="text-4xl mb-3 block">⭐</span>
            <p className="text-gray-400">Nessun giocatore con alta priorita.</p>
            <p className="text-gray-500 text-sm mt-1">
              Assegna 4 o 5 stelle ai giocatori che ti interessano di piu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topPriorityPlayers.map(player => {
              const strategy = localStrategies[player.playerId]
              const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
              const posColors = POSITION_COLORS[player.playerPosition] || { bg: 'bg-gray-500', text: 'text-white' }

              return (
                <div
                  key={player.playerId}
                  onClick={() => onPlayerClick(player)}
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{player.playerName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${posColors.bg} ${posColors.text}`}>
                          {player.playerPosition}
                        </span>
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
                      <div className="text-center px-2">
                        <div className="text-xs text-gray-500">Max</div>
                        <div className="font-bold text-blue-400">{strategy.maxBid}M</div>
                      </div>
                    )}

                    {/* Priority Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span
                          key={star}
                          className={`text-lg ${(strategy?.priority || 0) >= star ? 'text-purple-400' : 'text-gray-700'}`}
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

      {/* Section: Alerts/Notifications Placeholder */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">🔔</span>
          Alert e Notifiche
        </h2>

        <div className="bg-surface-300/30 rounded-xl p-6 text-center border border-surface-50/20 border-dashed">
          <span className="text-4xl mb-3 block opacity-50">🔔</span>
          <p className="text-gray-400">Nessun alert recente</p>
          <p className="text-gray-500 text-sm mt-2">
            Le notifiche su infortuni e cambi di forma saranno disponibili presto.
          </p>
        </div>
      </div>
    </div>
  )
}

export default WatchlistOverview
