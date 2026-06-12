import { memo } from 'react'
import { Monogram } from '@/components/ui/Monogram'
import type { MemberBudgetInfo } from '../../types/rubata.types'

export interface RubataRivalsStripProps {
  memberBudgets: MemberBudgetInfo[]
  /** Costo da coprire (costo rubata in OFFERING, prossimo rilancio in AUCTION) */
  cost: number
  ownerMemberId: string
  myMemberId: string | undefined
  title: string
}

/**
 * "Chi altro può rubarlo" (mockup v2): monogrammi dei manager con bilancio >= costo,
 * sbiaditi quelli fuori budget e il proprietario.
 */
export const RubataRivalsStrip = memo(function RubataRivalsStrip({
  memberBudgets,
  cost,
  ownerMemberId,
  myMemberId,
  title,
}: RubataRivalsStripProps) {
  const rivals = memberBudgets.filter(mb => mb.memberId !== myMemberId)
  if (rivals.length === 0) return null

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 px-3 py-2.5">
      <h3 className="micro-label block mb-2">
        {title} — bilancio ≥ {cost}M
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {rivals.map(mb => {
          const isOwner = mb.memberId === ownerMemberId
          const canPay = !isOwner && mb.residuo >= cost
          return (
            <span
              key={mb.memberId}
              className={`inline-flex items-center gap-1.5 rounded-full border border-surface-50 bg-surface-300 pl-1 pr-3 py-1 ${
                canPay ? '' : 'opacity-40'
              }`}
            >
              <Monogram
                name={mb.teamName || mb.username}
                size="sm"
                className={canPay ? 'border-secondary-500/60 text-secondary-400' : ''}
              />
              <span className="text-xs font-semibold text-gray-200 truncate max-w-[90px]">{mb.teamName || mb.username}</span>
              {isOwner ? (
                <span className="text-[10px] text-gray-500">proprietario</span>
              ) : (
                <span className={`text-[11px] font-mono font-semibold ${canPay ? 'text-secondary-400' : 'text-danger-400'}`}>
                  {mb.residuo}M{canPay ? '' : ' — fuori'}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
})
