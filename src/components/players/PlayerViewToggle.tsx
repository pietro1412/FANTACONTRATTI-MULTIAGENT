import { List, BarChart3 } from 'lucide-react'

export type PlayerView = 'list' | 'stats'

export interface PlayerViewToggleProps {
  view: PlayerView
  onChange: (view: PlayerView) => void
  className?: string
}

const OPTIONS: { key: PlayerView; label: string; icon: React.ReactNode }[] = [
  { key: 'list', label: 'Lista', icon: <List size={13} /> },
  { key: 'stats', label: 'Statistiche', icon: <BarChart3 size={13} /> },
]

/**
 * Segmented Lista / Statistiche switch for the fused Giocatori page (mockup `.seg`).
 * Active segment uses the gold accent, matching the cockpit language.
 */
export function PlayerViewToggle({ view, onChange, className = '' }: PlayerViewToggleProps) {
  return (
    <div className={`inline-flex rounded-lg border border-surface-50 overflow-hidden flex-shrink-0 ${className}`}>
      {OPTIONS.map((opt, i) => {
        const active = view === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => { onChange(opt.key); }}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-display text-xs font-semibold transition-colors ${
              i > 0 ? 'border-l border-surface-50' : ''
            } ${active ? 'bg-accent-400 text-dark-300' : 'bg-surface-300 text-gray-400 hover:text-white'}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default PlayerViewToggle
