import type { ManagersStatusData, ManagerData, FirstMarketStatus } from '../../types/auctionroom.types'
import { ManagerRow } from './ManagerRow'

interface FinancialDashboardProps {
  managersStatus: ManagersStatusData | null
  firstMarketStatus: FirstMarketStatus | null
  onSelectManager: (m: ManagerData) => void
}

export function FinancialDashboard({ managersStatus, firstMarketStatus, onSelectManager }: FinancialDashboardProps) {
  if (!managersStatus) {
    return (
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
    if (!firstMarketStatus?.turnOrder) return 0
    return firstMarketStatus.turnOrder.indexOf(a.id) - firstMarketStatus.turnOrder.indexOf(b.id)
  })

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-surface-50/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">👔</span>
          <h3 className="font-bold text-white text-xs">Direttori Generali</h3>
        </div>
        {managersStatus.allConnected === false && (
          <span className="text-[10px] text-red-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Offline
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-[10px]">
          <thead className="bg-surface-300/50 sticky top-0">
            <tr>
              <th className="px-1.5 py-1 text-left text-gray-400 font-medium">#</th>
              <th className="px-1.5 py-1 text-left text-gray-400 font-medium">DG</th>
              <th className="px-1.5 py-1 text-center text-gray-400 font-medium" title="Bilancio">Bil.</th>
              <th className="px-1.5 py-1 text-center text-gray-400 font-medium" title="Acquisti">Acq.</th>
              <th className="px-1.5 py-1 text-center text-gray-400 font-medium" title="Ingaggi">Ing.</th>
              <th className="px-1 py-1 text-center text-amber-400 font-medium">P</th>
              <th className="px-1 py-1 text-center text-blue-400 font-medium">D</th>
              <th className="px-1 py-1 text-center text-emerald-400 font-medium">C</th>
              <th className="px-1 py-1 text-center text-red-400 font-medium">A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-50/10">
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
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Turn Queue */}
      {firstMarketStatus?.turnOrder && (
        <div className="p-2 border-t border-surface-50/20 flex-shrink-0">
          <p className="text-[10px] text-gray-500 mb-1">Coda turni</p>
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
                      : 'bg-surface-300 text-gray-400'
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
