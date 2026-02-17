import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import type { TeamData } from '../finance/types'
import { getTeamBalance, POSITION_COLORS, POSITION_NAMES } from '../finance/types'

interface ManagerComparisonProps {
  myTeam: TeamData
  otherTeam: TeamData
  hasFinancialDetails: boolean
  onClose: () => void
  onStartTrade: (targetMemberId: string) => void
}

function MetricRow({ label, myVal, otherVal, format }: { label: string; myVal: number; otherVal: number; format?: (n: number) => string }) {
  const fmt = format || ((n: number) => String(n))
  const total = Math.abs(myVal) + Math.abs(otherVal) || 1
  const myPct = (Math.abs(myVal) / total) * 100
  const isBetter = myVal >= otherVal

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-base font-semibold font-mono w-16 text-right ${isBetter ? 'text-secondary-400' : 'text-white'}`}>{fmt(myVal)}</span>
        <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-surface-100/30">
          <div className={`${isBetter ? 'bg-secondary-500/70' : 'bg-gray-500/50'} transition-all`} style={{ width: `${myPct}%` }} />
          <div className={`${!isBetter ? 'bg-accent-500/70' : 'bg-gray-500/50'} transition-all`} style={{ width: `${100 - myPct}%` }} />
        </div>
        <span className={`text-base font-semibold font-mono w-16 ${!isBetter ? 'text-accent-400' : 'text-white'}`}>{fmt(otherVal)}</span>
      </div>
    </div>
  )
}

export function ManagerComparison({ myTeam, otherTeam, hasFinancialDetails, onClose, onStartTrade }: ManagerComparisonProps) {
  const myBalance = getTeamBalance(myTeam, hasFinancialDetails)
  const otherBalance = getTeamBalance(otherTeam, hasFinancialDetails)

  // Top 3 highest salary players from the other team
  const topContracts = [...otherTeam.players]
    .sort((a, b) => b.salary - a.salary)
    .slice(0, 3)

  return (
    <Card className="border-primary-500/40">
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h3 className="text-base font-bold text-white">
              Le tue finanze vs <span className="text-accent-400">{otherTeam.username}</span>
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-200 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Metrics side-by-side */}
          <div className="flex-1 space-y-3">
            {/* Column labels */}
            <div className="flex justify-between text-sm text-gray-400 uppercase tracking-wide px-1">
              <span>Tu</span>
              <span>{otherTeam.username}</span>
            </div>

            <MetricRow label="Budget" myVal={myTeam.budget} otherVal={otherTeam.budget} />
            <MetricRow label="Ingaggi" myVal={myTeam.annualContractCost} otherVal={otherTeam.annualContractCost} />
            <MetricRow label="Bilancio" myVal={myBalance} otherVal={otherBalance} format={n => `${n >= 0 ? '+' : ''}${n}`} />
            <MetricRow label="Rosa" myVal={myTeam.slotCount} otherVal={otherTeam.slotCount} format={n => `${n}/${myTeam.maxSlots}`} />
          </div>

          {/* Right: Position gaps + Top contracts */}
          <div className="flex-1 space-y-4">
            {/* Position gaps */}
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wide mb-2">Gap posizioni</p>
              <div className="grid grid-cols-2 gap-2">
                {(['P', 'D', 'C', 'A'] as const).map(pos => {
                  const myCount = myTeam.positionDistribution[pos]
                  const otherCount = otherTeam.positionDistribution[pos]
                  const diff = otherCount - myCount
                  return (
                    <div key={pos} className="flex items-center gap-2 bg-surface-300/60 rounded-lg px-3 py-2 border border-surface-50/10">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[pos]}`}>
                        {POSITION_NAMES[pos]?.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="text-sm font-mono text-white">{myCount}</span>
                      <span className="text-gray-400 text-xs">vs</span>
                      <span className="text-sm font-mono text-white">{otherCount}</span>
                      {diff !== 0 && (
                        <span className={`text-sm font-bold font-mono ml-auto ${diff > 0 ? 'text-secondary-400' : 'text-danger-400'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top 3 contracts */}
            {topContracts.length > 0 && (
              <div>
                <p className="text-sm text-gray-400 uppercase tracking-wide mb-2">Top contratti di {otherTeam.username}</p>
                <div className="space-y-1.5">
                  {topContracts.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-surface-300/60 rounded-lg px-3 py-2.5 border border-surface-50/10">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position] || 'bg-gray-500/20 text-gray-400'}`}>
                        {p.position}
                      </span>
                      <span className="text-sm text-white truncate flex-1">{p.name}</span>
                      <span className="text-sm font-mono text-accent-400 font-semibold">{p.salary}M</span>
                      <span className="text-xs font-mono text-gray-500">{p.duration}a</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-4 pt-3 border-t border-surface-50/20">
          <Button
            onClick={() => { onStartTrade(otherTeam.memberId); }}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Crea Offerta a {otherTeam.username}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
