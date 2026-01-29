import { useMemo } from 'react'

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
  const numAxes = data.length
  const center = size / 2
  const radius = (size / 2) - 40 // Leave room for labels
  const levels = 5 // Number of concentric circles

  // Calculate angle for each axis
  const angleStep = (2 * Math.PI) / numAxes
  const startAngle = -Math.PI / 2 // Start from top

  // Get max value for normalization
  const maxValue = useMemo(() => {
    let max = 0
    data.forEach(d => {
      d.values.forEach(v => {
        if (v > max) max = v
      })
    })
    return max || 1
  }, [data])

  // Calculate point position on the chart
  const getPoint = (axisIndex: number, value: number) => {
    const angle = startAngle + axisIndex * angleStep
    const normalizedValue = value / maxValue
    const r = normalizedValue * radius
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  }

  // Generate axis lines and labels
  const axes = useMemo(() => {
    return data.map((d, i) => {
      const angle = startAngle + i * angleStep
      const endX = center + radius * Math.cos(angle)
      const endY = center + radius * Math.sin(angle)
      const labelX = center + (radius + 20) * Math.cos(angle)
      const labelY = center + (radius + 20) * Math.sin(angle)

      return {
        line: { x1: center, y1: center, x2: endX, y2: endY },
        label: { x: labelX, y: labelY, text: d.label },
      }
    })
  }, [data, center, radius, angleStep])

  // Generate concentric level circles
  const levelCircles = useMemo(() => {
    return Array.from({ length: levels }, (_, i) => {
      const r = ((i + 1) / levels) * radius
      return { r, value: Math.round(((i + 1) / levels) * maxValue) }
    })
  }, [levels, radius, maxValue])

  // Generate polygon points for each player
  const playerPolygons = useMemo(() => {
    return players.map((player, playerIndex) => {
      const points = data.map((d, axisIndex) => {
        const value = d.values[playerIndex] || 0
        return getPoint(axisIndex, value)
      })

      const pathData = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
        .join(' ') + ' Z'

      return {
        pathData,
        points,
        color: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
        name: player.name,
      }
    })
  }, [data, players])

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background circles */}
        {levelCircles.map((level, i) => (
          <g key={i}>
            <circle
              cx={center}
              cy={center}
              r={level.r}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
            {/* Level value label */}
            <text
              x={center + 5}
              y={center - level.r}
              fill="rgba(255,255,255,0.3)"
              fontSize="10"
              textAnchor="start"
            >
              {level.value}
            </text>
          </g>
        ))}

        {/* Axis lines */}
        {axes.map((axis, i) => (
          <line
            key={i}
            x1={axis.line.x1}
            y1={axis.line.y1}
            x2={axis.line.x2}
            y2={axis.line.y2}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        ))}

        {/* Player polygons */}
        {playerPolygons.map((polygon, i) => (
          <g key={i}>
            <path
              d={polygon.pathData}
              fill={polygon.color.fill}
              stroke={polygon.color.stroke}
              strokeWidth="2"
            />
            {/* Data points */}
            {polygon.points.map((point, j) => (
              <circle
                key={j}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={polygon.color.stroke}
              />
            ))}
          </g>
        ))}

        {/* Axis labels */}
        {axes.map((axis, i) => (
          <text
            key={i}
            x={axis.label.x}
            y={axis.label.y}
            fill="rgba(255,255,255,0.8)"
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {axis.label.text}
          </text>
        ))}

        {/* Value labels if enabled */}
        {showValues && playerPolygons.map((polygon, playerIdx) => (
          polygon.points.map((point, axisIdx) => (
            <text
              key={`${playerIdx}-${axisIdx}`}
              x={point.x}
              y={point.y - 10}
              fill={polygon.color.stroke}
              fontSize="9"
              textAnchor="middle"
            >
              {data[axisIdx].values[playerIdx]}
            </text>
          ))
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4">
        {players.map((player, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length].stroke }}
            />
            <span className="text-sm text-gray-300">{player.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
