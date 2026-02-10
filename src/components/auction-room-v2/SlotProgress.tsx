import { POSITION_GRADIENTS, POSITION_TEXT_COLORS, POSITION_NAMES } from '../ui/PositionBadge'

interface SlotProgressProps {
  position: 'P' | 'D' | 'C' | 'A'
  filled: number
  total: number
  isCurrent?: boolean
}

export function SlotProgress({ position, filled, total, isCurrent }: SlotProgressProps) {
  const percent = total > 0 ? (filled / total) * 100 : 0
  const isComplete = filled >= total
  const gradient = POSITION_GRADIENTS[position]
  const textColor = POSITION_TEXT_COLORS[position]
  const posName = POSITION_NAMES[position]

  return (
    <div className={`flex items-center gap-2 py-1 ${isCurrent ? 'opacity-100' : 'opacity-70'}`}>
      <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
        {position}
      </span>
      <span className="text-xs text-gray-400 w-6 hidden sm:inline">{posName.slice(0, 3)}</span>
      <div className="flex-1 h-2 bg-surface-400/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${gradient}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${isComplete ? textColor : 'text-gray-500'}`}>
        {filled}/{total}
      </span>
    </div>
  )
}
