import { ManagerListRow } from '@/components/ui/ManagerListRow'
import type { ManagersStatusData, ManagerData } from '../../types/auctionroom.types'

interface FinancialDashboardProps {
  managersStatus: ManagersStatusData | null
  onSelectManager: (m: ManagerData) => void
  currentBidderUsername?: string | null
}

export function computeManagerMaxBid(m: ManagerData): number {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  return Math.max(0, bilancio - Math.max(0, emptySlots - 1))
}

function isRoleFull(m: ManagerData, currentRole: string): boolean {
  const slot = m.slotsByPosition[currentRole as 'P' | 'D' | 'C' | 'A']
  return slot ? slot.filled >= slot.total : false
}

/**
 * Colonna Manager del cockpit (P5): righe unificate ManagerListRow —
 * monogramma, stato in gara, offerta max grande + budget piccolo.
 * Scroll interno (.panel-scroll), testata fissa.
 */
export function FinancialDashboard({ managersStatus, onSelectManager, currentBidderUsername }: FinancialDashboardProps) {
  if (!managersStatus) {
    return (
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-4">
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

  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl overflow-hidden h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-surface-50 flex items-baseline gap-2 flex-shrink-0">
        <h3 className="micro-label">Manager · offerte max</h3>
        <span className="ml-auto font-mono text-[10.5px] text-gray-500">
          Lega a {managersStatus.managers.length}
        </span>
      </div>

      {/* Manager rows — scroll interno */}
      <div className="panel-scroll flex-1 min-h-0">
        {sortedManagers.map(m => {
          const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
          const bilancio = m.currentBudget - monteIngaggi
          const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
            (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
          )
          const maxBid = computeManagerMaxBid(m)
          const roleSlot = m.slotsByPosition[currentRole as 'P' | 'D' | 'C' | 'A']
          const roleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false
          const isMe = m.id === managersStatus.myId
          const isHolding = m.username === currentBidderUsername

          return (
            <ManagerListRow
              key={m.id}
              name={m.teamName || m.username}
              isMe={isMe}
              isHolding={isHolding}
              dim={roleFull && !isMe}
              leadDot={isHolding}
              statusLine={
                <>
                  {isHolding && <b className="text-accent-400 font-semibold">Miglior offerta · </b>}
                  {roleSlot && (
                    roleFull
                      ? `Slot ${currentRole} ${roleSlot.filled}/${roleSlot.total} — non può rilanciare`
                      : `In gara · Slot ${currentRole} ${roleSlot.filled}/${roleSlot.total}`
                  )}
                </>
              }
              bigValue={roleFull ? '—' : maxBid}
              bigUnit={roleFull ? undefined : 'max'}
              bigValueGold={isHolding}
              smallValue={`budget ${bilancio}`}
              connectedDot={m.isConnected ?? null}
              onClick={() => { onSelectManager(m); }}
              title={`Offerta max possibile.\nBudget (${bilancio}M) - Slot vuoti rimanenti (${Math.max(0, emptySlots - 1)}) = ${maxBid}M`}
            />
          )
        })}
      </div>

      {/* Sorting note */}
      <div className="px-3.5 py-2 border-t border-surface-50 flex-shrink-0">
        <p className="text-sm text-gray-500 leading-snug">
          Ordinati per offerta max · chi detiene l&apos;offerta è in cima
        </p>
      </div>
    </div>
  )
}
