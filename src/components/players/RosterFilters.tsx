import { POSITION_FILTER_COLORS } from '@/components/ui/PositionBadge'

export interface RosterFiltersProps {
  positionFilter: string
  onPositionChange: (pos: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  className?: string
}

const POSITIONS = ['ALL', 'P', 'D', 'C', 'A'] as const

/**
 * Desktop role chips (P/D/C/A) + search box for the Rose / Giocatori cluster
 * cockpit bar. Mobile keeps the compact search + BottomSheet in the page.
 */
export function RosterFilters({
  positionFilter,
  onPositionChange,
  searchQuery,
  onSearchChange,
  className = '',
}: RosterFiltersProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {POSITIONS.map(pos => {
        const active = positionFilter === pos
        const colors = POSITION_FILTER_COLORS[pos]
        return (
          <button
            key={pos}
            type="button"
            onClick={() => { onPositionChange(pos); }}
            aria-pressed={active}
            className={`font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
              active
                ? pos === 'ALL'
                  ? 'bg-accent-400 text-dark-300 border-accent-400'
                  : (colors ?? '')
                : 'border-surface-50 text-gray-500 hover:text-gray-300'
            }`}
          >
            {pos === 'ALL' ? 'Tutti' : pos}
          </button>
        )
      })}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => { onSearchChange(e.target.value); }}
        placeholder="Cerca…"
        inputMode="search"
        enterKeyHint="search"
        className="w-32 sm:w-40 ml-1 px-3 py-1.5 bg-surface-300 border border-surface-50 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-accent-500/50"
      />
    </div>
  )
}

export default RosterFilters
