/**
 * SeasonalitySparkbar - Mini bar chart showing monthly ratings (Sep-May)
 * Shows player performance across the football season with hot month highlighting
 */

import { useMemo } from 'react'

interface SeasonalitySparkbarProps {
  monthlyBreakdown: Record<string, number> // { sep: 6.2, oct: 6.4, ... }
  hotMonths: string[]
  currentMonth?: string
  showLabels?: boolean
  className?: string
}

// Month order for football season (Sep-May)
const SEASON_MONTHS = ['sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may']
const MONTH_LABELS = ['S', 'O', 'N', 'D', 'G', 'F', 'M', 'A', 'M']

function getBarColor(
  rating: number,
  isHot: boolean,
  isCurrent: boolean
): string {
  if (isCurrent) return 'bg-purple-400 animate-pulse'
  if (isHot) return 'bg-green-400'
  if (rating >= 7.0) return 'bg-green-500'
  if (rating >= 6.5) return 'bg-yellow-500'
  if (rating >= 6.0) return 'bg-orange-500'
  return 'bg-gray-600'
}

export function SeasonalitySparkbar({
  monthlyBreakdown,
  hotMonths,
  currentMonth,
  showLabels = true,
  className = '',
}: SeasonalitySparkbarProps) {
  const bars = useMemo(() => {
    return SEASON_MONTHS.map((month, idx) => {
      const rating = monthlyBreakdown[month] || 0
      const isHot = hotMonths.includes(month)
      const isCurrent = currentMonth === month
      // Normalize height: 5.0 = 0%, 8.0 = 100%
      const heightPercent =
        rating > 0 ? Math.max(10, Math.min(100, ((rating - 5) / 3) * 100)) : 0

      return {
        month,
        label: MONTH_LABELS[idx],
        rating,
        heightPercent,
        isHot,
        isCurrent,
        color: getBarColor(rating, isHot, isCurrent),
      }
    })
  }, [monthlyBreakdown, hotMonths, currentMonth])

  const hasData = bars.some((b) => b.rating > 0)

  if (!hasData) {
    return (
      <div
        className={`flex items-center justify-center h-8 text-xs text-gray-500 ${className}`}
      >
        N/D
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-0.5 h-8">
        {bars.map((bar) => (
          <div
            key={bar.month}
            className={`w-2 ${bar.color} rounded-t transition-all cursor-pointer hover:opacity-80`}
            style={{ height: `${bar.heightPercent}%` }}
            title={`${bar.month.toUpperCase()}: ${bar.rating || 'N/D'}${
              bar.isHot ? ' (hot)' : ''
            }`}
          />
        ))}
      </div>
      {showLabels && (
        <div className="flex gap-0.5 mt-0.5">
          {bars.map((bar) => (
            <span
              key={bar.month}
              className={`w-2 text-[8px] text-center ${
                bar.isHot
                  ? 'text-green-400 font-bold'
                  : bar.isCurrent
                    ? 'text-purple-400 font-bold'
                    : 'text-gray-600'
              }`}
            >
              {bar.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Badge component for hot months
interface HotMonthsBadgeProps {
  hotMonths: string[]
}

export function HotMonthsBadge({ hotMonths }: HotMonthsBadgeProps) {
  if (hotMonths.length === 0) return null

  // Determine season type based on hot months
  const hasSpring = hotMonths.some((m) => ['mar', 'apr', 'may'].includes(m))
  const hasAutumn = hotMonths.some((m) => ['sep', 'oct', 'nov'].includes(m))
  const hasWinter = hotMonths.some((m) => ['dec', 'jan', 'feb'].includes(m))

  let label = ''
  let icon = ''
  let colors = ''

  if (hasSpring && !hasAutumn && !hasWinter) {
    label = 'Spring Player'
    icon = '\uD83D\uDD25' // fire emoji
    colors = 'bg-orange-500/20 text-orange-400'
  } else if (hasAutumn && !hasSpring && !hasWinter) {
    label = 'Autumn Starter'
    icon = '\uD83C\uDF42' // fallen leaf emoji
    colors = 'bg-amber-500/20 text-amber-400'
  } else if (hasWinter && !hasSpring && !hasAutumn) {
    label = 'Winter Warrior'
    icon = '\u2744\uFE0F' // snowflake emoji
    colors = 'bg-cyan-500/20 text-cyan-400'
  } else {
    // Multiple peaks or consistent performer
    label = hotMonths
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1, 3))
      .join('-')
    icon = '\uD83D\uDCC8' // chart emoji
    colors = 'bg-green-500/20 text-green-400'
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${colors}`}
    >
      {icon} {label}
    </span>
  )
}

export default SeasonalitySparkbar
