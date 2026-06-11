import type { MarketProgress } from '../../types/auctionroom.types'
import { POSITION_FILTER_COLORS, POSITION_NAMES } from '../ui/PositionBadge'

interface RoleProgressRailProps {
  marketProgress: MarketProgress | null
  isPrimoMercato: boolean
}

/**
 * Dedicated row under the StatusBar showing where the market is:
 * role sequence as a process stepper (done ✓ / active / upcoming)
 * plus the league-wide slot progress.
 */
export function RoleProgressRail({ marketProgress, isPrimoMercato }: RoleProgressRailProps) {
  if (!isPrimoMercato || !marketProgress) return null

  const currentIndex = marketProgress.roleSequence.indexOf(marketProgress.currentRole)
  const progressPercent = marketProgress.totalSlots > 0
    ? Math.round((marketProgress.filledSlots / marketProgress.totalSlots) * 100)
    : 0

  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        {marketProgress.roleSequence.map((role, i) => {
          const isDone = currentIndex >= 0 && i < currentIndex
          const isActive = role === marketProgress.currentRole
          return (
            <span
              key={role}
              className={`px-2 py-1 rounded-lg text-sm font-bold border flex items-center gap-1 ${
                isActive
                  ? POSITION_FILTER_COLORS[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  : isDone
                    ? 'bg-slate-800/60 text-gray-400 border-white/10'
                    : 'bg-slate-800/40 text-gray-600 border-white/5'
              }`}
            >
              {isDone && (
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {(POSITION_NAMES[role] || role).slice(0, 3)}
              {isActive && <span className="hidden sm:inline font-semibold normal-case text-sm opacity-80">· in corso</span>}
            </span>
          )
        })}
      </div>

      {/* League slot progress */}
      <div className="ml-auto flex items-center gap-2 min-w-[120px] flex-1 sm:flex-none sm:w-44">
        <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-secondary-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="text-sm text-gray-400 font-mono flex-shrink-0">
          {marketProgress.filledSlots}/{marketProgress.totalSlots}
        </span>
      </div>
    </div>
  )
}
