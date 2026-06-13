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
  targetMember?: LeagueMember
  /** Mobile-only: lets the partner panel pick the recipient when none chosen yet. */
  members?: LeagueMember[]
  selectedMemberId?: string
  onMemberChange?: (id: string) => void
  /** When true the panel uses inline (non-cockpit) height — for mobile BottomSheet. */
  variant?: 'cockpit' | 'sheet'
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
    targetMember,
    members = [],
    selectedMemberId = '',
    onMemberChange,
    variant = 'cockpit',
    onViewStats,
  } = props

  const isMine = side === 'mine'
  const roster = isMine ? myRoster : filteredPlayers
  const partnerName = targetMember?.user.username
  const heightClass = variant === 'sheet' ? 'max-h-[70vh]' : 'h-full'

  return (
    <div className={`bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col min-h-0 ${heightClass}`}>
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-surface-50 flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <h3 className="micro-label">
            {isMine
              ? 'La mia rosa · scegli chi cedere'
              : partnerName
                ? `Rosa di ${partnerName} · scegli cosa chiedere`
                : 'Rosa partner · scegli un destinatario'}
          </h3>
          <span className="ml-auto font-mono text-[10.5px] text-gray-500">{roster.length}</span>
        </div>
        {isMine && myBudget != null && (
          <p className="mt-1 text-xs text-gray-500">
            Budget <span className="budget-display text-accent-400">{myBudget}M</span>
          </p>
        )}
      </div>

      {/* Partner: recipient selector (mobile only — cockpit picks it in DealTable) + search + role filter */}
      {!isMine && (
        <div className="px-3 py-2.5 border-b border-surface-50 space-y-2 flex-shrink-0">
          {onMemberChange && (
            <select
              value={selectedMemberId}
              onChange={e => { onMemberChange(e.target.value); }}
              className="lg:hidden w-full px-2.5 py-2 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Seleziona destinatario…</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.user.username}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="Cerca giocatore…"
            className="w-full px-2.5 py-2 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm focus:border-primary-500 focus:outline-none placeholder:text-gray-500"
          />
          <div className="flex gap-1.5">
            {ROLES.map(r => {
              const isActive = filterRole === r.key
              const filterColor = r.key ? (POSITION_FILTER_COLORS[r.key] ?? '') : ''
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onFilterRoleChange?.(r.key)}
                  className={`flex-1 py-1.5 rounded-full font-mono text-[9.5px] font-bold border transition-colors ${
                    isActive
                      ? (r.key ? filterColor : 'bg-surface-100 text-white border-surface-50')
                      : 'text-gray-500 border-surface-50 hover:text-gray-300'
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
      <div className="panel-scroll flex-1 min-h-0">
        {roster.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm px-4 text-center">
            {isMine ? 'Nessun giocatore in rosa' : (partnerName || selectedMemberId ? 'Nessun giocatore trovato' : 'Seleziona un destinatario nel tavolo')}
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
    </div>
  )
}
