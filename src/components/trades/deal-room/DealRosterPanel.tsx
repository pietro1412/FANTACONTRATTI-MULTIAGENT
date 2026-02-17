import { DealAssetCard } from './DealAssetCard'
import { POSITION_FILTER_COLORS } from '../../ui/PositionBadge'
import type { RosterEntry, LeagueMember } from '../types'

interface DealRosterPanelProps {
  side: 'mine' | 'partner'
  // Mine
  myRoster?: RosterEntry[]
  selectedOfferedPlayers?: string[]
  onToggleOffered?: (id: string) => void
  myBudget?: number
  // Partner
  filteredPlayers?: RosterEntry[]
  selectedRequestedPlayers?: string[]
  onToggleRequested?: (entry: RosterEntry) => void
  searchQuery?: string
  onSearchChange?: (q: string) => void
  filterRole?: string
  onFilterRoleChange?: (r: string) => void
  members?: LeagueMember[]
  selectedMemberId?: string
  onMemberChange?: (id: string) => void
  targetMember?: LeagueMember
  // Player stats
  onViewStats?: (entry: RosterEntry) => void
}

const ROLES: { key: string; label: string }[] = [
  { key: '', label: 'Tutti' },
  { key: 'P', label: 'P' },
  { key: 'D', label: 'D' },
  { key: 'C', label: 'C' },
  { key: 'A', label: 'A' },
]

export function DealRosterPanel(props: DealRosterPanelProps) {
  const {
    side,
    myRoster = [],
    selectedOfferedPlayers = [],
    onToggleOffered,
    myBudget,
    filteredPlayers = [],
    selectedRequestedPlayers = [],
    onToggleRequested,
    searchQuery = '',
    onSearchChange,
    filterRole = '',
    onFilterRoleChange,
    members = [],
    selectedMemberId = '',
    onMemberChange,
    targetMember,
    onViewStats,
  } = props

  const isMine = side === 'mine'
  const roster = isMine ? myRoster : filteredPlayers
  const selectedCount = isMine ? selectedOfferedPlayers.length : selectedRequestedPlayers.length

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMine ? (
            <svg className="w-4 h-4 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <h3 className="text-base font-bold text-white">
            {isMine ? 'La Mia Rosa' : (targetMember ? targetMember.user.username : 'Rosa Partner')}
          </h3>
          {selectedCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isMine ? 'bg-danger-500/20 text-danger-400' : 'bg-primary-500/20 text-primary-400'}`}>
              {selectedCount}
            </span>
          )}
        </div>
        {isMine && myBudget != null && (
          <span className="text-sm text-gray-400">
            Budget: <span className="text-white font-mono font-semibold">{myBudget}</span>
          </span>
        )}
      </div>

      {/* Partner filters */}
      {!isMine && (
        <div className="px-3 py-2.5 border-b border-white/5 space-y-2">
          {/* DG selector */}
          <select
            value={selectedMemberId}
            onChange={e => onMemberChange?.(e.target.value)}
            className="w-full px-2.5 py-2 bg-surface-300 border border-white/10 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Seleziona DG...</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.user.username}</option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="Cerca giocatore..."
            className="w-full px-2.5 py-2 bg-surface-300 border border-white/10 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none placeholder:text-gray-500"
          />

          {/* Role tabs */}
          <div className="flex gap-1">
            {ROLES.map(r => {
              const isActive = filterRole === r.key
              const filterColor = r.key ? POSITION_FILTER_COLORS[r.key as keyof typeof POSITION_FILTER_COLORS] : ''
              return (
                <button
                  key={r.key}
                  onClick={() => onFilterRoleChange?.(r.key)}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors border ${
                    isActive
                      ? (r.key ? filterColor : 'bg-white/10 text-white border-white/20')
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {roster.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            {isMine ? 'Nessun giocatore in rosa' : (selectedMemberId ? 'Nessun giocatore trovato' : 'Seleziona un DG')}
          </div>
        ) : (
          roster.map(entry => (
            <DealAssetCard
              key={entry.id}
              entry={entry}
              isSelected={isMine ? selectedOfferedPlayers.includes(entry.id) : selectedRequestedPlayers.includes(entry.id)}
              onToggle={() => {
                if (isMine) {
                  onToggleOffered?.(entry.id)
                } else {
                  onToggleRequested?.(entry)
                }
              }}
              side={side}
              onViewStats={onViewStats}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      {selectedCount > 0 && (
        <div className={`px-4 py-2.5 border-t border-white/5 text-sm font-medium ${isMine ? 'text-danger-400' : 'text-primary-400'}`}>
          {selectedCount} giocator{selectedCount === 1 ? 'e' : 'i'} selezionat{selectedCount === 1 ? 'o' : 'i'}
        </div>
      )}
    </div>
  )
}
