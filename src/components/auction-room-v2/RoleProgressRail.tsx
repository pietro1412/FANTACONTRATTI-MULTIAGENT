import type { MarketProgress, MyRosterSlots } from '../../types/auctionroom.types'
import { POSITION_FILTER_COLORS } from '../ui/PositionBadge'

interface RoleProgressRailProps {
  marketProgress: MarketProgress | null
  isPrimoMercato: boolean
  myRosterSlots?: MyRosterSlots | null
}

/**
 * Dedicated row under the StatusBar: the role sequence as a process stepper
 * (done ✓ / active / upcoming) with MY slot counts per role, plus the
 * league-wide slot progress.
 */
export function RoleProgressRail({ marketProgress, isPrimoMercato, myRosterSlots }: RoleProgressRailProps) {
  if (!isPrimoMercato || !marketProgress) return null

  const currentIndex = marketProgress.roleSequence.indexOf(marketProgress.currentRole)
  const progressPercent = marketProgress.totalSlots > 0
    ? Math.round((marketProgress.filledSlots / marketProgress.totalSlots) * 100)
    : 0

  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 sm:gap-1.5">
        {marketProgress.roleSequence.map((role, i) => {
          const isDone = currentIndex >= 0 && i < currentIndex
          const isActive = role === marketProgress.currentRole
          const mySlot = myRosterSlots?.slots[role as 'P' | 'D' | 'C' | 'A']
          return (
            <span key={role} className="flex items-center gap-1 sm:gap-1.5">
              {i > 0 && <span className="text-gray-600 text-sm">›</span>}
              <span
                className={`px-2 py-1 rounded-lg text-sm font-bold border flex items-center gap-1 ${
                  isActive
                    ? POSITION_FILTER_COLORS[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    : isDone
                      ? 'bg-surface-300 text-gray-400 border-surface-50'
                      : 'bg-surface-300/50 text-gray-600 border-surface-50/60'
                }`}
              >
                {role}
                {isDone && (
                  <svg className="w-3 h-3 text-secondary-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {isActive && <span className="hidden sm:inline uppercase text-sm tracking-wide">in corso</span>}
                {mySlot && (
                  <span className={`font-mono font-semibold ${isActive ? '' : 'opacity-70'}`}>
                    {mySlot.filled}/{mySlot.total}
                  </span>
                )}
              </span>
            </span>
          )
        })}
      </div>

      {/* League slot progress */}
      <div className="ml-auto flex items-center gap-2 min-w-[140px] flex-1 sm:flex-none sm:w-56">
        <span className="text-sm text-gray-500 uppercase tracking-wide font-semibold flex-shrink-0 hidden sm:inline">Slot lega</span>
        <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="stat-number text-sm text-gray-300 flex-shrink-0">
          {marketProgress.filledSlots}/{marketProgress.totalSlots}
        </span>
      </div>
    </div>
  )
}
