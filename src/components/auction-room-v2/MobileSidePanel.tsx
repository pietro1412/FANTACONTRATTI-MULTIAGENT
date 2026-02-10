import { useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { FinancialDashboard } from './FinancialDashboard'
import { MyPortfolio } from './MyPortfolio'
import type { ManagersStatusData, ManagerData, FirstMarketStatus, MyRosterSlots } from '../../types/auctionroom.types'

interface MobileSidePanelProps {
  managersStatus: ManagersStatusData | null
  firstMarketStatus: FirstMarketStatus | null
  onSelectManager: (m: ManagerData) => void
  myRosterSlots: MyRosterSlots | null
  budget: number
}

export function MobileSidePanel({
  managersStatus,
  firstMarketStatus,
  onSelectManager,
  myRosterSlots,
  budget,
}: MobileSidePanelProps) {
  const [sheet, setSheet] = useState<'managers' | 'roster' | null>(null)

  return (
    <>
      {/* Trigger buttons */}
      <div className="flex gap-2 lg:hidden">
        <button
          onClick={() => setSheet('managers')}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 text-xs font-medium text-gray-300 active:scale-95 transition-transform min-h-[44px]"
        >
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Spy</span>
          {managersStatus && (
            <span className="text-[10px] text-gray-500">({managersStatus.managers.length})</span>
          )}
        </button>
        <button
          onClick={() => setSheet('roster')}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-white/10 text-xs font-medium text-gray-300 active:scale-95 transition-transform min-h-[44px]"
        >
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>Rosa</span>
          {myRosterSlots && (
            <span className="text-[10px] text-gray-500 font-mono">
              ({(['P', 'D', 'C', 'A'] as const).reduce((s, p) => s + myRosterSlots.slots[p].filled, 0)}/
              {(['P', 'D', 'C', 'A'] as const).reduce((s, p) => s + myRosterSlots.slots[p].total, 0)})
            </span>
          )}
        </button>
      </div>

      {/* Bottom Sheet: Managers */}
      <BottomSheet
        isOpen={sheet === 'managers'}
        onClose={() => setSheet(null)}
        title="Spy Financials"
        maxHeight="80vh"
      >
        <div className="p-2">
          <FinancialDashboard
            managersStatus={managersStatus}
            firstMarketStatus={firstMarketStatus}
            onSelectManager={(m) => { onSelectManager(m); setSheet(null) }}
          />
        </div>
      </BottomSheet>

      {/* Bottom Sheet: Roster */}
      <BottomSheet
        isOpen={sheet === 'roster'}
        onClose={() => setSheet(null)}
        title="La Mia Rosa"
        maxHeight="80vh"
      >
        <div className="p-2">
          <MyPortfolio myRosterSlots={myRosterSlots} budget={budget} />
        </div>
      </BottomSheet>
    </>
  )
}
