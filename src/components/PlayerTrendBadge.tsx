/**
 * PlayerTrendBadge - Shows player form trend indicator
 * Part of Sprint 4: Stagionalità giocatori
 *
 * Features:
 * - Up/Down/Stable trend arrow
 * - Color-coded by trend direction
 * - Form index value
 * - Compact and full variants
 */

import { useMemo } from 'react'

interface PlayerTrendBadgeProps {
  ratings: number[]  // Last 5 match ratings (newest first)
  variant?: 'compact' | 'full'
  showIndex?: boolean
  className?: string
}

export type TrendDirection = 'up' | 'down' | 'stable'

export interface TrendInfo {
  direction: TrendDirection
  formIndex: number
  changePercent: number
  label: string
}

/**
 * Calculate trend from ratings array
 * Compares average of last 2 vs first 2 matches
 */
export function calculateTrend(ratings: number[]): TrendInfo {
  if (!ratings || ratings.length < 2) {
    return {
      direction: 'stable',
      formIndex: ratings?.[0] || 0,
      changePercent: 0,
      label: 'N/D',
    }
  }

  // Calculate form index (average of available ratings)
  const formIndex = ratings.reduce((sum, r) => sum + r, 0) / ratings.length

  // Compare recent (last 2) vs older (first 2) performance
  const recentCount = Math.min(2, Math.floor(ratings.length / 2))
  const olderCount = Math.min(2, ratings.length - recentCount)

  const recentAvg = ratings.slice(0, recentCount).reduce((sum, r) => sum + r, 0) / recentCount
  const olderAvg = ratings.slice(-olderCount).reduce((sum, r) => sum + r, 0) / olderCount

  const change = recentAvg - olderAvg
  const changePercent = olderAvg > 0 ? (change / olderAvg) * 100 : 0

  // Determine trend direction (threshold: 0.3 rating points or 5%)
  let direction: TrendDirection = 'stable'
  if (change > 0.3 || changePercent > 5) {
    direction = 'up'
  } else if (change < -0.3 || changePercent < -5) {
    direction = 'down'
  }

  // Generate label
  let label = 'Stabile'
  if (direction === 'up') {
    label = changePercent > 10 ? 'In crescita' : 'In ripresa'
  } else if (direction === 'down') {
    label = changePercent < -10 ? 'In calo' : 'In flessione'
  }

  return {
    direction,
    formIndex: Math.round(formIndex * 10) / 10, // 1 decimal
    changePercent: Math.round(changePercent),
    label,
  }
}

/**
 * Get form quality label based on average rating
 */
export function getFormQuality(formIndex: number): {
  label: string
  color: string
  bg: string
} {
  if (formIndex >= 7.5) {
    return { label: 'Eccellente', color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
  }
  if (formIndex >= 7.0) {
    return { label: 'Ottimo', color: 'text-green-400', bg: 'bg-green-500/20' }
  }
  if (formIndex >= 6.5) {
    return { label: 'Buono', color: 'text-teal-400', bg: 'bg-teal-500/20' }
  }
  if (formIndex >= 6.0) {
    return { label: 'Sufficiente', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
  }
  if (formIndex >= 5.5) {
    return { label: 'Insufficiente', color: 'text-orange-400', bg: 'bg-orange-500/20' }
  }
  return { label: 'Scarso', color: 'text-red-400', bg: 'bg-red-500/20' }
}

/**
 * Get trend styling based on direction
 */
function getTrendStyle(direction: TrendDirection) {
  switch (direction) {
    case 'up':
      return {
        arrow: '↑',
        color: 'text-green-400',
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
      }
    case 'down':
      return {
        arrow: '↓',
        color: 'text-red-400',
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
      }
    default:
      return {
        arrow: '→',
        color: 'text-gray-400',
        bg: 'bg-gray-500/20',
        border: 'border-gray-500/30',
      }
  }
}

export function PlayerTrendBadge({
  ratings,
  variant = 'compact',
  showIndex = true,
  className = '',
}: PlayerTrendBadgeProps) {
  const trend = useMemo(() => calculateTrend(ratings), [ratings])
  const style = getTrendStyle(trend.direction)
  const quality = getFormQuality(trend.formIndex)

  if (!ratings || ratings.length === 0) {
    return (
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-500 ${className}`}>
        <span>-</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${style.bg} ${style.color} ${className}`}
        title={`${trend.label} - Form: ${trend.formIndex}`}
      >
        <span className="font-bold">{style.arrow}</span>
        {showIndex && <span className="font-medium">{trend.formIndex}</span>}
      </div>
    )
  }

  // Full variant
  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg border ${style.border} ${style.bg} ${className}`}>
      {/* Trend arrow */}
      <div className={`w-5 h-5 rounded-full ${style.bg} flex items-center justify-center`}>
        <span className={`text-sm font-bold ${style.color}`}>{style.arrow}</span>
      </div>

      {/* Form info */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          {showIndex && (
            <span className={`text-sm font-bold ${quality.color}`}>{trend.formIndex}</span>
          )}
          <span className={`text-[10px] ${style.color}`}>{trend.label}</span>
        </div>
        <span className={`text-[9px] ${quality.color}`}>{quality.label}</span>
      </div>

      {/* Change percentage */}
      {trend.changePercent !== 0 && (
        <span className={`text-[10px] font-medium ${style.color}`}>
          {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
        </span>
      )}
    </div>
  )
}

/**
 * Mini version for table cells
 */
export function PlayerTrendMini({
  ratings,
  className = '',
}: {
  ratings: number[]
  className?: string
}) {
  const trend = useMemo(() => calculateTrend(ratings), [ratings])
  const style = getTrendStyle(trend.direction)

  if (!ratings || ratings.length === 0) {
    return <span className="text-gray-500">-</span>
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${style.color} ${className}`}
      title={`${trend.label} (${trend.formIndex})`}
    >
      <span className="text-xs font-bold">{style.arrow}</span>
      <span className="text-[10px] font-medium">{trend.formIndex}</span>
    </span>
  )
}

export default PlayerTrendBadge
