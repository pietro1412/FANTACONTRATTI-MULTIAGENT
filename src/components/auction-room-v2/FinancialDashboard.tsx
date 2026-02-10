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
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
    if (!firstMarketStatus?.turnOrder) return 0
    return firstMarketStatus.turnOrder.indexOf(a.id) - firstMarketStatus.turnOrder.indexOf(b.id)
  })

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-2.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="font-bold text-white text-xs">Spy Financials</h3>
        </div>
        {managersStatus.allConnected === false && (
          <span className="text-[10px] text-red-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Offline
          </span>
        )}
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
            />
          )
        })}
      </div>

      {/* Turn Queue */}
      {firstMarketStatus?.turnOrder && (
        <div className="p-2 border-t border-white/10 flex-shrink-0">
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
