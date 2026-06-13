import { POSITION_FILTER_COLORS } from '@/components/ui/PositionBadge'

export interface PlayerRoleFilterProps {
  /** Active position ('' = all) */
  value: string
  onChange: (pos: string) => void
  className?: string
}

const POSITIONS = ['', 'P', 'D', 'C', 'A'] as const

/**
 * Role pill chips (Tutti / P / D / C / A) for the Giocatori cockpit bar, shared by
 * the Lista and Statistiche views. Empty string means "all". Matches the mockup
 * `.fchip` pills (gold = active "Tutti", domain colors for each role).
 */
export function PlayerRoleFilter({ value, onChange, className = '' }: PlayerRoleFilterProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {POSITIONS.map(pos => {
        const active = value === pos
        const colors = POSITION_FILTER_COLORS[pos]
        return (
          <button
            key={pos || 'all'}
            type="button"
            onClick={() => { onChange(pos); }}
            aria-pressed={active}
            className={`font-mono text-[9.5px] font-bold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
              active
                ? pos === ''
                  ? 'bg-accent-400 text-dark-300 border-accent-400'
                  : (colors ?? '')
                : 'border-surface-50 text-gray-500 hover:text-gray-300'
            }`}
          >
            {pos === '' ? 'Tutti' : pos}
          </button>
        )
      })}
    </div>
  )
}

export default PlayerRoleFilter
