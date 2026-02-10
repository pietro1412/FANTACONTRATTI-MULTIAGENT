import { useParams } from 'react-router-dom'
import { AUTO_TAG_DEFS } from '../services/player-stats.service'
import {
  WATCHLIST_CATEGORIES,
  PLAYER_CHART_COLORS,
  STATS_COLUMNS,
  MERGE_STATS_KEYS,
  getAgeColor,
  getAgeBgColor,
  type WatchlistCategoryId,
  type DisplayPlayer,
  type StrategyPlayerWithPreference,
  type SortField,
} from '../types/strategierubata.types'
import { useStrategieRubataState } from '../hooks/useStrategieRubataState'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { getPlayerPhotoUrl } from '../utils/player-images'
import { POSITION_COLORS } from '../components/ui/PositionBadge'
import { PlayerStatsModal } from '../components/PlayerStatsModal'
import RadarChart from '../components/ui/RadarChart'

// Team logo component
function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

export function StrategieRubata({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { leagueId } = useParams<{ leagueId: string }>()

  const {
    loading,
    error,
    success,
    savingPlayerIds,
    isLeagueAdmin,
    strategiesData,
    svincolatiData,
    myMemberId,
    viewMode,
    setViewMode,
    dataViewMode,
    setDataViewMode,
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
    showOnlyWithStrategy,
    setShowOnlyWithStrategy,
    ownerFilter,
    setOwnerFilter,
    teamFilter,
    setTeamFilter,
    sortField,
    sortDirection,
    handleSort,
    selectedPlayerStats,
    setSelectedPlayerStats,
    selectedForCompare,
    showCompareModal,
    setShowCompareModal,
    togglePlayerForCompare,
    clearComparison,
    getLocalStrategy,
    updateLocalStrategy,
    setWatchlistCategory,
    uniqueOwners,
    uniqueTeams,
    filteredPlayers,
    playersToCompare,
    myStrategiesCount,
  } = useStrategieRubataState(leagueId)

  // Sortable column header component
  const SortableHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`cursor-pointer hover:bg-surface-50/10 transition-colors select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-primary-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
        )}
      </div>
    </th>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-300">
        <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />
        <main className="max-w-[1600px] mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-400"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300 pb-6">
      <Navigation currentPage="strategie-rubata" leagueId={leagueId} isLeagueAdmin={isLeagueAdmin} onNavigate={onNavigate} />

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">👥</span>
              Giocatori
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            {viewMode === 'myRoster'
              ? 'Visualizza la tua rosa con contratti e valori.'
              : 'Imposta offerta massima, priorità e note per le strategie rubata. Le modifiche vengono salvate automaticamente.'
            }
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/30 text-danger-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-secondary-500/20 border border-secondary-500/30 text-secondary-400 p-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        {/* Main content: Table + Sidebar */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
              {/* === 3-LEVEL FILTER LAYOUT === */}

              {/* LEVEL 1: Data View Toggle (sticky) */}
              <div className="sticky top-0 z-10 p-2 border-b border-surface-50/20 bg-surface-300/80 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1 bg-surface-400/50 rounded-lg p-0.5">
                    <button
                      onClick={() => setDataViewMode('contracts')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        dataViewMode === 'contracts'
                          ? 'bg-accent-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                      }`}
                      title="Vista contratti"
                    >
                      📋 Contratti
                    </button>
                    <button
                      onClick={() => setDataViewMode('stats')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        dataViewMode === 'stats'
                          ? 'bg-cyan-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                      }`}
                      title="Vista statistiche"
                    >
                      📊 Stats
                    </button>
                    <button
                      onClick={() => setDataViewMode('merge')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        dataViewMode === 'merge'
                          ? 'bg-violet-500 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-surface-300/50'
                      }`}
                      title="Vista mista contratti e statistiche"
                    >
                      🔀 Contratti e Stats
                    </button>
                  </div>
                  <div className="text-sm text-gray-400">
                    <span className="font-semibold text-white">{filteredPlayers.length}</span> giocatori
                  </div>
                </div>
              </div>

              {/* LEVEL 2: Scope Buttons with Count Badges */}
              <div className="p-2 border-b border-surface-50/20 bg-surface-300/50">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => { setViewMode('myRoster'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'myRoster'
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="La mia rosa"
                  >
                    <span>🏠 La Mia Rosa</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'myRoster' ? 'bg-white/20' : 'bg-primary-500/20 text-primary-400'
                    }`}>
                      {strategiesData?.players.filter(p => p.memberId === myMemberId).length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('owned'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'owned'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Giocatori di altri manager"
                  >
                    <span>👥 Altre Rose</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'owned' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {strategiesData?.players.filter(p => p.memberId !== myMemberId).length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('svincolati'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'svincolati'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Giocatori svincolati"
                  >
                    <span>🆓 Svincolati</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'svincolati' ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {svincolatiData?.players.length || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('all'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'all'
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Tutti i giocatori"
                  >
                    <span>🌐 Tutti</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      viewMode === 'all' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {(strategiesData?.players.length || 0) + (svincolatiData?.players.length || 0)}
                    </span>
                  </button>
                  <button
                    onClick={() => { setViewMode('overview'); setOwnerFilter('ALL'); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      viewMode === 'overview'
                        ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                        : 'bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-300'
                    }`}
                    title="Overview watchlist e priorità"
                  >
                    <span>📋 Overview</span>
                  </button>
                </div>
              </div>

              {/* LEVEL 3: Filters (hidden in overview mode) */}
              {viewMode !== 'overview' && <div className="p-2 border-b border-surface-50/20 bg-surface-300/30">
                {/* Row 1: Position + Dropdowns */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Position Filter Group */}
                  <div className="flex gap-1">
                    {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                      const colors = POSITION_COLORS[pos] ?? { bg: 'bg-white/20', text: 'text-white', border: '' }
                      return (
                        <button
                          key={pos}
                          onClick={() => setPositionFilter(pos)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            positionFilter === pos
                              ? pos === 'ALL'
                                ? 'bg-white/20 text-white'
                                : `${colors.bg} ${colors.text}`
                              : 'bg-surface-300 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {pos === 'ALL' ? 'Tutti' : pos}
                        </button>
                      )
                    })}
                  </div>

                  {/* Owner Filter - only for owned or all views */}
                  {(viewMode === 'owned' || viewMode === 'all') && (
                    <select
                      value={ownerFilter}
                      onChange={(e) => setOwnerFilter(e.target.value)}
                      className="px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    >
                      <option value="ALL">Manager</option>
                      {uniqueOwners.map(o => (
                        <option key={o.username} value={o.username}>{o.teamName}</option>
                      ))}
                    </select>
                  )}

                  {/* Team Filter */}
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                  >
                    <option value="ALL">Squadra</option>
                    {uniqueTeams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Search + Strategy */}
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Cerca giocatore..."
                      className="w-full px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                    />
                  </div>

                  {/* Strategy filter */}
                  <label className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={showOnlyWithStrategy}
                      onChange={(e) => setShowOnlyWithStrategy(e.target.checked)}
                      className="w-4 h-4 rounded bg-surface-300 border-indigo-500/50 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-indigo-300 whitespace-nowrap font-medium">⭐ Strategia</span>
                  </label>

                  {/* Compare button (#187) */}
                  {selectedForCompare.size > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setShowCompareModal(true)}
                        disabled={selectedForCompare.size < 2}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedForCompare.size >= 2
                            ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                            : 'bg-cyan-500/30 text-cyan-400/50 cursor-not-allowed'
                        }`}
                      >
                        📊 Confronta ({selectedForCompare.size})
                      </button>
                      <button
                        onClick={clearComparison}
                        className="w-7 h-7 rounded-lg bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-sm flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>}

              {/* Overview Tab #219 */}
              {viewMode === 'overview' && (
                <div className="p-4 space-y-6">
                  {/* Category cards */}
                  {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([catId, cat]) => {
                    // Collect all players in this category from both datasets
                    const categoryPlayers: DisplayPlayer[] = []
                    strategiesData?.players.forEach(p => {
                      if (p.preference?.watchlistCategory === catId) {
                        const isMy = p.memberId === myMemberId
                        categoryPlayers.push({ ...p, type: isMy ? 'myRoster' : 'owned' })
                      }
                    })
                    svincolatiData?.players.forEach(p => {
                      if (p.preference?.watchlistCategory === catId) {
                        categoryPlayers.push({ ...p, type: 'svincolato' })
                      }
                    })

                    return (
                      <div key={catId} className={`rounded-xl border ${cat.color} p-4`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-base">{cat.icon} {cat.label}</h3>
                          <span className="text-xs opacity-70">{categoryPlayers.length} giocatori</span>
                        </div>
                        {categoryPlayers.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">Nessun giocatore in questa categoria</p>
                        ) : (
                          <div className="space-y-2">
                            {categoryPlayers.map(player => {
                              const posC = POSITION_COLORS[player.playerPosition] ?? { bg: 'bg-gray-500', text: 'text-white', border: '' }
                              const local = getLocalStrategy(player.playerId)
                              return (
                                <div key={player.playerId} className="flex items-center gap-3 bg-surface-300/50 rounded-lg p-2">
                                  <span className={`w-8 h-8 rounded-full ${posC.bg} ${posC.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                                    {player.playerPosition}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{player.playerName}</div>
                                    <div className="text-[10px] text-gray-500">{player.playerTeam} {player.type === 'svincolato' ? '(Svincolato)' : `(${(player as StrategyPlayerWithPreference).ownerUsername || ''})`}</div>
                                  </div>
                                  {local.priority > 0 && (
                                    <span className="text-purple-400 text-xs font-bold">{'★'.repeat(local.priority)}</span>
                                  )}
                                  {local.maxBid && (
                                    <span className="text-accent-400 text-xs font-bold">{local.maxBid}M</span>
                                  )}
                                  {/* Auto-tags */}
                                  {player.playerAutoTags && player.playerAutoTags.length > 0 && (
                                    <div className="flex gap-1">
                                      {player.playerAutoTags.slice(0, 2).map(tagId => {
                                        const def = AUTO_TAG_DEFS[tagId]
                                        return def ? (
                                          <span key={tagId} className={`text-[9px] px-1 py-0.5 rounded-full bg-surface-300 ${def.color}`} title={def.description}>
                                            {def.icon}
                                          </span>
                                        ) : null
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Top Priority Players */}
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                    <h3 className="font-semibold text-base text-purple-400 mb-3">Top Priorità</h3>
                    {(() => {
                      const allWithPriority: DisplayPlayer[] = []
                      strategiesData?.players.forEach(p => {
                        const local = getLocalStrategy(p.playerId)
                        if (local.priority > 0) {
                          const isMy = p.memberId === myMemberId
                          allWithPriority.push({ ...p, type: isMy ? 'myRoster' : 'owned' })
                        }
                      })
                      svincolatiData?.players.forEach(p => {
                        const local = getLocalStrategy(p.playerId)
                        if (local.priority > 0) {
                          allWithPriority.push({ ...p, type: 'svincolato' })
                        }
                      })
                      allWithPriority.sort((a, b) => {
                        const prioA = getLocalStrategy(a.playerId).priority
                        const prioB = getLocalStrategy(b.playerId).priority
                        return prioB - prioA
                      })

                      if (allWithPriority.length === 0) {
                        return <p className="text-xs text-gray-500 italic">Nessun giocatore con priorità impostata</p>
                      }

                      return (
                        <div className="space-y-2">
                          {allWithPriority.slice(0, 10).map(player => {
                            const posC = POSITION_COLORS[player.playerPosition] ?? { bg: 'bg-gray-500', text: 'text-white', border: '' }
                            const local = getLocalStrategy(player.playerId)
                            const catId = player.preference?.watchlistCategory as WatchlistCategoryId | null
                            const cat = catId ? WATCHLIST_CATEGORIES[catId] : null
                            return (
                              <div key={player.playerId} className="flex items-center gap-3 bg-surface-300/50 rounded-lg p-2">
                                <span className={`w-8 h-8 rounded-full ${posC.bg} ${posC.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                                  {player.playerPosition}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{player.playerName}</div>
                                  <div className="text-[10px] text-gray-500">{player.playerTeam}</div>
                                </div>
                                <span className="text-purple-400 text-sm font-bold">{'★'.repeat(local.priority)}</span>
                                {local.maxBid && (
                                  <span className="text-accent-400 text-xs font-bold">{local.maxBid}M</span>
                                )}
                                {cat && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cat.color}`}>{cat.icon}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Mobile Card Layout */}
              {viewMode !== 'overview' && <div className="md:hidden space-y-3 p-3">
                {filteredPlayers.map(player => {
                  const defaultColors = { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
                  const posColors = POSITION_COLORS[player.playerPosition] ?? defaultColors
                  const local = getLocalStrategy(player.playerId)
                  const hasStrategy = !!(local.maxBid || local.priority || local.notes)
                  const isSvincolato = player.type === 'svincolato'
                  const isMyRoster = player.type === 'myRoster'

                  return (
                    <div key={player.playerId} className={`bg-surface-300/30 rounded-lg p-3 border ${selectedForCompare.has(player.playerId) ? 'border-cyan-500/50 bg-cyan-500/10' : isMyRoster ? 'border-primary-500/30 bg-primary-500/5' : hasStrategy ? 'border-indigo-500/30 bg-indigo-500/5' : isSvincolato ? 'border-emerald-500/20' : 'border-surface-50/10'}`}>
                      {/* Header: Checkbox + Photo + Player + Svincolato badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* Compare checkbox (#187) */}
                        <input
                          type="checkbox"
                          checked={selectedForCompare.has(player.playerId)}
                          onChange={() => togglePlayerForCompare(player.playerId)}
                          className="w-5 h-5 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500 flex-shrink-0"
                        />
                        {/* Player Photo with Team Logo Badge - increased size #186 */}
                        <div className="relative flex-shrink-0">
                          {(() => {
                            const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                            return photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={player.playerName}
                                className="w-12 h-12 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null
                          })()}
                          <div
                            className={`w-12 h-12 rounded-full ${posColors.bg} ${posColors.text} items-center justify-center text-sm font-bold ${getPlayerPhotoUrl(player.playerApiFootballId) ? 'hidden' : 'flex'}`}
                          >
                            {player.playerPosition}
                          </div>
                          {/* Team logo badge - increased size #186 */}
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white p-0.5 border border-surface-50/20">
                            <TeamLogo team={player.playerTeam} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setSelectedPlayerStats({
                              name: player.playerName,
                              team: player.playerTeam,
                              position: player.playerPosition,
                              quotation: isSvincolato ? undefined : player.playerQuotation,
                              age: player.playerAge,
                              apiFootballId: player.playerApiFootballId,
                              computedStats: player.playerComputedStats,
                            })}
                            className="font-medium text-white text-base truncate hover:text-primary-400 transition-colors text-left"
                          >
                            {player.playerName}
                          </button>
                          {/* Auto-tags #220 */}
                          {player.playerAutoTags && player.playerAutoTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {player.playerAutoTags.map(tagId => {
                                const def = AUTO_TAG_DEFS[tagId]
                                return def ? (
                                  <span key={tagId} className={`text-[10px] px-1.5 py-0.5 rounded-full bg-surface-300 ${def.color} font-medium`} title={def.description}>
                                    {def.icon} {def.label}
                                  </span>
                                ) : null
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Player details: Squadra, Età, Owner */}
                      <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                        <div>
                          <span className="text-gray-500">Squadra: </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-4 h-4 flex-shrink-0">
                              <TeamLogo team={player.playerTeam} />
                            </div>
                            <span className="text-gray-300 truncate">{player.playerTeam}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Età: </span>
                          <span className={`${getAgeColor(player.playerAge)}`}>
                            {player.playerAge != null ? `${player.playerAge} anni` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Prop: </span>
                          {isSvincolato ? (
                            <span className="text-emerald-400">Svincolato</span>
                          ) : isMyRoster ? (
                            <span className="text-primary-400">La Mia Rosa</span>
                          ) : (
                            <span className="text-gray-300">{player.ownerTeamName || player.ownerUsername}</span>
                          )}
                        </div>
                      </div>
                      {/* Contract info - only for contracts/merge view */}
                      {!isSvincolato && (dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Clausola</div>
                            <div className="text-orange-400 font-medium">{player.contractClause}M</div>
                          </div>
                          <div className="bg-surface-300/50 rounded p-1.5">
                            <div className="text-gray-500 text-[10px] uppercase">Rubata</div>
                            <div className="text-warning-400 font-bold">{player.rubataPrice}M</div>
                          </div>
                        </div>
                      )}

                      {/* Stats info - only for stats/merge view (using computedStats) */}
                      {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                          <div className="bg-cyan-500/10 rounded p-1.5 border border-cyan-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Rating</div>
                            <div className="text-cyan-400 font-semibold">
                              {player.playerComputedStats?.avgRating != null
                                ? player.playerComputedStats.avgRating.toFixed(1)
                                : '-'}
                            </div>
                          </div>
                          <div className="bg-secondary-500/10 rounded p-1.5 border border-secondary-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Gol</div>
                            <div className="text-secondary-400 font-medium">
                              {player.playerComputedStats?.totalGoals ?? '-'}
                            </div>
                          </div>
                          <div className="bg-primary-500/10 rounded p-1.5 border border-primary-500/20">
                            <div className="text-gray-500 text-[10px] uppercase">Assist</div>
                            <div className="text-primary-400 font-medium">
                              {player.playerComputedStats?.totalAssists ?? '-'}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Strategy Section - always visible */}
                      <div className="bg-indigo-500/10 rounded-lg p-2 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          {/* Max Bid */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 uppercase">Max:</span>
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, (parseInt(local.maxBid) || 0) - 1).toString())} className="w-6 h-6 min-h-[44px] min-w-[44px] rounded bg-surface-300/70 text-gray-400 text-sm font-bold flex items-center justify-center">−</button>
                            <input type="number" inputMode="decimal" value={local.maxBid} onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)} placeholder="-" className="w-12 px-1 py-1 min-h-[44px] bg-surface-300/50 border border-surface-50/30 rounded text-white text-center text-sm" />
                            <button onClick={() => updateLocalStrategy(player.playerId, 'maxBid', ((parseInt(local.maxBid) || 0) + 1).toString())} className="w-6 h-6 min-h-[44px] min-w-[44px] rounded bg-surface-300/70 text-gray-400 text-sm font-bold flex items-center justify-center">+</button>
                          </div>
                          {/* Priority - increased size #186 */}
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button key={star} onClick={() => updateLocalStrategy(player.playerId, 'priority', local.priority === star ? 0 : star)} className={`w-8 h-8 min-h-[44px] min-w-[44px] text-xl flex items-center justify-center ${local.priority >= star ? 'text-purple-400' : 'text-gray-600'}`}>★</button>
                            ))}
                          </div>
                        </div>
                        {/* Notes */}
                        <input type="text" value={local.notes} onChange={(e) => updateLocalStrategy(player.playerId, 'notes', e.target.value)} placeholder="Note..." className="w-full px-2 py-1 bg-surface-300/50 border border-surface-50/30 rounded text-white text-sm" />
                        {/* Watchlist Category #219 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([catId, cat]) => {
                            const isActive = player.preference?.watchlistCategory === catId
                            return (
                              <button
                                key={catId}
                                onClick={() => setWatchlistCategory(player.playerId, isActive ? null : catId)}
                                className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${isActive ? cat.color : 'bg-surface-300/50 text-gray-500 border-surface-50/20 hover:text-gray-300'}`}
                              >
                                {cat.icon} {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {filteredPlayers.length === 0 && (
                  <div className="text-center text-gray-500 py-8">Nessun giocatore trovato</div>
                )}
              </div>}

              {/* Desktop Table */}
              {viewMode !== 'overview' && <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-surface-300/50">
                    {/* Group headers */}
                    <tr className="text-[10px] text-gray-500 uppercase border-b border-surface-50/20">
                      <th className="w-10 py-1 px-2 bg-cyan-500/10">📊</th>
                      <th colSpan={5} className="text-left py-1 px-3 bg-surface-300/30">
                        Giocatore
                      </th>
                      {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <th colSpan={4} className="text-center py-1 px-3 bg-accent-500/10 border-l border-surface-50/20">
                          Contratto
                        </th>
                      )}
                      {dataViewMode === 'contracts' && (
                        <th className="text-center py-1 px-3 bg-cyan-500/10 border-l border-surface-50/20">Stat</th>
                      )}
                      {(dataViewMode === 'stats' || dataViewMode === 'merge') && (
                        <th colSpan={dataViewMode === 'stats' ? STATS_COLUMNS.length : MERGE_STATS_KEYS.length} className="text-center py-1 px-3 bg-cyan-500/10 border-l border-surface-50/20">
                          Statistiche
                        </th>
                      )}
                      <th colSpan={4} className="text-center py-1 px-3 bg-indigo-500/10 border-l border-surface-50/20">
                        Strategia
                      </th>
                    </tr>
                    {/* Column headers */}
                    <tr className="text-xs text-gray-400 uppercase">
                      {/* Compare checkbox header (#187) */}
                      <th className="w-10 p-2 text-center bg-cyan-500/5">
                        <input
                          type="checkbox"
                          checked={selectedForCompare.size > 0}
                          onChange={() => selectedForCompare.size > 0 ? clearComparison() : null}
                          className="w-4 h-4 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500"
                        />
                      </th>
                      <SortableHeader field="position" label="R" className="w-10 p-2 text-center" />
                      <SortableHeader field="name" label="Giocatore" className="text-left p-2" />
                      <th className="text-left p-2">Squadra</th>
                      <th className="text-center p-2 w-12">Età</th>
                      <SortableHeader field="owner" label="Prop." className="text-left p-2" />
                      {/* Contract columns */}
                      {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                        <>
                          <th className="text-center p-2 text-accent-400 border-l border-surface-50/20">Ing.</th>
                          <th className="text-center p-2">Dur.</th>
                          <th className="text-center p-2 text-orange-400">Cls</th>
                          <SortableHeader field="rubata" label="Rub." className="text-center p-2" />
                        </>
                      )}
                      {dataViewMode === 'contracts' && (
                        <th className="text-center p-2 text-cyan-400 border-l border-surface-50/20" title="Rating medio">Rat</th>
                      )}
                      {/* Stats columns */}
                      {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => (
                        <th key={col.key} className={`text-center p-2 ${col.colorClass || ''} ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>
                          {col.shortLabel}
                        </th>
                      ))}
                      {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => (
                        <th key={col.key} className={`text-center p-2 ${col.colorClass || ''} ${idx === 0 ? 'border-l border-surface-50/20' : ''}`} title={col.label}>
                          {col.shortLabel}
                        </th>
                      ))}
                      {/* Strategy columns */}
                      <th className="text-center p-2 bg-indigo-500/5 border-l border-surface-50/20">Max</th>
                      <th className="text-center p-2 bg-indigo-500/5">★</th>
                      <th className="text-left p-2 bg-indigo-500/5">Note</th>
                      <th className="text-center p-2 bg-indigo-500/5">Cat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map(player => {
                      const defaultColors = { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white', border: '' }
                      const posColors = POSITION_COLORS[player.playerPosition] ?? defaultColors
                      const local = getLocalStrategy(player.playerId)
                      const isSaving = savingPlayerIds.has(player.playerId)
                      const hasStrategy = !!(local.maxBid || local.priority || local.notes)
                      const isSvincolato = player.type === 'svincolato'
                      const isMyRoster = player.type === 'myRoster'

                      return (
                        <tr
                          key={player.playerId}
                          className={`border-t border-surface-50/10 transition-colors ${
                            selectedForCompare.has(player.playerId) ? 'bg-cyan-500/10' : isMyRoster ? 'bg-primary-500/5' : hasStrategy ? 'bg-indigo-500/5' : isSvincolato ? 'bg-emerald-500/5' : ''
                          } hover:bg-surface-300/30`}
                        >
                          {/* Compare checkbox (#187) */}
                          <td className="p-2 text-center bg-cyan-500/5">
                            <input
                              type="checkbox"
                              checked={selectedForCompare.has(player.playerId)}
                              onChange={() => togglePlayerForCompare(player.playerId)}
                              className="w-4 h-4 rounded bg-surface-300 border-cyan-500/50 text-cyan-500 focus:ring-cyan-500"
                            />
                          </td>

                          {/* Position */}
                          <td className="p-2 text-center">
                            <div className={`w-8 h-8 mx-auto rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center text-sm font-bold`}>
                              {player.playerPosition}
                            </div>
                          </td>

                          {/* Player - increased sizes #186 */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {/* Player Photo - increased size #186 */}
                              <div className="relative flex-shrink-0">
                                {(() => {
                                  const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                                  return photoUrl ? (
                                    <img
                                      src={photoUrl}
                                      alt={player.playerName}
                                      className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                        if (fallback) fallback.style.display = 'flex'
                                      }}
                                    />
                                  ) : null
                                })()}
                                <div
                                  className={`w-10 h-10 rounded-full ${posColors.bg} ${posColors.text} items-center justify-center font-bold text-sm ${getPlayerPhotoUrl(player.playerApiFootballId) ? 'hidden' : 'flex'}`}
                                >
                                  {player.playerPosition}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <button
                                  onClick={() => setSelectedPlayerStats({
                                    name: player.playerName,
                                    team: player.playerTeam,
                                    position: player.playerPosition,
                                    quotation: isSvincolato ? undefined : player.playerQuotation,
                                    age: player.playerAge,
                                    apiFootballId: player.playerApiFootballId,
                                    computedStats: player.playerComputedStats,
                                  })}
                                  className="font-medium text-white text-base truncate hover:text-primary-400 transition-colors text-left"
                                >
                                  {player.playerName}
                                </button>
                                {/* Auto-tags #220 */}
                                {player.playerAutoTags && player.playerAutoTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {player.playerAutoTags.map(tagId => {
                                      const def = AUTO_TAG_DEFS[tagId]
                                      return def ? (
                                        <span key={tagId} className={`text-[10px] px-1.5 py-0.5 rounded-full bg-surface-300 ${def.color} font-medium`} title={def.description}>
                                          {def.icon} {def.label}
                                        </span>
                                      ) : null
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Squadra */}
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <span className="text-sm text-gray-300 truncate">{player.playerTeam}</span>
                            </div>
                          </td>

                          {/* Età */}
                          {/* Età */}
                          <td className="p-2 text-center">
                            <span className={`text-sm px-2 py-0.5 rounded ${getAgeBgColor(player.playerAge)}`}>
                              {player.playerAge != null ? player.playerAge : '-'}
                            </span>
                          </td>

                          {/* Owner / Svincolato / My Roster */}
                          <td className="p-2">
                            {isSvincolato ? (
                              <div className="min-w-0">
                                <div className="font-medium text-emerald-400 text-sm">Svincolato</div>
                              </div>
                            ) : player.type === 'myRoster' ? (
                              <div className="min-w-0">
                                <div className="font-medium text-primary-400 text-sm">La Mia Rosa</div>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <div className="font-medium text-gray-300 text-sm truncate">
                                  {player.ownerTeamName || player.ownerUsername}
                                </div>
                                {player.ownerTeamName && (
                                  <div className="text-xs text-gray-500">{player.ownerUsername}</div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Contract columns - only for contracts and merge views */}
                          {(dataViewMode === 'contracts' || dataViewMode === 'merge') && (
                            <>
                              {/* Ingaggio */}
                              <td className="p-2 text-center border-l border-surface-50/10">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-accent-400 font-medium text-xs">{player.contractSalary}M</span>
                                )}
                              </td>

                              {/* Durata */}
                              <td className="p-2 text-center">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-white text-xs">{player.contractDuration}</span>
                                )}
                              </td>

                              {/* Clausola */}
                              <td className="p-2 text-center">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-orange-400 font-medium">{player.contractClause}M</span>
                                )}
                              </td>

                              {/* Rubata Price */}
                              <td className="p-2 text-center">
                                {isSvincolato ? (
                                  <span className="text-gray-600">-</span>
                                ) : (
                                  <span className="text-warning-400 font-bold">{player.rubataPrice}M</span>
                                )}
                              </td>
                            </>
                          )}

                          {/* Rating column in contracts view */}
                          {dataViewMode === 'contracts' && (
                            <td className="p-2 text-center text-xs text-cyan-400 border-l border-surface-50/10">
                              {player.playerComputedStats?.avgRating != null
                                ? player.playerComputedStats.avgRating.toFixed(1)
                                : '-'}
                            </td>
                          )}

                          {/* Stats columns - full set for stats view (using computedStats for main stats) */}
                          {dataViewMode === 'stats' && STATS_COLUMNS.map((col, idx) => {
                            // Use computedStats for main stats (more accurate data)
                            let rawValue: number | string | null = null
                            const cs = player.playerComputedStats
                            if (col.key === 'appearances') rawValue = cs?.appearances ?? null
                            else if (col.key === 'rating') rawValue = cs?.avgRating ?? null
                            else if (col.key === 'goals') rawValue = cs?.totalGoals ?? null
                            else if (col.key === 'assists') rawValue = cs?.totalAssists ?? null
                            else if (col.key === 'minutes') rawValue = cs?.totalMinutes ?? null
                            else rawValue = col.getValue(player.playerApiFootballStats) // secondary stats from API
                            const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                            const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                            return (
                              <td key={col.key} className={`p-2 text-center text-xs ${col.colorClass || 'text-gray-300'} ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                {formatted}
                              </td>
                            )
                          })}

                          {/* Stats columns - essential only for merge view (using computedStats) */}
                          {dataViewMode === 'merge' && STATS_COLUMNS.filter(c => MERGE_STATS_KEYS.includes(c.key)).map((col, idx) => {
                            const cs = player.playerComputedStats
                            let rawValue: number | string | null = null
                            if (col.key === 'rating') rawValue = cs?.avgRating ?? null
                            else if (col.key === 'goals') rawValue = cs?.totalGoals ?? null
                            else if (col.key === 'assists') rawValue = cs?.totalAssists ?? null
                            else rawValue = col.getValue(player.playerApiFootballStats)
                            const numValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
                            const formatted = col.format ? col.format(numValue) : (numValue ?? '-')
                            return (
                              <td key={col.key} className={`p-2 text-center text-xs ${col.colorClass || 'text-gray-300'} ${idx === 0 ? 'border-l border-surface-50/10' : ''}`}>
                                {formatted}
                              </td>
                            )
                          })}

                          {/* === STRATEGY SECTION === */}
                          {/* Offerta Max */}
                          <td className="p-2 text-center bg-indigo-500/5 border-l border-surface-50/10">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', Math.max(0, current - 1).toString())
                                }}
                                className="w-5 h-5 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-xs font-bold flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={local.maxBid}
                                onChange={(e) => updateLocalStrategy(player.playerId, 'maxBid', e.target.value)}
                                placeholder="-"
                                className={`w-10 px-1 py-0.5 bg-surface-300/50 border rounded text-white text-center text-xs font-medium focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
                                  isSaving ? 'border-blue-500/50' : local.isDirty ? 'border-yellow-500/50' : 'border-surface-50/30'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(local.maxBid) || 0
                                  updateLocalStrategy(player.playerId, 'maxBid', (current + 1).toString())
                                }}
                                className="w-5 h-5 rounded bg-surface-300/70 text-gray-400 hover:text-white hover:bg-surface-100 text-xs font-bold flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Priority - increased size #186 */}
                          <td className="p-2 text-center bg-indigo-500/5">
                            <div className="flex items-center justify-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => {
                                    const newPrio = local.priority === star ? 0 : star
                                    updateLocalStrategy(player.playerId, 'priority', newPrio)
                                  }}
                                  className={`w-5 h-5 text-sm transition-colors ${
                                    local.priority >= star
                                      ? 'text-purple-400 hover:text-purple-300'
                                      : 'text-gray-600 hover:text-gray-400'
                                  }`}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="p-2 bg-indigo-500/5">
                            <input
                              type="text"
                              value={local.notes}
                              onChange={(e) => updateLocalStrategy(player.playerId, 'notes', e.target.value)}
                              placeholder="Note..."
                              className={`w-full min-w-[60px] px-1 py-0.5 bg-surface-300/50 border rounded text-white text-xs focus:border-blue-500 focus:outline-none placeholder:text-gray-600 ${
                                isSaving ? 'border-blue-500/50' : local.isDirty ? 'border-yellow-500/50' : 'border-surface-50/30'
                              }`}
                            />
                          </td>

                          {/* Watchlist Category #219 */}
                          <td className="p-2 bg-indigo-500/5">
                            <select
                              value={player.preference?.watchlistCategory || ''}
                              onChange={(e) => setWatchlistCategory(player.playerId, e.target.value || null)}
                              className="w-full min-w-[80px] px-1 py-0.5 bg-surface-300/50 border border-surface-50/30 rounded text-xs focus:border-blue-500 focus:outline-none text-white"
                            >
                              <option value="">-</option>
                              {(Object.entries(WATCHLIST_CATEGORIES) as [WatchlistCategoryId, typeof WATCHLIST_CATEGORIES[WatchlistCategoryId]][]).map(([catId, cat]) => (
                                <option key={catId} value={catId}>{cat.icon} {cat.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    Nessun giocatore trovato
                  </div>
                )}
              </div>}

              {/* Legend */}
              <div className="p-3 border-t border-surface-50/20 bg-surface-300/20 text-[10px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                <span><b className="text-accent-400">Ing.</b> = Ingaggio</span>
                <span><b>Dur.</b> = Durata contratto (semestri)</span>
                <span><b className="text-orange-400">Cls</b> = Clausola rescissoria</span>
                <span><b>Rub.</b> = Prezzo rubata</span>
                <span><b>Max</b> = Offerta massima</span>
                <span><b>★</b> = Priorità (1-3)</span>
                <span><b>Rat</b> = Rating medio</span>
                <span><b>Gol</b> / <b>Ass</b> = Gol / Assist</span>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-surface-50/20 bg-surface-300/20 text-xs text-gray-500 flex flex-wrap justify-between gap-2">
                <span>
                  {filteredPlayers.length} giocatori
                  {viewMode === 'myRoster' && ' (la mia rosa)'}
                  {viewMode === 'owned' && ' (altre rose)'}
                  {viewMode === 'svincolati' && ' (svincolati)'}
                  {viewMode === 'all' && ` (${filteredPlayers.filter(p => p.type === 'myRoster').length} miei, ${filteredPlayers.filter(p => p.type === 'owned').length} altri, ${filteredPlayers.filter(p => p.type === 'svincolato').length} svinc.)`}
                </span>
                {viewMode !== 'myRoster' && (
                  <span className="text-indigo-400">{myStrategiesCount} strategie impostate</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        isOpen={!!selectedPlayerStats}
        onClose={() => setSelectedPlayerStats(null)}
        player={selectedPlayerStats}
      />

      {/* Player Compare Modal (#187) */}
      {showCompareModal && playersToCompare.length >= 2 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-surface-50/20 bg-gradient-to-r from-cyan-500/10 to-surface-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Confronto Giocatori</h2>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-50/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Player Cards Header */}
              <div className="flex flex-wrap justify-center gap-6 mb-8">
                {playersToCompare.map((player, idx) => {
                  const photoUrl = getPlayerPhotoUrl(player.playerApiFootballId)
                  const posColors = POSITION_COLORS[player.playerPosition] ?? { bg: 'bg-gradient-to-r from-gray-500 to-gray-600', text: 'text-white' }

                  return (
                    <div key={player.playerId} className="flex flex-col items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full mb-1"
                        style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                      />
                      <div className="relative">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={player.playerName}
                            className="w-16 h-16 rounded-full object-cover bg-surface-300 border-3 border-surface-50/20"
                            style={{ borderColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            className={`w-16 h-16 rounded-full ${posColors.bg} ${posColors.text} flex items-center justify-center font-bold text-xl`}
                          >
                            {player.playerPosition}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${posColors.bg} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
                        >
                          {player.playerPosition}
                        </span>
                      </div>
                      <span className="font-medium text-white">{player.playerName}</span>
                      <div className="flex items-center gap-1">
                        <img
                          src={getTeamLogo(player.playerTeam)}
                          alt={player.playerTeam}
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <span className="text-sm text-gray-400">{player.playerTeam}</span>
                      </div>
                      {player.type !== 'svincolato' && (
                        <span className="text-lg font-bold text-primary-400">Quot. {player.playerQuotation}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Radar Charts - different for goalkeepers vs outfield players */}
              {(() => {
                const allGoalkeepers = playersToCompare.every(p => p.playerPosition === 'P')
                const hasGoalkeepers = playersToCompare.some(p => p.playerPosition === 'P')

                if (allGoalkeepers) {
                  // All goalkeepers - show goalkeeper-specific radar charts
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      {/* Goalkeeper Performance Radar */}
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <h3 className="text-center text-yellow-400 font-semibold mb-4">🧤 Performance Portiere</h3>
                        <RadarChart
                          size={280}
                          players={playersToCompare.map((p, i) => ({
                            name: p.playerName,
                            color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                          }))}
                          data={[
                            { label: 'Parate', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.saves ?? 0) },
                            { label: 'Rig. Parati', values: playersToCompare.map(p => (p.playerApiFootballStats?.penalty?.saved ?? 0) * 10) },
                            { label: 'Rating', values: playersToCompare.map(p => Math.round((Number(p.playerApiFootballStats?.games?.rating) || 0) * 10)) },
                            { label: 'Presenze', values: playersToCompare.map(p => p.playerApiFootballStats?.games?.appearences ?? 0) },
                            { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.games?.minutes ?? 0) / 100)) },
                            { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.passes?.total ?? 0) / 10)) },
                          ]}
                        />
                      </div>

                      {/* Goalkeeper Goals Conceded Radar */}
                      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                        <h3 className="text-center text-yellow-400 font-semibold mb-4">🧤 Gol Subiti (meno è meglio)</h3>
                        <RadarChart
                          size={280}
                          players={playersToCompare.map((p, i) => ({
                            name: p.playerName,
                            color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                          }))}
                          data={[
                            { label: 'Gol Subiti', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.conceded ?? 0) },
                            { label: 'Prec. Pass', values: playersToCompare.map(p => p.playerApiFootballStats?.passes?.accuracy ?? 0) },
                            { label: 'Gialli', values: playersToCompare.map(p => (p.playerApiFootballStats?.cards?.yellow ?? 0) * 5) },
                            { label: 'Rossi', values: playersToCompare.map(p => (p.playerApiFootballStats?.cards?.red ?? 0) * 20) },
                          ]}
                        />
                      </div>
                    </div>
                  )
                }

                // Mixed or outfield players - show standard radar charts
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {hasGoalkeepers && (
                      <div className="col-span-full text-center text-sm text-yellow-400 bg-yellow-500/10 rounded-lg p-2 mb-2">
                        ⚠️ Confronto misto portieri/giocatori - alcune statistiche potrebbero non essere comparabili
                      </div>
                    )}
                    {/* Offensive Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Offensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.playerName,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Gol', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.total ?? 0) },
                          { label: 'Assist', values: playersToCompare.map(p => p.playerApiFootballStats?.goals?.assists ?? 0) },
                          { label: 'Tiri', values: playersToCompare.map(p => p.playerApiFootballStats?.shots?.total ?? 0) },
                          { label: 'Tiri Porta', values: playersToCompare.map(p => p.playerApiFootballStats?.shots?.on ?? 0) },
                          { label: 'Dribbling', values: playersToCompare.map(p => p.playerApiFootballStats?.dribbles?.success ?? 0) },
                          { label: 'Pass Chiave', values: playersToCompare.map(p => p.playerApiFootballStats?.passes?.key ?? 0) },
                        ]}
                      />
                    </div>

                    {/* Defensive/General Stats Radar */}
                    <div className="bg-surface-300/50 rounded-xl p-4">
                      <h3 className="text-center text-white font-semibold mb-4">Statistiche Difensive</h3>
                      <RadarChart
                        size={280}
                        players={playersToCompare.map((p, i) => ({
                          name: p.playerName,
                          color: PLAYER_CHART_COLORS[i % PLAYER_CHART_COLORS.length]
                        }))}
                        data={[
                          { label: 'Contrasti', values: playersToCompare.map(p => p.playerApiFootballStats?.tackles?.total ?? 0) },
                          { label: 'Intercetti', values: playersToCompare.map(p => p.playerApiFootballStats?.tackles?.interceptions ?? 0) },
                          { label: 'Passaggi', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.passes?.total ?? 0) / 10)) },
                          { label: 'Presenze', values: playersToCompare.map(p => p.playerApiFootballStats?.games?.appearences ?? 0) },
                          { label: 'Rating', values: playersToCompare.map(p => Math.round((Number(p.playerApiFootballStats?.games?.rating) || 0) * 10)) },
                          { label: 'Minuti', values: playersToCompare.map(p => Math.round((p.playerApiFootballStats?.games?.minutes ?? 0) / 100)) },
                        ]}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Detailed Stats Table */}
              <div className="bg-surface-300/30 rounded-xl overflow-hidden">
                <h3 className="text-white font-semibold p-4 border-b border-surface-50/10">Dettaglio Statistiche</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-300/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Statistica</th>
                        {playersToCompare.map((player, idx) => (
                          <th key={player.playerId} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PLAYER_CHART_COLORS[idx % PLAYER_CHART_COLORS.length] }}
                              />
                              <span className="text-sm font-medium text-white">{player.playerName}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-50/10">
                      {/* Basic info: Squadra, Età */}
                      <tr className="hover:bg-surface-300/30">
                        <td className="px-4 py-3 text-sm text-gray-300">Squadra</td>
                        {playersToCompare.map(player => (
                          <td key={player.playerId} className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-5 h-5 flex-shrink-0">
                                <TeamLogo team={player.playerTeam} />
                              </div>
                              <span className="text-sm text-gray-300">{player.playerTeam}</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                      <tr className="hover:bg-surface-300/30">
                        <td className="px-4 py-3 text-sm text-gray-300">Età</td>
                        {playersToCompare.map(player => (
                          <td key={player.playerId} className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded ${getAgeBgColor(player.playerAge)}`}>
                              {player.playerAge != null ? `${player.playerAge} anni` : '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                      {/* Contract info - only for non-svincolati */}
                      {playersToCompare.some(p => p.type !== 'svincolato') && (
                        <>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Quotazione</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-white">
                                {player.type !== 'svincolato' ? `${player.playerQuotation}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Ingaggio</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-accent-400">
                                {player.type !== 'svincolato' ? `${player.contractSalary}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Durata</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-white">
                                {player.type !== 'svincolato' ? `${player.contractDuration} stagioni` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Clausola</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-orange-400">
                                {player.type !== 'svincolato' ? `${player.contractClause}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">Prezzo Rubata</td>
                            {playersToCompare.map(player => (
                              <td key={player.playerId} className="px-4 py-3 text-center font-medium text-warning-400">
                                {player.type !== 'svincolato' ? `${player.rubataPrice}M` : '-'}
                              </td>
                            ))}
                          </tr>
                        </>
                      )}
                      {/* Stats - includes goalkeeper-specific stats */}
                      {[
                        { label: 'Presenze', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.appearences },
                        { label: 'Minuti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.minutes },
                        { label: 'Rating', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.games?.rating, format: (v: number | null) => v != null ? Number(v).toFixed(2) : '-' },
                        // Goalkeeper-specific stats
                        { label: '🧤 Parate', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.goals?.saves : null, colorClass: 'text-yellow-400', goalkeeperOnly: true },
                        { label: '🧤 Gol Subiti', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.goals?.conceded : null, colorClass: 'text-yellow-400', goalkeeperOnly: true, lowerIsBetter: true },
                        { label: '🧤 Rigori Parati', getValue: (p: DisplayPlayer) => p.playerPosition === 'P' ? p.playerApiFootballStats?.penalty?.saved : null, colorClass: 'text-yellow-400', goalkeeperOnly: true },
                        // Outfield stats
                        { label: 'Gol', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.goals?.total, colorClass: 'text-secondary-400' },
                        { label: 'Assist', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.goals?.assists, colorClass: 'text-primary-400' },
                        { label: 'Tiri Totali', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.shots?.total },
                        { label: 'Tiri in Porta', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.shots?.on },
                        { label: 'Contrasti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.tackles?.total },
                        { label: 'Intercetti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.tackles?.interceptions },
                        { label: 'Passaggi Chiave', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.passes?.key },
                        { label: 'Precisione Passaggi', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.passes?.accuracy, format: (v: number | null) => v != null ? `${v}%` : '-' },
                        { label: 'Dribbling Riusciti', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.dribbles?.success },
                        { label: 'Ammonizioni', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.cards?.yellow, colorClass: 'text-warning-400' },
                        { label: 'Espulsioni', getValue: (p: DisplayPlayer) => p.playerApiFootballStats?.cards?.red, colorClass: 'text-danger-400' },
                      ].filter(row => {
                        // Hide goalkeeper-only rows if no goalkeepers in comparison
                        if ((row as { goalkeeperOnly?: boolean }).goalkeeperOnly) {
                          return playersToCompare.some(p => p.playerPosition === 'P')
                        }
                        return true
                      }).map(row => {
                        const values = playersToCompare.map(p => {
                          const val = row.getValue(p)
                          return val != null ? Number(val) : 0
                        })
                        const maxVal = Math.max(...values.filter(v => v > 0))

                        return (
                          <tr key={row.label} className="hover:bg-surface-300/30">
                            <td className="px-4 py-3 text-sm text-gray-300">{row.label}</td>
                            {playersToCompare.map((player, idx) => {
                              const val = values[idx]
                              const isMax = val === maxVal && maxVal > 0
                              const formatted = row.format ? row.format(val || null) : (val || '-')

                              return (
                                <td
                                  key={player.playerId}
                                  className={`px-4 py-3 text-center font-medium ${
                                    isMax ? 'text-secondary-400' : row.colorClass || 'text-white'
                                  }`}
                                >
                                  {isMax && maxVal > 0 && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-secondary-400 mr-2" />
                                  )}
                                  {formatted}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
