import { useMemo } from 'react'

interface PlayerFormChartProps {
  // Array of ratings (most recent last), e.g., [6.5, 7.0, 6.0, 7.5, 8.0]
  ratings: number[]
  // Size variant
  size?: 'sm' | 'md' | 'lg'
  // Show labels
  showLabels?: boolean
  // Show trend indicator
  showTrend?: boolean
  // Custom class
  className?: string
}

// Get color based on rating
function getRatingColor(rating: number): string {
  if (rating >= 7.5) return '#10b981' // emerald-500 - excellent
  if (rating >= 6.5) return '#319795' // primary-500 - good
  if (rating >= 6.0) return '#f59e0b' // amber-500 - average
  if (rating >= 5.5) return '#f97316' // orange-500 - below average
  return '#ef4444' // red-500 - poor
}

// Calculate trend from ratings
function calculateTrend(ratings: number[]): 'up' | 'down' | 'stable' {
  if (ratings.length < 2) return 'stable'

  // Compare average of last 2 to average of first 2
  const recentAvg = ratings.slice(-2).reduce((a, b) => a + b, 0) / Math.min(2, ratings.slice(-2).length)
  const olderAvg = ratings.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, ratings.slice(0, 2).length)

  const diff = recentAvg - olderAvg
  if (diff > 0.3) return 'up'
  if (diff < -0.3) return 'down'
  return 'stable'
}

// Size configurations
const SIZE_CONFIG = {
  sm: { width: 50, height: 20, strokeWidth: 1.5, dotSize: 2 },
  md: { width: 80, height: 30, strokeWidth: 2, dotSize: 3 },
  lg: { width: 120, height: 40, strokeWidth: 2.5, dotSize: 4 },
}

export function PlayerFormChart({
  ratings,
  size = 'sm',
  showLabels = false,
  showTrend = false,
  className = '',
}: PlayerFormChartProps) {
  const config = SIZE_CONFIG[size]

  // Calculate SVG points and path
  const { path, points, avgRating, trend, latestColor } = useMemo(() => {
    if (ratings.length === 0) {
      return { path: '', points: [], avgRating: 0, trend: 'stable' as const, latestColor: '#6b7280' }
    }

    // Normalize ratings to SVG coordinates
    // Rating scale: 4.0 to 10.0 (typical football ratings)
    const minRating = 4.0
    const maxRating = 10.0
    const padding = 4

    const effectiveWidth = config.width - padding * 2
    const effectiveHeight = config.height - padding * 2

    const pts = ratings.map((rating, index) => {
      const x = padding + (index / Math.max(1, ratings.length - 1)) * effectiveWidth
      const normalizedRating = Math.max(minRating, Math.min(maxRating, rating))
      const y = padding + effectiveHeight - ((normalizedRating - minRating) / (maxRating - minRating)) * effectiveHeight
      return { x, y, rating }
    })

    // Create smooth path
    let d = ''
    if (pts.length === 1) {
      // Single point - draw a small horizontal line
      d = `M ${pts[0].x - 5} ${pts[0].y} L ${pts[0].x + 5} ${pts[0].y}`
    } else {
      // Multiple points - create smooth curve
      d = `M ${pts[0].x} ${pts[0].y}`
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]
        const curr = pts[i]
        const midX = (prev.x + curr.x) / 2
        d += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`
      }
      // Final segment
      if (pts.length > 1) {
        const last = pts[pts.length - 1]
        d += ` L ${last.x} ${last.y}`
      }
    }

    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
    const trendCalc = calculateTrend(ratings)
    const lastRating = ratings[ratings.length - 1]

    return {
      path: d,
      points: pts,
      avgRating: avg,
      trend: trendCalc,
      latestColor: getRatingColor(lastRating),
    }
  }, [ratings, config])

  if (ratings.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 text-xs ${className}`}>
        -
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Chart */}
      <svg
        width={config.width}
        height={config.height}
        className="overflow-visible"
        style={{ minWidth: config.width }}
      >
        {/* Gradient for the line */}
        <defs>
          <linearGradient id={`form-gradient-${ratings.join('-')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            {points.map((pt, idx) => (
              <stop
                key={idx}
                offset={`${(idx / Math.max(1, points.length - 1)) * 100}%`}
                stopColor={getRatingColor(pt.rating)}
              />
            ))}
          </linearGradient>
        </defs>

        {/* Reference line at 6.0 (sufficient) */}
        <line
          x1="0"
          y1={config.height * 0.67} // Approximate position for 6.0
          x2={config.width}
          y2={config.height * 0.67}
          stroke="#374151"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke={`url(#form-gradient-${ratings.join('-')})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={idx === points.length - 1 ? config.dotSize : config.dotSize * 0.7}
            fill={getRatingColor(pt.rating)}
            opacity={idx === points.length - 1 ? 1 : 0.6}
          />
        ))}

        {/* Latest value highlight */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={config.dotSize + 2}
            fill="none"
            stroke={latestColor}
            strokeWidth="1"
            opacity="0.4"
          />
        )}
      </svg>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-col items-end">
          <span
            className="text-xs font-semibold"
            style={{ color: latestColor }}
          >
            {ratings[ratings.length - 1].toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500">
            Avg {avgRating.toFixed(1)}
          </span>
        </div>
      )}

      {/* Trend indicator */}
      {showTrend && (
        <div className="flex items-center">
          {trend === 'up' && (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {trend === 'down' && (
            <svg className="w-4 h-4 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {trend === 'stable' && (
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}

// Helper function to extract ratings from API-Football stats
export function extractRatingsFromStats(apiFootballStats: unknown): number[] {
  if (!apiFootballStats || typeof apiFootballStats !== 'object') {
    return []
  }

  const stats = apiFootballStats as Record<string, unknown>

  // Try to get fixture-by-fixture ratings if available
  // API-Football stores per-match data in different structures
  // This handles the most common format

  // Check for games.rating (overall rating)
  if (stats.games && typeof stats.games === 'object') {
    const games = stats.games as Record<string, unknown>
    if (typeof games.rating === 'number') {
      return [games.rating]
    }
    if (typeof games.rating === 'string' && !isNaN(parseFloat(games.rating))) {
      return [parseFloat(games.rating)]
    }
  }

  // Check for fixtures array (detailed per-match data)
  if (Array.isArray(stats.fixtures)) {
    const ratings = stats.fixtures
      .map((fixture: unknown) => {
        if (fixture && typeof fixture === 'object') {
          const f = fixture as Record<string, unknown>
          if (f.games && typeof f.games === 'object') {
            const g = f.games as Record<string, unknown>
            if (typeof g.rating === 'number') return g.rating
            if (typeof g.rating === 'string' && !isNaN(parseFloat(g.rating))) return parseFloat(g.rating)
          }
          if (typeof f.rating === 'number') return f.rating
          if (typeof f.rating === 'string' && !isNaN(parseFloat(f.rating))) return parseFloat(f.rating)
        }
        return null
      })
      .filter((r): r is number => r !== null)
      .slice(-5) // Last 5 matches

    if (ratings.length > 0) return ratings
  }

  // Check for a simple ratings array
  if (Array.isArray(stats.ratings)) {
    return stats.ratings
      .filter((r): r is number => typeof r === 'number')
      .slice(-5)
  }

  // Check for recentForm or lastMatches
  if (Array.isArray(stats.recentForm)) {
    return stats.recentForm
      .filter((r): r is number => typeof r === 'number')
      .slice(-5)
  }

  return []
}
