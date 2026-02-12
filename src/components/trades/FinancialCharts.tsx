// ============================================================================
// FinancialCharts.tsx
// Custom financial visualization widgets - NO external charting libraries.
// SVG inline for gauges, Tailwind CSS for bars.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. BilancioGauge - SVG Semi-Circle Gauge
// ---------------------------------------------------------------------------
// Shows financial health as a semicircular gauge with colored zones and needle.
//
// viewBox is fixed at "0 0 100 50". The `size` prop only controls the outer
// width/height of the <svg> element.
//
// Arc geometry:
//   Center = (50, 50)  (bottom-center of the viewBox)
//   Radius = 40
//   Semicircle spans from angle PI (left) to angle 0 (right).
//
// Three color zones painted on the arc background:
//   0%  - 15%  Red    #ef4444
//   15% - 35%  Yellow #eab308
//   35% - 100% Green  #22c55e
//
// Needle rotates from -90deg (ratio=0, left) to +90deg (ratio=1, right)
// around pivot (50, 50).
// ---------------------------------------------------------------------------

interface BilancioGaugeProps {
  bilancio: number
  budget: number
  size?: number
}

export function BilancioGauge({ bilancio, budget, size = 200 }: BilancioGaugeProps) {
  // --- Data calculation ---
  // Ratio clamped between 0 and 1: how much of the budget remains
  const ratio = Math.max(0, Math.min(bilancio / Math.max(budget, 1), 1))

  // --- SVG constants (within viewBox 0 0 100 50) ---
  const cx = 50 // center x
  const cy = 50 // center y (sits at the bottom edge of viewBox)
  const r = 40  // arc radius
  const strokeWidth = 8

  // --- Arc path helper ---
  // Converts a ratio range [fromR, toR] (each 0..1) into an SVG arc path.
  // Ratio 0 = leftmost point (angle PI), ratio 1 = rightmost point (angle 0).
  function arcPath(fromR: number, toR: number): string {
    // Angles in radians: ratio 0 -> PI, ratio 1 -> 0
    const a1 = Math.PI * (1 - fromR)
    const a2 = Math.PI * (1 - toR)

    const x1 = cx + r * Math.cos(a1)
    const y1 = cy - r * Math.sin(a1) // subtract because SVG y-axis is inverted
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy - r * Math.sin(a2)

    // large-arc flag: set when the arc spans more than 180deg (>0.5 of full circle)
    const largeArc = (toR - fromR) > 0.5 ? 1 : 0

    // sweep-flag = 0 means counter-clockwise in SVG terms (left-to-right on top half)
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }

  // --- Zone definitions ---
  const zones = [
    { from: 0, to: 0.15, color: '#ef4444' },   // Red zone
    { from: 0.15, to: 0.35, color: '#eab308' }, // Yellow zone
    { from: 0.35, to: 1, color: '#22c55e' },    // Green zone
  ]

  // --- Needle rotation ---
  // Angle: -90deg at ratio=0 (pointing left), +90deg at ratio=1 (pointing right)
  const needleAngle = -90 + ratio * 180

  // --- Semantic text color ---
  const valueColor =
    bilancio < 0 ? '#ef4444' :
    bilancio < 30 ? '#eab308' :
    '#4ade80'

  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 100 50"
    >
      {/* Background track (subtle) */}
      <path
        d={arcPath(0, 1)}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Colored zone arcs */}
      {zones.map((z, i) => (
        <path
          key={i}
          d={arcPath(z.from, z.to)}
          fill="none"
          stroke={z.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.35}
        />
      ))}

      {/* Needle line: rotates around center (50, 50) */}
      <line
        x1={50}
        y1={50}
        x2={50}
        y2={14}
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        transform={`rotate(${needleAngle} 50 50)`}
      />

      {/* Needle pivot dot */}
      <circle cx={50} cy={50} r={2.5} fill="white" />

      {/* Label "BILANCIO" */}
      <text
        x={50}
        y={32}
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize={4.5}
        style={{ textTransform: 'uppercase' }}
      >
        BILANCIO
      </text>

      {/* Numeric value */}
      <text
        x={50}
        y={43}
        textAnchor="middle"
        fill={valueColor}
        fontSize={11}
        fontWeight="bold"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {bilancio}
      </text>
    </svg>
  )
}


// ---------------------------------------------------------------------------
// 2. CompactBudgetBar - Dual Horizontal Bar (Budget vs Ingaggi)
// ---------------------------------------------------------------------------
// Shows proportional comparison between budget and salary costs.
// Both bars are sized relative to the larger of the two values.
// ---------------------------------------------------------------------------

interface CompactBudgetBarProps {
  budget: number
  ingaggi: number
}

export function CompactBudgetBar({ budget, ingaggi }: CompactBudgetBarProps) {
  // --- Data calculation ---
  const maxVal = Math.max(budget, ingaggi, 1)
  const budgetPct = (budget / maxVal) * 100
  const ingaggiPct = (ingaggi / maxVal) * 100

  return (
    <div className="flex flex-col gap-1.5 w-full" style={{ minHeight: 56 }}>
      {/* Budget bar */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Budget</span>
          <span className="text-primary-400 font-medium font-mono">{budget}</span>
        </div>
        <div className="h-4 bg-surface-100/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Ingaggi bar */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Ingaggi</span>
          <span className="text-accent-400 font-medium font-mono">{ingaggi}</span>
        </div>
        <div className="h-4 bg-surface-100/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-500"
            style={{ width: `${ingaggiPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// 3. DeltaBar - Before/After Impact Bar
// ---------------------------------------------------------------------------
// Visualizes how a trade affects a financial metric (e.g., bilancio).
// Shows before value, after value, delta, and overlapping bars.
// ---------------------------------------------------------------------------

interface DeltaBarProps {
  before: number
  after: number
  label?: string
}

export function DeltaBar({ before, after, label }: DeltaBarProps) {
  // --- Data calculation ---
  const delta = after - before
  const maxAbs = Math.max(Math.abs(before), Math.abs(after), 1)
  const beforePct = Math.max(0, (before / maxAbs) * 100)
  const afterPct = Math.max(0, (after / maxAbs) * 100)

  // --- Semantic colors based on improvement ---
  const improves = delta >= 0
  const deltaColor = improves ? 'text-secondary-400' : 'text-danger-400'
  const barColor = improves ? 'bg-secondary-500' : 'bg-danger-500'

  return (
    <div className="flex flex-col gap-1">
      {/* Optional label */}
      {label && (
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      )}

      <div className="flex items-center gap-2">
        {/* Before value */}
        <span className="text-xs text-gray-400 w-12 text-right font-medium font-mono">
          {before}
        </span>

        {/* Bar container */}
        <div className="flex-1 relative h-5 bg-surface-100/30 rounded-full overflow-hidden">
          {/* Before indicator (grey, semi-transparent) */}
          <div
            className="absolute top-0 h-full bg-gray-500/40 rounded-full transition-all duration-500"
            style={{ width: `${beforePct}%` }}
          />
          {/* After indicator (colored) */}
          <div
            className={`absolute top-0 h-full ${barColor}/60 rounded-full transition-all duration-500`}
            style={{ width: `${afterPct}%` }}
          />
        </div>

        {/* After value */}
        <span className={`text-xs font-semibold w-12 font-mono ${deltaColor}`}>
          {after}
        </span>

        {/* Delta badge */}
        <span className={`text-sm font-bold font-mono ${deltaColor} min-w-[40px]`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// 4. HealthDot - Quick Health Status Indicator
// ---------------------------------------------------------------------------
// A small colored dot acting as a traffic-light signal for financial health.
//   bilancio > 200  -> Green
//   bilancio >= 100  -> Amber
//   bilancio < 100  -> Red
// ---------------------------------------------------------------------------

interface HealthDotProps {
  bilancio: number
}

export function HealthDot({ bilancio }: HealthDotProps) {
  const colorClass =
    bilancio > 200
      ? 'bg-green-400 shadow-green-400/50'
      : bilancio >= 100
        ? 'bg-amber-400 shadow-amber-400/50'
        : 'bg-red-400 shadow-red-400/50'

  return <div className={`w-3 h-3 rounded-full shadow-lg ${colorClass}`} />
}
