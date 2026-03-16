import { memo } from 'react'

export interface BoardViewToggleProps {
  mode: 'upcoming' | 'all'
  upcomingCount: number
  totalCount: number
  onToggle: (mode: 'upcoming' | 'all') => void
}

export const BoardViewToggle = memo(function BoardViewToggle({
  mode,
  upcomingCount,
  totalCount,
  onToggle,
}: BoardViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-surface-50/20 bg-surface-300/50 p-0.5">
      <button
        type="button"
        onClick={() => onToggle('upcoming')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
          mode === 'upcoming'
            ? 'bg-primary-500 text-white shadow-sm'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Prossimi {upcomingCount}
      </button>
      <button
        type="button"
        onClick={() => onToggle('all')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
          mode === 'all'
            ? 'bg-primary-500 text-white shadow-sm'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Tutti ({totalCount})
      </button>
    </div>
  )
})
