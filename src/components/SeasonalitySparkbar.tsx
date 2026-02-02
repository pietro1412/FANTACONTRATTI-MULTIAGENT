/**
 * SeasonalitySparkbar - Player performance trend display
 * Shows average rating with color coding and hot months indicator
 *
 * New design: Clear rating number + visual indicator + hot period badge
 */

import { useMemo, useState } from 'react'

interface SeasonalitySparkbarProps {
  monthlyBreakdown: Record<string, number> // { sep: 6.2, oct: 6.4, ... }
  hotMonths: string[]
  avgRating?: number
  matchCount?: number
  currentMonth?: string
  className?: string
}

// Month display names
const MONTH_NAMES: Record<string, string> = {
  aug: 'Ago',
  sep: 'Set',
  oct: 'Ott',
  nov: 'Nov',
  dec: 'Dic',
  jan: 'Gen',
  feb: 'Feb',
  mar: 'Mar',
  apr: 'Apr',
  may: 'Mag',
}

// Get rating color based on value
function getRatingColor(rating: number): { bg: string; text: string; label: string } {
  if (rating >= 7.0) return { bg: 'bg-green-500', text: 'text-green-400', label: 'Ottimo' }
  if (rating >= 6.5) return { bg: 'bg-lime-500', text: 'text-lime-400', label: 'Buono' }
  if (rating >= 6.0) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'Sufficiente' }
  if (rating >= 5.5) return { bg: 'bg-orange-500', text: 'text-orange-400', label: 'Mediocre' }
  return { bg: 'bg-red-500', text: 'text-red-400', label: 'Scarso' }
}

// Get trend icon based on monthly data
function getTrendIcon(monthlyBreakdown: Record<string, number>): { icon: string; label: string } | null {
  const months = Object.entries(monthlyBreakdown).sort((a, b) => {
    const order = ['aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may']
    return order.indexOf(a[0]) - order.indexOf(b[0])
  })

  if (months.length < 2) return null

  const first = months[0][1]
  const last = months[months.length - 1][1]
  const diff = last - first

  if (diff > 0.3) return { icon: '📈', label: 'In crescita' }
  if (diff < -0.3) return { icon: '📉', label: 'In calo' }
  return { icon: '➡️', label: 'Stabile' }
}

export function SeasonalitySparkbar({
  monthlyBreakdown,
  hotMonths,
  avgRating,
  matchCount,
  className = '',
}: SeasonalitySparkbarProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const stats = useMemo(() => {
    const ratings = Object.values(monthlyBreakdown).filter(r => r > 0)
    if (ratings.length === 0) return null

    const avg = avgRating ?? (ratings.reduce((a, b) => a + b, 0) / ratings.length)
    const colors = getRatingColor(avg)
    const trend = getTrendIcon(monthlyBreakdown)

    // Format hot months
    const hotPeriod = hotMonths.length > 0
      ? hotMonths.map(m => MONTH_NAMES[m] || m).join('-')
      : null

    return {
      avg: avg.toFixed(1),
      colors,
      trend,
      hotPeriod,
      monthsWithData: Object.entries(monthlyBreakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ month: MONTH_NAMES[k] || k, rating: v.toFixed(1) })),
      matches: matchCount || ratings.length,
    }
  }, [monthlyBreakdown, hotMonths, avgRating, matchCount])

  if (!stats) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-600 ${className}`}>
        <span className="opacity-50">—</span>
      </div>
    )
  }

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Main display: Rating + Trend */}
      <div className="flex items-center justify-center gap-1.5">
        {/* Rating number with color indicator */}
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${stats.colors.bg}`} />
          <span className={`text-sm font-bold ${stats.colors.text}`}>
            {stats.avg}
          </span>
        </div>

        {/* Trend icon */}
        {stats.trend && (
          <span className="text-xs" title={stats.trend.label}>
            {stats.trend.icon}
          </span>
        )}
      </div>

      {/* Hot period badge (if exists) */}
      {stats.hotPeriod && (
        <div className="flex justify-center mt-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
            🔥 {stats.hotPeriod}
          </span>
        </div>
      )}

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-surface-100 border border-surface-50/30 rounded-lg shadow-xl min-w-[180px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-50/20">
            <span className="text-xs text-gray-400">Performance</span>
            <span className={`text-sm font-bold ${stats.colors.text}`}>
              {stats.avg} {stats.colors.label}
            </span>
          </div>

          {/* Monthly breakdown */}
          <div className="space-y-1">
            {stats.monthsWithData.map(({ month, rating }) => {
              const r = parseFloat(rating)
              const colors = getRatingColor(r)
              const barWidth = Math.max(20, Math.min(100, ((r - 5) / 3) * 100))

              return (
                <div key={month} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-6">{month}</span>
                  <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors.bg} rounded-full transition-all`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${colors.text} w-6 text-right`}>
                    {rating}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-surface-50/20 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{stats.matches} partite</span>
            {stats.hotPeriod && (
              <span className="text-[10px] text-green-400">🔥 Picco: {stats.hotPeriod}</span>
            )}
          </div>

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-surface-100" />
          </div>
        </div>
      )}
    </div>
  )
}

// Simplified badge for hot months (used in other contexts)
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
    label = 'Primavera'
    icon = '🔥'
    colors = 'bg-orange-500/20 text-orange-400'
  } else if (hasAutumn && !hasSpring && !hasWinter) {
    label = 'Autunno'
    icon = '🍂'
    colors = 'bg-amber-500/20 text-amber-400'
  } else if (hasWinter && !hasSpring && !hasAutumn) {
    label = 'Inverno'
    icon = '❄️'
    colors = 'bg-cyan-500/20 text-cyan-400'
  } else {
    // Multiple peaks
    const monthLabels = hotMonths.map(m => MONTH_NAMES[m] || m).slice(0, 2)
    label = monthLabels.join('-')
    icon = '📈'
    colors = 'bg-green-500/20 text-green-400'
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${colors}`}>
      {icon} {label}
    </span>
  )
}

export default SeasonalitySparkbar
