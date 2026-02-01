/**
 * FilterSidebar - Collapsible filter sidebar for Strategie page
 * Part of Sprint 2: Layout 3 Colonne
 */

import { useState } from 'react'
import { POSITION_COLORS } from './ui/PositionBadge'

interface FilterSidebarProps {
  // Filter values
  positionFilter: string
  viewMode: 'myRoster' | 'owned' | 'svincolati' | 'all'
  dataViewMode: 'contracts' | 'stats' | 'merge'
  searchQuery: string
  showOnlyWithStrategy: boolean
  ownerFilter: string
  teamFilter: string

  // Filter setters
  setPositionFilter: (value: string) => void
  setViewMode: (value: 'myRoster' | 'owned' | 'svincolati' | 'all') => void
  setDataViewMode: (value: 'contracts' | 'stats' | 'merge') => void
  setSearchQuery: (value: string) => void
  setShowOnlyWithStrategy: (value: boolean) => void
  setOwnerFilter: (value: string) => void
  setTeamFilter: (value: string) => void

  // Data for filters
  uniqueOwners: Array<{ username: string; teamName: string }>
  uniqueTeams: string[]

  // Counts for badges
  counts: {
    myRoster: number
    owned: number
    svincolati: number
    total: number
    filtered: number
  }

  // Collapse state
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function FilterSidebar({
  positionFilter,
  viewMode,
  dataViewMode,
  searchQuery,
  showOnlyWithStrategy,
  ownerFilter,
  teamFilter,
  setPositionFilter,
  setViewMode,
  setDataViewMode,
  setSearchQuery,
  setShowOnlyWithStrategy,
  setOwnerFilter,
  setTeamFilter,
  uniqueOwners,
  uniqueTeams,
  counts,
  isCollapsed = false,
  onToggleCollapse,
}: FilterSidebarProps) {
  // Section collapse states
  const [sectionsOpen, setSectionsOpen] = useState({
    scope: true,
    position: true,
    dataView: true,
    filters: true,
  })

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-surface-200 rounded-2xl border border-surface-50/20 p-2 flex flex-col items-center gap-3">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          title="Espandi filtri"
        >
          <span className="text-lg">☰</span>
        </button>

        {/* Quick position filters - vertical */}
        <div className="flex flex-col gap-1">
          {['P', 'D', 'C', 'A'].map(pos => {
            const colors = POSITION_COLORS[pos] ?? { bg: 'bg-white/20', text: 'text-white', border: '' }
            return (
              <button
                key={pos}
                onClick={() => setPositionFilter(positionFilter === pos ? 'ALL' : pos)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                  positionFilter === pos
                    ? `${colors.bg} ${colors.text}`
                    : 'bg-surface-300 text-gray-500 hover:text-gray-300'
                }`}
                title={pos}
              >
                {pos}
              </button>
            )
          })}
        </div>

        {/* Strategy filter */}
        <button
          onClick={() => setShowOnlyWithStrategy(!showOnlyWithStrategy)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            showOnlyWithStrategy
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'bg-surface-300 text-gray-500 hover:text-gray-300'
          }`}
          title="Solo con strategia"
        >
          <span>⭐</span>
        </button>

        {/* Count badge */}
        <div className="mt-auto px-2 py-1 bg-surface-300 rounded text-xs text-gray-400 text-center">
          {counts.filtered}
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-surface-50/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>🎛️</span>
          Filtri
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            title="Comprimi filtri"
          >
            <span className="text-xs">◀</span>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-surface-50/20">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Cerca giocatore..."
          className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm placeholder-gray-500"
        />
      </div>

      {/* Scrollable content */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {/* Scope Section */}
        <div className="border-b border-surface-50/20">
          <button
            onClick={() => toggleSection('scope')}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <span>📂 Ambito</span>
            <span className="text-xs text-gray-500">{sectionsOpen.scope ? '▼' : '▶'}</span>
          </button>
          {sectionsOpen.scope && (
            <div className="px-3 pb-3 space-y-1">
              <button
                onClick={() => { setViewMode('myRoster'); setOwnerFilter('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  viewMode === 'myRoster'
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                <span>🏠 La Mia Rosa</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  viewMode === 'myRoster' ? 'bg-white/20' : 'bg-primary-500/20 text-primary-400'
                }`}>
                  {counts.myRoster}
                </span>
              </button>
              <button
                onClick={() => { setViewMode('owned'); setOwnerFilter('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  viewMode === 'owned'
                    ? 'bg-blue-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                <span>👥 Altre Rose</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  viewMode === 'owned' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {counts.owned}
                </span>
              </button>
              <button
                onClick={() => { setViewMode('svincolati'); setOwnerFilter('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  viewMode === 'svincolati'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                <span>🆓 Svincolati</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  viewMode === 'svincolati' ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {counts.svincolati}
                </span>
              </button>
              <button
                onClick={() => { setViewMode('all'); setOwnerFilter('ALL'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  viewMode === 'all'
                    ? 'bg-purple-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                <span>🌐 Tutti</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  viewMode === 'all' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {counts.total}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Position Section */}
        <div className="border-b border-surface-50/20">
          <button
            onClick={() => toggleSection('position')}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <span>🎯 Ruolo</span>
            <span className="text-xs text-gray-500">{sectionsOpen.position ? '▼' : '▶'}</span>
          </button>
          {sectionsOpen.position && (
            <div className="px-3 pb-3">
              <div className="flex gap-1 flex-wrap">
                {['ALL', 'P', 'D', 'C', 'A'].map(pos => {
                  const colors = POSITION_COLORS[pos] ?? { bg: 'bg-white/20', text: 'text-white', border: '' }
                  return (
                    <button
                      key={pos}
                      onClick={() => setPositionFilter(pos)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
            </div>
          )}
        </div>

        {/* Data View Section */}
        <div className="border-b border-surface-50/20">
          <button
            onClick={() => toggleSection('dataView')}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <span>📊 Vista Dati</span>
            <span className="text-xs text-gray-500">{sectionsOpen.dataView ? '▼' : '▶'}</span>
          </button>
          {sectionsOpen.dataView && (
            <div className="px-3 pb-3 space-y-1">
              <button
                onClick={() => setDataViewMode('contracts')}
                className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-all ${
                  dataViewMode === 'contracts'
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                📋 Contratti
              </button>
              <button
                onClick={() => setDataViewMode('stats')}
                className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-all ${
                  dataViewMode === 'stats'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                📊 Statistiche
              </button>
              <button
                onClick={() => setDataViewMode('merge')}
                className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-all ${
                  dataViewMode === 'merge'
                    ? 'bg-violet-500 text-white'
                    : 'bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300'
                }`}
              >
                🔀 Merge
              </button>
            </div>
          )}
        </div>

        {/* Additional Filters Section */}
        <div className="border-b border-surface-50/20">
          <button
            onClick={() => toggleSection('filters')}
            className="w-full p-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <span>🔧 Altri Filtri</span>
            <span className="text-xs text-gray-500">{sectionsOpen.filters ? '▼' : '▶'}</span>
          </button>
          {sectionsOpen.filters && (
            <div className="px-3 pb-3 space-y-3">
              {/* Owner filter */}
              {(viewMode === 'owned' || viewMode === 'all') && uniqueOwners.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Manager</label>
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    className="w-full px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                  >
                    <option value="ALL">Tutti i manager</option>
                    {uniqueOwners.map(o => (
                      <option key={o.username} value={o.username}>{o.teamName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Team filter */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Squadra Serie A</label>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-xs"
                >
                  <option value="ALL">Tutte le squadre</option>
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {/* Strategy filter */}
              <label className="flex items-center gap-2 cursor-pointer px-2 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
                <input
                  type="checkbox"
                  checked={showOnlyWithStrategy}
                  onChange={(e) => setShowOnlyWithStrategy(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-300 border-indigo-500/50 text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-xs text-indigo-300 font-medium">⭐ Solo con strategia</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t border-surface-50/20 bg-surface-300/30">
        <div className="text-center">
          <span className="text-lg font-bold text-white">{counts.filtered}</span>
          <span className="text-xs text-gray-400 ml-1">giocatori</span>
        </div>
      </div>
    </div>
  )
}

export default FilterSidebar
