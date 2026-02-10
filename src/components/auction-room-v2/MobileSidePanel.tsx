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
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-200 rounded-lg border border-surface-50/20 text-xs font-medium text-gray-300 active:scale-95 transition-transform min-h-[44px]"
        >
          <span>👔</span>
          <span>Manager</span>
          {managersStatus && (
            <span className="text-[10px] text-gray-500">({managersStatus.managers.length})</span>
          )}
        </button>
        <button
          onClick={() => setSheet('roster')}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-200 rounded-lg border border-surface-50/20 text-xs font-medium text-gray-300 active:scale-95 transition-transform min-h-[44px]"
        >
          <span>📋</span>
          <span>Rosa</span>
          {myRosterSlots && (
            <span className="text-[10px] text-gray-500">
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
        title="Direttori Generali"
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
