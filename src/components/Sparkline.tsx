import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) return null

  // Determine color based on trend (first vs last value)
  const trend = data[data.length - 1]! - data[0]!
  const lineColor = color || (trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#6b7280')

  const chartData = data.map((value, index) => ({ index, value }))

  return (
    <div className={`inline-block ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
