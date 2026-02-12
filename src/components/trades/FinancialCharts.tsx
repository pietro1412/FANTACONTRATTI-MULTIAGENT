// ============================================================================
// FinancialCharts.tsx
// Custom financial visualization widgets - NO external charting libraries.
// SVG inline for gauges, Tailwind CSS for bars.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. BilancioGauge - SVG Semi-Circle Gauge
// ---------------------------------------------------------------------------
// viewBox: "0 0 100 55"
// Arc center: (50, 50), radius: 40, stroke-width: 8
// Three hardcoded arc paths for zones:
//   Red   (0-15%):  M 10 50 A 40 40 0 0 1 18 31
//   Yellow(15-35%): M 18 31 A 40 40 0 0 1 36 15
//   Green (35-100%):M 36 15 A 40 40 0 0 1 90 50
// Needle: polygon rotated from -90deg (ratio=0) to +90deg (ratio=1)
// Text: positioned below SVG via absolute positioning
// ---------------------------------------------------------------------------

interface BilancioGaugeProps {
  bilancio: number
  budget: number
  size?: number
}

export function BilancioGauge({ bilancio, budget, size = 200 }: BilancioGaugeProps) {
  // Ratio clamped between 0 and 1
  const ratio = Math.max(0, Math.min(bilancio / Math.max(budget, 1), 1))

  // Needle rotation: -90deg (left, ratio=0) to +90deg (right, ratio=1)
  const angle = -90 + ratio * 180

  // Semantic text color
  const valueColor =
    bilancio < 0 ? '#ef4444' :
    bilancio < 30 ? '#eab308' :
    '#4ade80'

  const valueTwColor =
    bilancio < 0 ? 'text-red-400' :
    bilancio < 30 ? 'text-yellow-400' :
    'text-green-400'

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      {/* SVG Gauge */}
      <svg viewBox="0 0 100 55" className="w-full h-auto overflow-visible">
        {/* Background track */}
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round" />

        {/* Zone: Red 0-15% */}
        <path d="M 10 50 A 40 40 0 0 1 18 31" fill="none" stroke="#ef4444" strokeWidth={8} strokeLinecap="round" opacity={0.4} />

        {/* Zone: Yellow 15-35% */}
        <path d="M 18 31 A 40 40 0 0 1 36 15" fill="none" stroke="#eab308" strokeWidth={8} strokeLinecap="round" opacity={0.4} />

        {/* Zone: Green 35-100% */}
        <path d="M 36 15 A 40 40 0 0 1 90 50" fill="none" stroke="#22c55e" strokeWidth={8} strokeLinecap="round" opacity={0.4} />

        {/* Needle (polygon triangle) */}
        <polygon
          points="48.5,50 51.5,50 50,14"
          fill="#e2e8f0"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50px 50px',
            transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Needle pivot */}
        <circle cx={50} cy={50} r={4} fill="#e2e8f0" />
      </svg>

      {/* Text below SVG */}
      <div className="flex flex-col items-center -mt-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bilancio</span>
        <span
          className={`text-2xl font-bold font-mono ${valueTwColor}`}
          style={{ color: valueColor }}
        >
          {bilancio}
        </span>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// 2. CompactBudgetBar - Dual Horizontal Bar (Budget vs Ingaggi)
// ---------------------------------------------------------------------------
// Compact loading-bar style. Two separate bars normalized to max(budget, ingaggi).
// ---------------------------------------------------------------------------

interface CompactBudgetBarProps {
  budget: number
  ingaggi: number
}

export function CompactBudgetBar({ budget, ingaggi }: CompactBudgetBarProps) {
  const maxVal = Math.max(budget, ingaggi, 1)
  const budgetPct = (budget / maxVal) * 100
  const ingaggiPct = (ingaggi / maxVal) * 100

  return (
    <div className="space-y-1 w-full">
      {/* Labels */}
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
        <span>Budget (<span className="text-emerald-400">{budget}</span>)</span>
        <span>Ingaggi (<span className="text-rose-400">{ingaggi}</span>)</span>
      </div>

      {/* Budget bar */}
      <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${budgetPct}%` }}
        />
      </div>

      {/* Ingaggi bar */}
      <div className="relative h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-rose-500 rounded-full transition-all duration-500"
          style={{ width: `${ingaggiPct}%` }}
        />
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// 3. DeltaBar - Before/After Impact Analysis
// ---------------------------------------------------------------------------
// Shows trade impact on bilancio with a before marker and after bar.
// ---------------------------------------------------------------------------

interface DeltaBarProps {
  before: number
  after: number
  label?: string
}

export function DeltaBar({ before, after, label }: DeltaBarProps) {
  const delta = after - before
  const maxAbs = Math.max(Math.abs(before), Math.abs(after), 1)
  const beforePct = Math.max(0, (before / maxAbs) * 100)
  const afterPct = Math.max(0, (after / maxAbs) * 100)
  const improves = delta >= 0

  return (
    <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {label || 'Impatto Bilancio'}
        </span>
        <span className={`font-mono text-xs font-bold ${improves ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta > 0 ? '+' : ''}{delta} FM
        </span>
      </div>

      {/* Bar */}
      <div className="relative h-3 w-full bg-slate-800 rounded-full overflow-hidden">
        {/* After bar (current level) */}
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-500 ${improves ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
          style={{ width: `${afterPct}%` }}
        />
        {/* Before marker (where we were) */}
        <div
          className="absolute top-0 w-1 h-full bg-white z-10"
          style={{
            left: `${beforePct}%`,
            transform: 'translateX(-50%)',
            boxShadow: '0 0 5px rgba(255,255,255,0.8)',
          }}
        />
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// 4. HealthDot - Quick Health Status Indicator
// ---------------------------------------------------------------------------
//   bilancio > 200  -> Green  (with glow)
//   bilancio >= 100 -> Amber  (with glow)
//   bilancio < 100  -> Red    (with glow)
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
