import type { ManagerData } from '../../types/auctionroom.types'

interface ManagerRowProps {
  manager: ManagerData
  turnIndex: number
  isCurrent: boolean
  isMe: boolean
  onClick: () => void
  currentRole: string
  isHolding: boolean // holds the current highest bid
}

const POS_BAR_COLORS: Record<string, { filled: string; empty: string; label: string }> = {
  P: { filled: 'bg-amber-400', empty: 'bg-amber-400/20', label: 'text-amber-400' },
  D: { filled: 'bg-blue-400', empty: 'bg-blue-400/20', label: 'text-blue-400' },
  C: { filled: 'bg-emerald-400', empty: 'bg-emerald-400/20', label: 'text-emerald-400' },
  A: { filled: 'bg-red-400', empty: 'bg-red-400/20', label: 'text-red-400' },
}

export function computeManagerMaxBid(m: ManagerData): number {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  return Math.max(0, bilancio - Math.max(0, emptySlots - 1))
}

export function ManagerRow({ manager: m, turnIndex, isCurrent, isMe, onClick, currentRole, isHolding }: ManagerRowProps) {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  const maxBid = computeManagerMaxBid(m)

  const roleSlot = m.slotsByPosition[currentRole as 'P' | 'D' | 'C' | 'A']
  const isRoleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false

  // Phase/turn label
  const phaseLabel = isCurrent ? 'NOMINA' : turnIndex >= 0 ? `TURNO ${turnIndex + 1}` : 'SCOUTING'

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl p-2.5 transition-all border ${
        isHolding
          ? 'bg-primary-500/10 border-primary-500/50 ring-1 ring-primary-500/25'
          : isCurrent
            ? 'bg-accent-500/10 border-accent-500/40 ring-1 ring-accent-500/20'
            : isMe
              ? 'bg-sky-500/5 border-sky-500/30 ring-1 ring-sky-500/15'
              : 'bg-slate-800/40 border-white/5 hover:border-white/15'
      } ${isRoleFull && !isMe ? 'opacity-40' : ''}`}
    >
      {/* Top row: avatar + name + phase */}
      <div className="flex items-center gap-2.5 mb-2">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            isCurrent
              ? 'bg-gradient-to-br from-accent-500 to-accent-600 text-dark-900'
              : isMe
                ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white'
                : 'bg-slate-700 text-gray-300'
          }`}>
            {m.username.charAt(0).toUpperCase()}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-slate-900 ${
            m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
          }`} />
        </div>

        {/* Name + Phase / status chips */}
        <div className="min-w-0 flex-1">
          <p className={`text-sms font-bold truncate ${
            isMe ? 'text-sky-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'
          }`}>
            {m.teamName || m.username}
          </p>
          <div className="flex items-center gap-1.5">
            {isHolding && (
              <span className="text-sm font-bold text-primary-400 uppercase tracking-wide">Offerta</span>
            )}
            {isRoleFull && (
              <span className="text-sm font-semibold text-amber-400/80 uppercase tracking-wide">Slot pieni</span>
            )}
            {!isHolding && !isRoleFull && (
              <span className="text-sm text-gray-500 font-semibold uppercase tracking-wide">{phaseLabel}</span>
            )}
          </div>
        </div>

        {/* Department heatmap bars */}
        <div className="flex gap-0.5 flex-shrink-0">
          {(['P', 'D', 'C', 'A'] as const).map(pos => {
            const slot = m.slotsByPosition[pos]
            const fillPercent = slot.total > 0 ? (slot.filled / slot.total) * 100 : 0
            const barColors = POS_BAR_COLORS[pos] ?? { filled: 'bg-gray-400', empty: 'bg-gray-400/20', label: 'text-gray-400' }
            return (
              <div key={pos} className="flex flex-col items-center gap-0.5" title={`${pos} ${slot.filled}/${slot.total}`}>
                <span className={`text-sm font-bold ${barColors.label}`}>{pos}</span>
                <div className={`w-2.5 h-8 rounded-sm ${barColors.empty} overflow-hidden flex flex-col-reverse`}>
                  <div
                    className={`w-full rounded-sm ${barColors.filled} transition-all`}
                    style={{ height: `${fillPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom row: the two actionable numbers — max bid (big) + budget (small) */}
      <div className="flex items-end justify-between gap-2">
        <div title={`Offerta max possibile.\nBudget (${bilancio}M) - Slot vuoti rimanenti (${Math.max(0, emptySlots - 1)}) = ${maxBid}M`}>
          <p className="text-sm text-gray-500 uppercase font-semibold leading-none mb-0.5">Offerta max</p>
          <p className="text-base font-mono font-bold text-amber-400 leading-none">{maxBid}M</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 uppercase font-semibold leading-none mb-0.5">Budget</p>
          <p className="text-sms font-mono font-semibold text-gray-300 leading-none">{bilancio}M</p>
        </div>
      </div>
    </div>
  )
}
