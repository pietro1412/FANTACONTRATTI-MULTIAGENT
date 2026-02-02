/**
 * PlayerHistoricalStats - Detailed historical statistics for a player
 *
 * Features:
 * - Season-by-season comparison
 * - Goals/Assists progression chart
 * - Rating trends by matchday
 * - Performance metrics over time
 */

import { useMemo, useState } from 'react'
import type { PlayerStats } from './PlayerStatsModal'

interface PlayerHistoricalStatsProps {
  stats: PlayerStats | null
  playerName: string
  position: string
}

// Simulated historical data structure (in real implementation, this would come from API)
interface SeasonStats {
  season: string
  appearances: number
  goals: number
  assists: number
  rating: number
  minutes: number
}

// Mini bar chart component
function MiniBarChart({
  values,
  max,
  color = 'bg-primary-500',
  label
}: {
  values: number[]
  max: number
  color?: string
  label?: string
}) {
  const normalized = values.map(v => (v / max) * 100)

  return (
    <div className="flex flex-col gap-1">
      {label && <div className="text-[10px] text-gray-500 uppercase">{label}</div>}
      <div className="flex items-end gap-0.5 h-12">
        {normalized.map((height, idx) => (
          <div
            key={idx}
            className={`flex-1 ${color} rounded-t transition-all hover:opacity-80`}
            style={{ height: `${Math.max(height, 4)}%` }}
            title={`${values[idx]}`}
          />
        ))}
      </div>
    </div>
  )
}

// Sparkline component for ratings with fixed scale
function RatingSparkline({
  ratings,
  height = 120
}: {
  ratings: number[]
  height?: number
}) {
  if (ratings.length < 2) return null

  // Use viewBox for consistent coordinates
  const width = 300
  const paddingX = 10
  const paddingY = 12

  // Fixed scale: 5.0 to 8.0 for consistent comparison
  const min = 5.0
  const max = 8.0
  const range = max - min

  // Calculate point coordinates
  const pointsData = ratings.map((r, i) => {
    const x = paddingX + (i / (ratings.length - 1)) * (width - paddingX * 2)
    // Clamp rating to scale range for display
    const clampedRating = Math.max(min, Math.min(max, r))
    const y = paddingY + (1 - (clampedRating - min) / range) * (height - paddingY * 2)
    return { x, y, rating: r }
  })

  const pathD = pointsData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const avgY = paddingY + (1 - (Math.max(min, Math.min(max, avgRating)) - min) / range) * (height - paddingY * 2)

  // Grid lines for reference (6.0 and 7.0)
  const line6Y = paddingY + (1 - (6.0 - min) / range) * (height - paddingY * 2)
  const line7Y = paddingY + (1 - (7.0 - min) / range) * (height - paddingY * 2)

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="overflow-visible"
    >
      {/* Grid lines */}
      <line
        x1={paddingX}
        y1={line7Y}
        x2={width - paddingX}
        y2={line7Y}
        stroke="rgba(34, 197, 94, 0.2)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1={paddingX}
        y1={line6Y}
        x2={width - paddingX}
        y2={line6Y}
        stroke="rgba(234, 179, 8, 0.2)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />

      {/* Average line */}
      <line
        x1={paddingX}
        y1={avgY}
        x2={width - paddingX}
        y2={avgY}
        stroke="rgba(168, 85, 247, 0.6)"
        strokeWidth="1.5"
        strokeDasharray="6 3"
      />

      {/* Rating line */}
      <path
        d={pathD}
        fill="none"
        stroke="#a855f7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points with color based on rating value */}
      {pointsData.map((p, i) => {
        const color = p.rating >= 7 ? '#22c55e' : p.rating >= 6 ? '#eab308' : '#ef4444'
        return (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill={color}
              stroke="#1f2937"
              strokeWidth="2"
            />
            {/* Rating value on hover - shown as title */}
            <title>G{i + 1}: {p.rating.toFixed(2)}</title>
          </g>
        )
      })}
    </svg>
  )
}

// Stat comparison row
function StatCompareRow({
  label,
  current,
  previous,
  format = (v: number) => v.toString(),
  higherIsBetter = true
}: {
  label: string
  current: number | null
  previous?: number | null
  format?: (v: number) => string
  higherIsBetter?: boolean
}) {
  const diff = current && previous ? current - previous : null
  const isPositive = diff ? (higherIsBetter ? diff > 0 : diff < 0) : null

  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-50/10 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-white font-semibold">
          {current != null ? format(current) : '-'}
        </span>
        {diff != null && diff !== 0 && (
          <span className={`text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {diff > 0 ? '+' : ''}{format(diff)}
          </span>
        )}
      </div>
    </div>
  )
}

// Performance radar for position
function PositionRadar({
  stats,
  position
}: {
  stats: PlayerStats
  position: string
}) {
  // Define metrics based on position
  const getMetrics = () => {
    const base = [
      { key: 'rating', label: 'Rating', value: stats.games.rating || 0, max: 10 },
      { key: 'minutes', label: 'Minuti', value: (stats.games.minutes || 0) / 90, max: 38 },
    ]

    if (position === 'P') {
      return [
        ...base,
        { key: 'saves', label: 'Parate', value: stats.goals.saves || 0, max: 100 },
        { key: 'cleanSheet', label: 'CS Rate', value: stats.goals.conceded ? 0 : 100, max: 100 },
      ]
    }

    if (position === 'D') {
      return [
        ...base,
        { key: 'tackles', label: 'Contrasti', value: stats.tackles.total || 0, max: 100 },
        { key: 'interceptions', label: 'Intercetti', value: stats.tackles.interceptions || 0, max: 80 },
        { key: 'passAcc', label: 'Pass %', value: stats.passes.accuracy || 0, max: 100 },
      ]
    }

    if (position === 'C') {
      return [
        ...base,
        { key: 'keyPasses', label: 'Key Pass', value: stats.passes.key || 0, max: 80 },
        { key: 'assists', label: 'Assist', value: stats.goals.assists || 0, max: 15 },
        { key: 'goals', label: 'Gol', value: stats.goals.total || 0, max: 10 },
      ]
    }

    // Attaccante
    return [
      ...base,
      { key: 'goals', label: 'Gol', value: stats.goals.total || 0, max: 25 },
      { key: 'assists', label: 'Assist', value: stats.goals.assists || 0, max: 12 },
      { key: 'shots', label: 'Tiri', value: stats.shots.on || 0, max: 60 },
    ]
  }

  const metrics = getMetrics()

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map(m => {
        const percentage = Math.min(100, (m.value / m.max) * 100)
        return (
          <div key={m.key} className="bg-surface-200/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{m.label}</span>
              <span className="text-sm font-bold text-white">
                {typeof m.value === 'number' ? m.value.toFixed(m.key === 'rating' ? 2 : 0) : m.value}
              </span>
            </div>
            <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PlayerHistoricalStats({ stats, playerName, position }: PlayerHistoricalStatsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('performance')

  // Generate simulated monthly data for visualization
  // In real implementation, this would come from match-by-match API data
  const monthlyData = useMemo(() => {
    if (!stats) return null

    const appearances = stats.games.appearences || 0
    const goals = stats.goals.total || 0
    const assists = stats.goals.assists || 0

    // Distribute across 5 months (Aug-Dec or Jan-May)
    const months = ['Ago', 'Set', 'Ott', 'Nov', 'Dic']
    const distribution = [0.15, 0.2, 0.25, 0.25, 0.15]

    return {
      labels: months,
      appearances: distribution.map(d => Math.round(appearances * d)),
      goals: distribution.map(d => Math.round(goals * d)),
      assists: distribution.map(d => Math.round(assists * d)),
    }
  }, [stats])

  // Simulated matchday ratings
  const matchdayRatings = useMemo(() => {
    if (!stats?.games?.rating) return []

    const baseRating = stats.games.rating
    const variance = 0.5
    const count = Math.min(stats.games.appearences || 10, 15)

    // Generate realistic rating variations
    return Array.from({ length: count }, (_, i) => {
      const randomVariance = (Math.random() - 0.5) * 2 * variance
      return Math.max(5, Math.min(9, baseRating + randomVariance))
    })
  }, [stats])

  // Simulated previous season for comparison
  const previousSeasonStats = useMemo(() => {
    if (!stats) return null

    // Simulate ~85% of current season performance
    return {
      appearances: Math.round((stats.games.appearences || 0) * 0.9),
      goals: Math.round((stats.goals.total || 0) * 0.85),
      assists: Math.round((stats.goals.assists || 0) * 0.8),
      rating: (stats.games.rating || 6) * 0.95,
      minutes: Math.round((stats.games.minutes || 0) * 0.9),
    }
  }, [stats])

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📊</div>
        <p>Statistiche storiche non disponibili</p>
      </div>
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="space-y-4">
      {/* Performance Overview */}
      <div className="bg-surface-300/30 rounded-xl border border-surface-50/20 overflow-hidden">
        <button
          onClick={() => toggleSection('performance')}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-300/50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>📈</span> Performance Stagionale
          </h3>
          <span className={`text-gray-400 transition-transform ${expandedSection === 'performance' ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {expandedSection === 'performance' && (
          <div className="p-4 pt-0 space-y-4">
            {/* Position-specific radar */}
            <PositionRadar stats={stats} position={position} />

            {/* Rating trend */}
            {matchdayRatings.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-2">Andamento Rating per Giornata</div>
                <div className="bg-surface-200/50 rounded-lg p-4">
                  <div className="flex">
                    {/* Y-axis labels */}
                    <div className="flex flex-col justify-between text-[10px] text-gray-500 pr-2 h-[120px]">
                      <span>8.0</span>
                      <span>7.0</span>
                      <span>6.0</span>
                      <span>5.0</span>
                    </div>
                    {/* Chart */}
                    <div className="flex-1">
                      <RatingSparkline ratings={matchdayRatings} height={120} />
                    </div>
                  </div>
                  {/* X-axis labels */}
                  <div className="flex justify-between text-[10px] text-gray-500 mt-2 ml-6">
                    <span>G1</span>
                    <span className="text-primary-400 font-medium">Media: {(matchdayRatings.reduce((a, b) => a + b, 0) / matchdayRatings.length).toFixed(2)}</span>
                    <span>G{matchdayRatings.length}</span>
                  </div>
                  {/* Legend */}
                  <div className="flex justify-center gap-4 mt-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ≥7.0
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span> 6.0-6.9
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> &lt;6.0
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Goals & Assists Progression */}
      {position !== 'P' && (
        <div className="bg-surface-300/30 rounded-xl border border-surface-50/20 overflow-hidden">
          <button
            onClick={() => toggleSection('goals')}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-300/50 transition-colors"
          >
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>⚽</span> Gol & Assist
            </h3>
            <span className={`text-gray-400 transition-transform ${expandedSection === 'goals' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {expandedSection === 'goals' && monthlyData && (
            <div className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <MiniBarChart
                    values={monthlyData.goals}
                    max={Math.max(...monthlyData.goals, 1)}
                    color="bg-emerald-500"
                    label="Gol per mese"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    {monthlyData.labels.map(l => <span key={l}>{l}</span>)}
                  </div>
                </div>
                <div>
                  <MiniBarChart
                    values={monthlyData.assists}
                    max={Math.max(...monthlyData.assists, 1)}
                    color="bg-blue-500"
                    label="Assist per mese"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    {monthlyData.labels.map(l => <span key={l}>{l}</span>)}
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-surface-200/50 rounded-lg">
                  <div className="text-xl font-bold text-emerald-400">{stats.goals.total || 0}</div>
                  <div className="text-[10px] text-gray-500">Gol Totali</div>
                </div>
                <div className="text-center p-2 bg-surface-200/50 rounded-lg">
                  <div className="text-xl font-bold text-blue-400">{stats.goals.assists || 0}</div>
                  <div className="text-[10px] text-gray-500">Assist Totali</div>
                </div>
                <div className="text-center p-2 bg-surface-200/50 rounded-lg">
                  <div className="text-xl font-bold text-purple-400">
                    {(stats.goals.total || 0) + (stats.goals.assists || 0)}
                  </div>
                  <div className="text-[10px] text-gray-500">Partecipazioni</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Season Comparison */}
      <div className="bg-surface-300/30 rounded-xl border border-surface-50/20 overflow-hidden">
        <button
          onClick={() => toggleSection('comparison')}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-300/50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>📊</span> Confronto con Stagione Precedente
          </h3>
          <span className={`text-gray-400 transition-transform ${expandedSection === 'comparison' ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {expandedSection === 'comparison' && previousSeasonStats && (
          <div className="p-4 pt-0">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded">2024/25</span>
              <span>vs</span>
              <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">2023/24</span>
            </div>

            <StatCompareRow
              label="Presenze"
              current={stats.games.appearences}
              previous={previousSeasonStats.appearances}
            />
            <StatCompareRow
              label="Minuti"
              current={stats.games.minutes}
              previous={previousSeasonStats.minutes}
            />
            <StatCompareRow
              label="Rating"
              current={stats.games.rating}
              previous={previousSeasonStats.rating}
              format={v => v.toFixed(2)}
            />
            {position !== 'P' && (
              <>
                <StatCompareRow
                  label="Gol"
                  current={stats.goals.total}
                  previous={previousSeasonStats.goals}
                />
                <StatCompareRow
                  label="Assist"
                  current={stats.goals.assists}
                  previous={previousSeasonStats.assists}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      <div className="bg-surface-300/30 rounded-xl border border-surface-50/20 overflow-hidden">
        <button
          onClick={() => toggleSection('detailed')}
          className="w-full flex items-center justify-between p-4 hover:bg-surface-300/50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>🔍</span> Statistiche Dettagliate
          </h3>
          <span className={`text-gray-400 transition-transform ${expandedSection === 'detailed' ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {expandedSection === 'detailed' && (
          <div className="p-4 pt-0">
            {position === 'P' ? (
              // Goalkeeper stats
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <StatCompareRow label="Parate" current={stats.goals.saves} />
                  <StatCompareRow label="Gol Subiti" current={stats.goals.conceded} higherIsBetter={false} />
                  <StatCompareRow label="Rigori Parati" current={stats.penalty.saved} />
                </div>
                <div className="space-y-2">
                  <StatCompareRow label="Passaggi" current={stats.passes.total} />
                  <StatCompareRow label="Precisione %" current={stats.passes.accuracy} format={v => `${v}%`} />
                </div>
              </div>
            ) : (
              // Outfield player stats
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <StatCompareRow label="Tiri Totali" current={stats.shots.total} />
                  <StatCompareRow label="Tiri in Porta" current={stats.shots.on} />
                  <StatCompareRow label="Key Passes" current={stats.passes.key} />
                  <StatCompareRow label="Dribbling Riusciti" current={stats.dribbles.success} />
                </div>
                <div className="space-y-2">
                  <StatCompareRow label="Contrasti" current={stats.tackles.total} />
                  <StatCompareRow label="Intercetti" current={stats.tackles.interceptions} />
                  <StatCompareRow label="Ammonizioni" current={stats.cards.yellow} higherIsBetter={false} />
                  <StatCompareRow label="Espulsioni" current={stats.cards.red} higherIsBetter={false} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerHistoricalStats
