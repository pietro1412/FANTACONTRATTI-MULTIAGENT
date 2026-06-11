import type { ManagersStatusData, ManagerData, FirstMarketStatus } from '../../types/auctionroom.types'
import { ManagerRow, computeManagerMaxBid } from './ManagerRow'

interface FinancialDashboardProps {
  managersStatus: ManagersStatusData | null
  firstMarketStatus: FirstMarketStatus | null
  onSelectManager: (m: ManagerData) => void
  currentBidderUsername?: string | null
}

function isRoleFull(m: ManagerData, currentRole: string): boolean {
  const slot = m.slotsByPosition[currentRole as 'P' | 'D' | 'C' | 'A']
  return slot ? slot.filled >= slot.total : false
}

export function FinancialDashboard({ managersStatus, firstMarketStatus, onSelectManager, currentBidderUsername }: FinancialDashboardProps) {
  if (!managersStatus) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  const currentRole = managersStatus.currentRole

  // Relevance order: bid holder pinned on top, then by max bid (the only
  // actionable metric) descending; managers who can no longer bid (role slots
  // full) sink to the bottom.
  const sortedManagers = [...managersStatus.managers].sort((a, b) => {
    const aHolds = a.username === currentBidderUsername
    const bHolds = b.username === currentBidderUsername
    if (aHolds !== bHolds) return aHolds ? -1 : 1
    const aFull = isRoleFull(a, currentRole)
    const bFull = isRoleFull(b, currentRole)
    if (aFull !== bFull) return aFull ? 1 : -1
    return computeManagerMaxBid(b) - computeManagerMaxBid(a)
  })

  const leagueSize = managersStatus.managers.length

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-black text-white text-sm uppercase tracking-wide">Manager</h3>
        </div>
        <span className="text-sm text-gray-400 font-semibold bg-slate-800/60 px-2 py-0.5 rounded-full">
          Lega a {leagueSize}
        </span>
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
              onClick={() => { onSelectManager(m); }}
              currentRole={currentRole}
              isHolding={m.username === currentBidderUsername}
            />
          )
        })}
      </div>

      {/* Sorting note */}
      <div className="px-3 py-2 border-t border-white/10 flex-shrink-0">
        <p className="text-sm text-gray-500 leading-snug">
          Ordinati per offerta max · chi detiene l&apos;offerta è in cima
        </p>
      </div>
    </div>
  )
}
