import { useMemo } from 'react'
import type { ManagersStatusData, ManagerData, FirstMarketStatus } from '../../types/auctionroom.types'
import { ManagerRow } from './ManagerRow'

interface FinancialDashboardProps {
  managersStatus: ManagersStatusData | null
  firstMarketStatus: FirstMarketStatus | null
  onSelectManager: (m: ManagerData) => void
}

function MarketPulseWidget({ managersStatus }: { managersStatus: ManagersStatusData }) {
  const { inflation, avgPaid, avgQuot, count, roleInflation, currentRole } = useMemo(() => {
    const allRoster = managersStatus.managers.flatMap(m => m.roster)
    const withQuot = allRoster.filter(r => r.quotation && r.quotation > 0)
    if (withQuot.length === 0) return { inflation: 0, avgPaid: 0, avgQuot: 0, count: 0, roleInflation: 0, currentRole: managersStatus.currentRole }

    const totalPaid = withQuot.reduce((s, r) => s + r.acquisitionPrice, 0)
    const totalQuot = withQuot.reduce((s, r) => s + (r.quotation || 0), 0)
    const ap = totalPaid / withQuot.length
    const aq = totalQuot / withQuot.length
    const inf = aq > 0 ? ((ap / aq) - 1) * 100 : 0

    // Compute role-specific inflation
    const roleRoster = withQuot.filter(r => r.position === managersStatus.currentRole)
    let roleInf = 0
    if (roleRoster.length > 0) {
      const rPaid = roleRoster.reduce((s, r) => s + r.acquisitionPrice, 0) / roleRoster.length
      const rQuot = roleRoster.reduce((s, r) => s + (r.quotation || 0), 0) / roleRoster.length
      roleInf = rQuot > 0 ? ((rPaid / rQuot) - 1) * 100 : 0
    }

    return {
      inflation: Math.round(inf * 10) / 10,
      avgPaid: Math.round(ap),
      avgQuot: Math.round(aq),
      count: withQuot.length,
      roleInflation: Math.round(roleInf),
      currentRole: managersStatus.currentRole,
    }
  }, [managersStatus])

  if (count === 0) return null

  const barPercent = Math.min(100, Math.max(0, 50 + inflation / 2))
  const isPositive = inflation >= 0

  const ROLE_NAMES: Record<string, string> = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }
  const roleName = ROLE_NAMES[currentRole] || currentRole

  return (
    <div className="mx-2 mb-2 p-3 rounded-xl border border-white/5 bg-slate-800/40">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Market Pulse</h4>
        <span className={`text-sm font-mono font-bold ${
          isPositive ? 'text-red-400' : 'text-green-400'
        }`}>
          {isPositive ? '+' : ''}{inflation}%
        </span>
      </div>

      {/* Inflation bar */}
      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${isPositive ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mb-2">
        <span>Media Pagata: <span className="text-gray-300">{avgPaid}M</span></span>
        <span>Quotazione: <span className="text-gray-300">{avgQuot}M</span></span>
      </div>

      {/* Role insight text */}
      {roleInflation !== 0 && (
        <p className="text-[10px] text-gray-400 leading-relaxed">
          I prezzi per il reparto <span className="text-white font-semibold">{roleName}</span> sono{' '}
          {roleInflation > 0 ? (
            <span className="text-red-400">superiori del {Math.abs(roleInflation)}%</span>
          ) : (
            <span className="text-green-400">inferiori del {Math.abs(roleInflation)}%</span>
          )}{' '}
          rispetto alla quotazione media.
        </p>
      )}
    </div>
  )
}

export function FinancialDashboard({ managersStatus, firstMarketStatus, onSelectManager }: FinancialDashboardProps) {
  if (!managersStatus) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
    if (!firstMarketStatus?.turnOrder) return 0
    return firstMarketStatus.turnOrder.indexOf(a.id) - firstMarketStatus.turnOrder.indexOf(b.id)
  })

  const leagueSize = managersStatus.managers.length

  // Compute average effective budget for PAR calculation
  const avgBudget = useMemo(() => {
    if (managersStatus.managers.length === 0) return 0
    const totalBudget = managersStatus.managers.reduce((sum, m) => {
      const monte = m.roster.reduce((s, r) => s + (r.contract?.salary || 0), 0)
      return sum + (m.currentBudget - monte)
    }, 0)
    return Math.round(totalBudget / managersStatus.managers.length)
  }, [managersStatus])

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="font-black text-white text-sm uppercase tracking-wide">Spy Financials</h3>
        </div>
        <span className="text-[11px] text-gray-400 font-semibold bg-slate-800/60 px-2 py-0.5 rounded-full">
          Lega a {leagueSize}
        </span>
      </div>

      {/* Legend */}
      <div className="px-3 py-1.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-start gap-3 text-[9px] text-gray-500 leading-relaxed">
          <span><span className="text-amber-400 font-bold">Max Bid</span> = offerta max (budget - slot vuoti)</span>
          <span><span className="text-green-400 font-bold">C.M.S.</span> = costo medio per slot</span>
          <span><span className="text-sky-400 font-bold">P.A.R.</span> = potere vs media lega</span>
        </div>
      </div>

      {/* Manager Cards */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
        {sortedManagers.map(m => {
          const turnIndex = firstMarketStatus?.turnOrder?.indexOf(m.id) ?? -1
          return (
            <ManagerRow
              key={m.id}
              manager={m}
              turnIndex={turnIndex}
              isCurrent={m.isCurrentTurn}
              isMe={m.id === managersStatus.myId}
              onClick={() => onSelectManager(m)}
              avgBudget={avgBudget}
            />
          )
        })}
      </div>

      {/* Market Pulse Widget */}
      <MarketPulseWidget managersStatus={managersStatus} />

      {/* Turn Queue */}
      {firstMarketStatus?.turnOrder && (
        <div className="p-2 border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase">Coda turni</p>
          <div className="flex gap-1 flex-wrap">
            {firstMarketStatus.turnOrder.map((memberId, i) => {
              const mgr = managersStatus.managers.find(m => m.id === memberId)
              if (!mgr) return null
              const isCurrentTurn = mgr.isCurrentTurn
              return (
                <span
                  key={memberId}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isCurrentTurn
                      ? 'bg-accent-500 text-dark-900'
                      : 'bg-slate-800/50 text-gray-400'
                  }`}
                >
                  {i + 1}. {mgr.username.slice(0, 6)}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
