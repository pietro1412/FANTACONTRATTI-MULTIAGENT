import { useMemo } from 'react'
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface RadarChartProps {
  /** Data for each player - array of { label, values: number[] } */
  data: Array<{
    label: string
    values: number[] // One value per player
  }>
  /** Player names/colors for the legend */
  players: Array<{
    name: string
    color: string
  }>
  /** Size of the chart */
  size?: number
  /** Show value labels on the chart */
  showValues?: boolean
}

// Preset colors for up to 4 players
const PLAYER_COLORS = [
  { fill: 'rgba(59, 130, 246, 0.3)', stroke: '#3b82f6' },   // Blue
  { fill: 'rgba(239, 68, 68, 0.3)', stroke: '#ef4444' },    // Red
  { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22c55e' },    // Green
  { fill: 'rgba(168, 85, 247, 0.3)', stroke: '#a855f7' },   // Purple
]

export default function RadarChart({
  data,
  players,
  size = 300,
  showValues = false
}: RadarChartProps) {
  // Transform data for recharts format: { label: string, player0: number, player1: number, ... }
  const chartData = useMemo(() => {
    return data.map(d => {
      const entry: Record<string, string | number> = { label: d.label }
      players.forEach((_, i) => {
        entry[`player${i}`] = d.values[i] || 0
      })
      return entry
    })
  }, [data, players])

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={size}>
        <RechartsRadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1c20',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          {players.map((player, i) => {
            const colors = PLAYER_COLORS[i % PLAYER_COLORS.length]!
            return (
              <Radar
                key={player.name}
                name={player.name}
                dataKey={`player${i}`}
                stroke={colors.stroke}
                fill={colors.fill}
                strokeWidth={2}
                dot={showValues ? { r: 4, fill: colors.stroke } : false}
              />
            )
          })}
          <Legend
            wrapperStyle={{ fontSize: '13px', color: '#d1d5db' }}
            iconType="circle"
            iconSize={10}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
