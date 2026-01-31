/**
 * PlayerFormBadge - Shows player form rating with visual bar and trend indicator
 *
 * Features:
 * - Displays rating value (0-10 scale)
 * - Color-coded bar (red -> yellow -> green)
 * - Trend arrow: up (green), down (red), stable (yellow)
 */

interface PlayerFormBadgeProps {
  rating: number | null
  trend: 'up' | 'down' | 'stable' | null
  size?: 'sm' | 'md'
}

// Get color for rating bar based on 0-10 scale
function getRatingColor(rating: number | null): string {
  if (rating === null) return 'bg-gray-600'
  if (rating < 5.5) return 'bg-gradient-to-r from-red-600 to-red-500'
  if (rating < 6.0) return 'bg-gradient-to-r from-orange-600 to-orange-500'
  if (rating < 6.5) return 'bg-gradient-to-r from-yellow-600 to-yellow-500'
  if (rating < 7.0) return 'bg-gradient-to-r from-lime-600 to-lime-500'
  if (rating < 7.5) return 'bg-gradient-to-r from-green-600 to-green-500'
  return 'bg-gradient-to-r from-emerald-600 to-emerald-400'
}

// Get text color for rating value
function getRatingTextColor(rating: number | null): string {
  if (rating === null) return 'text-gray-500'
  if (rating < 5.5) return 'text-red-400'
  if (rating < 6.0) return 'text-orange-400'
  if (rating < 6.5) return 'text-yellow-400'
  if (rating < 7.0) return 'text-lime-400'
  if (rating < 7.5) return 'text-green-400'
  return 'text-emerald-400'
}

// Trend arrow component
function TrendArrow({ trend, size }: { trend: 'up' | 'down' | 'stable' | null; size: 'sm' | 'md' }) {
  if (trend === null) return null

  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm'

  switch (trend) {
    case 'up':
      return (
        <span className={`${sizeClass} text-green-400 font-bold`} title="In crescita">
          ↑
        </span>
      )
    case 'down':
      return (
        <span className={`${sizeClass} text-red-400 font-bold`} title="In calo">
          ↓
        </span>
      )
    case 'stable':
      return (
        <span className={`${sizeClass} text-yellow-400 font-bold`} title="Stabile">
          =
        </span>
      )
    default:
      return null
  }
}

export function PlayerFormBadge({ rating, trend, size = 'md' }: PlayerFormBadgeProps) {
  const isSmall = size === 'sm'

  // Calculate bar width percentage (rating 0-10 maps to 0-100%)
  const barWidth = rating !== null ? Math.min(100, Math.max(0, rating * 10)) : 0

  return (
    <div className={`flex items-center gap-1.5 ${isSmall ? 'min-w-[60px]' : 'min-w-[75px]'}`}>
      {/* Rating value */}
      <span className={`font-semibold ${getRatingTextColor(rating)} ${isSmall ? 'text-xs w-6' : 'text-sm w-8'}`}>
        {rating !== null ? rating.toFixed(1) : '-'}
      </span>

      {/* Bar container */}
      <div className={`flex-1 ${isSmall ? 'h-1.5' : 'h-2'} bg-surface-300/50 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${getRatingColor(rating)} transition-all duration-300`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Trend arrow */}
      <TrendArrow trend={trend} size={size} />
    </div>
  )
}

/**
 * Helper function to calculate trend from stats
 * Compares current rating with season average to determine trend
 */
export function calculateFormTrend(
  currentRating: number | null | undefined,
  seasonAverageRating: number | null | undefined
): 'up' | 'down' | 'stable' | null {
  if (currentRating == null || seasonAverageRating == null) return null

  const diff = currentRating - seasonAverageRating

  // Threshold for considering a trend change
  const threshold = 0.15

  if (diff > threshold) return 'up'
  if (diff < -threshold) return 'down'
  return 'stable'
}

/**
 * Helper function to get form rating from player stats
 * Returns the rating value or null if not available
 */
export function getFormRating(
  stats: { games?: { rating?: number | null } } | null | undefined
): number | null {
  if (!stats?.games?.rating) return null
  const rating = Number(stats.games.rating)
  return isNaN(rating) ? null : rating
}

export default PlayerFormBadge
