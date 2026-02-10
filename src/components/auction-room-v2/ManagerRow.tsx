import type { ManagerData } from '../../types/auctionroom.types'

interface ManagerRowProps {
  manager: ManagerData
  turnIndex: number
  isCurrent: boolean
  isMe: boolean
  onClick: () => void
}

export function ManagerRow({ manager: m, turnIndex, isCurrent, isMe, onClick }: ManagerRowProps) {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  const maxBid = Math.max(0, bilancio - (emptySlots * 2))
  // maxBid bar percentage relative to budget
  const maxBidPercent = m.currentBudget > 0 ? Math.min(100, (maxBid / m.currentBudget) * 100) : 0
  const barColor = maxBidPercent > 50 ? 'bg-green-500' : maxBidPercent > 25 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg p-2 transition-all border ${
        isCurrent
          ? 'bg-accent-500/10 border-accent-500/40'
          : isMe
            ? 'bg-sky-500/5 border-sky-500/20'
            : 'bg-slate-800/40 border-white/5 hover:border-white/15'
      }`}
    >
      {/* Top row: avatar + name + budget */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Avatar with turn number */}
        <div className="relative flex-shrink-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isCurrent
              ? 'bg-gradient-to-br from-accent-500 to-accent-600 text-dark-900'
              : isMe
                ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white'
                : 'bg-slate-700 text-gray-300'
          }`}>
            {m.username.charAt(0).toUpperCase()}
          </div>
          {/* Connection dot */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
            m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
          }`} />
        </div>

        {/* Name + Team */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate ${
            isMe ? 'text-sky-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'
          }`}>
            {m.username}
            {isMe && <span className="text-sky-300 ml-0.5">*</span>}
          </p>
          {m.teamName && (
            <p className="text-[10px] text-gray-500 truncate">{m.teamName}</p>
          )}
        </div>

        {/* Turn badge */}
        {turnIndex >= 0 && (
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            isCurrent ? 'bg-accent-500 text-dark-900' : 'bg-slate-700/50 text-gray-400'
          }`}>
            #{turnIndex + 1}
          </span>
        )}
      </div>

      {/* Budget row */}
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono font-bold text-sm ${
          bilancio <= 100 ? 'text-red-400' : bilancio <= 200 ? 'text-amber-400' : 'text-green-400'
        }`}>
          {bilancio}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">max {maxBid}</span>
      </div>

      {/* MaxBid progress bar */}
      <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${maxBidPercent}%` }}
        />
      </div>

      {/* Slot P/D/C/A compact */}
      <div className="flex gap-1">
        {(['P', 'D', 'C', 'A'] as const).map(pos => {
          const slot = m.slotsByPosition[pos]
          const colorMap = { P: 'text-amber-400', D: 'text-blue-400', C: 'text-emerald-400', A: 'text-red-400' }
          return (
            <span key={pos} className={`font-mono text-[9px] ${slot.filled >= slot.total ? colorMap[pos] : 'text-gray-600'}`}>
              {pos}{slot.filled}/{slot.total}
            </span>
          )
        })}
      </div>
    </div>
  )
}
