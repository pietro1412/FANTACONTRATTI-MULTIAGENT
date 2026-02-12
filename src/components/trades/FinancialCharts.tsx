// BilancioGauge - Semicircle gauge showing bilancio position
export function BilancioGauge({ bilancio, budget, size = 130 }: { bilancio: number; budget: number; size?: number }) {
  const height = size * 0.58
  const cx = size / 2
  const cy = height - 4
  const radius = size / 2 - 8

  // ratio clamped between 0 and 1
  const maxVal = Math.max(budget, 1)
  const ratio = Math.max(0, Math.min(1, bilancio / maxVal))

  // Semicircle from PI to 0 (left to right)
  const startAngle = Math.PI
  const strokeW = 10

  // Three arc zones: red (0-0.15), yellow (0.15-0.35), green (0.35-1)
  const zones = [
    { from: 0, to: 0.15, color: '#ef4444' },     // red
    { from: 0.15, to: 0.35, color: '#eab308' },   // yellow
    { from: 0.35, to: 1, color: '#22c55e' },       // green
  ]

  function arcPath(fromRatio: number, toRatio: number) {
    const a1 = startAngle - fromRatio * Math.PI
    const a2 = startAngle - toRatio * Math.PI
    const x1 = cx + radius * Math.cos(a1)
    const y1 = cy + radius * Math.sin(a1)
    const x2 = cx + radius * Math.cos(a2)
    const y2 = cy + radius * Math.sin(a2)
    const largeArc = toRatio - fromRatio > 0.5 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`
  }

  // Needle angle
  const needleAngle = startAngle - ratio * Math.PI
  const needleLen = radius - 4
  const nx = cx + needleLen * Math.cos(needleAngle)
  const ny = cy + needleLen * Math.sin(needleAngle)

  // Semantic color for value
  const valueColor = bilancio < 0 ? '#ef4444' : bilancio < 30 ? '#eab308' : '#4ade80'

  return (
    <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
      {/* Background track */}
      <path d={arcPath(0, 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW} strokeLinecap="round" />
      {/* Color zones */}
      {zones.map((z, i) => (
        <path key={i} d={arcPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth={strokeW} strokeLinecap="round" opacity={0.35} />
      ))}
      {/* Active arc up to current ratio */}
      <path d={arcPath(0, ratio)} fill="none" stroke={valueColor} strokeWidth={strokeW} strokeLinecap="round" opacity={0.9} />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill="white" />
      {/* Value text */}
      <text x={cx} y={cy - 14} textAnchor="middle" fill={valueColor} fontSize={size > 120 ? 20 : 16} fontWeight="bold">{bilancio}</text>
      <text x={cx} y={cy - 28} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8} style={{ textTransform: 'uppercase' }}>BILANCIO</text>
    </svg>
  )
}

// CompactBudgetBar - Horizontal bar for Budget vs Ingaggi
export function CompactBudgetBar({ budget, ingaggi }: { budget: number; ingaggi: number }) {
  const maxVal = Math.max(budget, ingaggi, 1)
  const budgetPct = (budget / maxVal) * 100
  const ingaggiPct = (ingaggi / maxVal) * 100

  return (
    <div className="flex flex-col gap-1.5 w-full" style={{ minHeight: 44 }}>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Budget</span>
          <span className="text-primary-400 font-medium">{budget}</span>
        </div>
        <div className="h-3 bg-surface-100/50 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${budgetPct}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Ingaggi</span>
          <span className="text-accent-400 font-medium">{ingaggi}</span>
        </div>
        <div className="h-3 bg-surface-100/50 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-500" style={{ width: `${ingaggiPct}%` }} />
        </div>
      </div>
    </div>
  )
}

// DeltaBar - Shows before/after impact on bilancio
export function DeltaBar({ before, after, label }: { before: number; after: number; label?: string }) {
  const delta = after - before
  const maxAbs = Math.max(Math.abs(before), Math.abs(after), 1)
  const beforePct = Math.max(0, (before / maxAbs) * 100)
  const afterPct = Math.max(0, (after / maxAbs) * 100)
  const improves = delta >= 0
  const deltaColor = improves ? 'text-secondary-400' : 'text-danger-400'
  const barColor = improves ? 'bg-secondary-500' : 'bg-danger-500'

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-8 text-right font-medium">{before}</span>
        <div className="flex-1 relative h-4 bg-surface-100/30 rounded-full overflow-hidden">
          {/* Before marker */}
          <div className="absolute top-0 h-full bg-gray-500/40 rounded-full transition-all duration-500" style={{ width: `${beforePct}%` }} />
          {/* After marker */}
          <div className={`absolute top-0 h-full ${barColor}/60 rounded-full transition-all duration-500`} style={{ width: `${afterPct}%` }} />
        </div>
        <span className={`text-xs font-semibold w-8 ${deltaColor}`}>{after}</span>
        <span className={`text-[10px] font-bold ${deltaColor} min-w-[40px]`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  )
}
