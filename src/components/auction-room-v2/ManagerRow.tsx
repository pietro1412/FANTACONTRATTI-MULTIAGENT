import type { ManagerData } from '../../types/auctionroom.types'

interface ManagerRowProps {
  manager: ManagerData
  turnIndex: number
  isCurrent: boolean
  isMe: boolean
  onClick: () => void
}

export function ManagerRow({ manager: m, turnIndex, isCurrent, isMe, onClick }: ManagerRowProps) {
  const budgetSpent = m.roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-surface-300/50 transition-colors ${
        isCurrent ? 'bg-accent-500/10' : ''
      } ${isMe && !isCurrent ? 'bg-primary-500/5' : ''}`}
    >
      {/* Turn + Connection */}
      <td className="px-1.5 py-1.5">
        <div className="relative inline-flex">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isCurrent ? 'bg-accent-500 text-dark-900' : 'bg-surface-300 text-gray-400'
          }`}>
            {turnIndex >= 0 ? turnIndex + 1 : '-'}
          </span>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-200 ${
            m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
          }`} />
        </div>
      </td>

      {/* Name */}
      <td className="px-1.5 py-1.5">
        <div className={`truncate max-w-[70px] text-xs font-medium ${
          isMe ? 'text-primary-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'
        }`}>
          {m.username}
          {isMe && <span className="text-primary-300 ml-0.5">·</span>}
        </div>
      </td>

      {/* Bilancio */}
      <td className="px-1.5 py-1.5 text-center">
        <span className={`font-mono font-bold text-xs ${
          bilancio <= 100 ? 'text-red-400' : bilancio <= 200 ? 'text-amber-400' : 'text-green-400'
        }`}>
          {bilancio}
        </span>
      </td>

      {/* Acquisti */}
      <td className="px-1.5 py-1.5 text-center">
        <span className="font-mono text-xs text-gray-400">{budgetSpent}</span>
      </td>

      {/* Ingaggi */}
      <td className="px-1.5 py-1.5 text-center">
        <span className="font-mono text-xs text-gray-400">{monteIngaggi}</span>
      </td>

      {/* Slot P/D/C/A */}
      {(['P', 'D', 'C', 'A'] as const).map(pos => {
        const slot = m.slotsByPosition[pos]
        const colorMap = { P: 'text-amber-400', D: 'text-blue-400', C: 'text-emerald-400', A: 'text-red-400' }
        return (
          <td key={pos} className="px-1 py-1.5 text-center">
            <span className={`font-mono text-[10px] ${slot.filled >= slot.total ? colorMap[pos] : 'text-gray-500'}`}>
              {slot.filled}/{slot.total}
            </span>
          </td>
        )
      })}
    </tr>
  )
}
