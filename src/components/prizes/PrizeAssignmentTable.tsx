import { X } from 'lucide-react'
import { Monogram } from '@/components/ui/Monogram'
import { AmountStepper } from '@/components/ui/AmountStepper'

interface PrizeCategory {
  id: string
  name: string
  isSystemPrize: boolean
}

interface PrizeMember {
  id: string
  teamName: string
  username: string
  currentBudget: number
}

interface PrizeAssignmentTableProps {
  members: PrizeMember[]
  categories: PrizeCategory[]
  isFinalized: boolean
  /** True when individual indemnity column should be shown. */
  showIndemnities: boolean
  getPrizeAmount: (categoryId: string, memberId: string) => number
  getIndemnityTotal: (memberId: string) => number
  getMemberTotal: (memberId: string) => number
  onPrizeChange: (categoryId: string, memberId: string, value: number) => void
  onDeleteCategory: (categoryId: string) => void
}

/**
 * Deduplicated prize assignment table. Renders a wide table on desktop and a
 * stacked card layout on mobile from a SINGLE data source (no divergent trees).
 */
export function PrizeAssignmentTable({
  members,
  categories,
  isFinalized,
  showIndemnities,
  getPrizeAmount,
  getIndemnityTotal,
  getMemberTotal,
  onPrizeChange,
  onDeleteCategory,
}: PrizeAssignmentTableProps) {
  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-50/20">
              <th className="text-left p-3 micro-label">Manager / Squadra</th>
              <th className="text-center p-2 micro-label border-l border-surface-50/20">Budget</th>
              {categories.map(cat => (
                <th key={cat.id} className="text-center p-2 micro-label min-w-[110px]">
                  <div className="flex items-center justify-center gap-1">
                    <span className="truncate">{cat.name}</span>
                    {!cat.isSystemPrize && !isFinalized && (
                      <button
                        onClick={() => { onDeleteCategory(cat.id) }}
                        className="text-danger-400 hover:text-danger-300"
                        aria-label={`Elimina categoria ${cat.name}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {showIndemnities && (
                <th className="text-center p-2 micro-label text-accent-400 min-w-[100px]">Indennizzi</th>
              )}
              <th className="text-center p-2 micro-label text-primary-400 border-l border-surface-50/20">Premio Tot.</th>
              <th className="text-center p-2 micro-label text-secondary-400 border-l border-surface-50/20">Budget Tot.</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-t border-surface-50/10 hover:bg-surface-100/30">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Monogram name={member.teamName || member.username} size="md" />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-white truncate">{member.teamName || 'Senza nome'}</p>
                      <p className="text-gray-500 text-xs">@{member.username}</p>
                    </div>
                  </div>
                </td>
                <td className="p-2 text-center border-l border-surface-50/20">
                  <span className="stat-number text-accent-400">{member.currentBudget}M</span>
                </td>
                {categories.map(cat => (
                  <td key={cat.id} className="text-center py-2 px-1">
                    {isFinalized ? (
                      <span className="font-mono text-gray-300">{getPrizeAmount(cat.id, member.id)}M</span>
                    ) : (
                      <AmountStepper
                        value={getPrizeAmount(cat.id, member.id)}
                        onChange={(v) => { onPrizeChange(cat.id, member.id, v) }}
                        min={0}
                        unit="M"
                        size="sm"
                        aria-label={`Premio ${cat.name} per ${member.teamName || member.username}`}
                      />
                    )}
                  </td>
                ))}
                {showIndemnities && (
                  <td className="text-center py-2 px-1">
                    <span className="stat-number text-accent-400">{getIndemnityTotal(member.id)}M</span>
                  </td>
                )}
                <td className="text-center p-2 border-l border-surface-50/20">
                  <span className="stat-number text-lg text-primary-400">{getMemberTotal(member.id)}M</span>
                </td>
                <td className="text-center p-2 border-l border-surface-50/20">
                  <span className="stat-number text-lg text-secondary-400">
                    {member.currentBudget + getMemberTotal(member.id)}M
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-4">
        {members.map(member => (
          <div key={member.id} className="bg-surface-300 rounded-xl p-4 border border-surface-50/20">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-surface-50/20">
              <Monogram name={member.teamName || member.username} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-white truncate">{member.teamName || 'Senza nome'}</p>
                <p className="text-gray-500 text-sm">@{member.username}</p>
              </div>
              <div className="text-right">
                <p className="stat-number text-lg text-primary-400">{getMemberTotal(member.id)}M</p>
                <p className="micro-label text-[8.5px]">Premio totale</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-gray-500">Budget attuale</span>
              <span className="stat-number text-accent-400">{member.currentBudget}M</span>
            </div>
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-gray-500">Budget totale</span>
              <span className="stat-number text-secondary-400">
                {member.currentBudget + getMemberTotal(member.id)}M
              </span>
            </div>

            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between gap-2">
                  <span className="text-gray-300 text-sm truncate flex-1">{cat.name}</span>
                  {isFinalized ? (
                    <span className="font-mono text-gray-300">{getPrizeAmount(cat.id, member.id)}M</span>
                  ) : (
                    <AmountStepper
                      value={getPrizeAmount(cat.id, member.id)}
                      onChange={(v) => { onPrizeChange(cat.id, member.id, v) }}
                      min={0}
                      unit="M"
                      size="sm"
                      aria-label={`Premio ${cat.name} per ${member.teamName || member.username}`}
                    />
                  )}
                </div>
              ))}
              {showIndemnities && (
                <div className="flex items-center justify-between pt-2 border-t border-surface-50/20">
                  <span className="text-accent-400 text-sm font-medium">Indennizzi</span>
                  <span className="stat-number text-accent-400">{getIndemnityTotal(member.id)}M</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
