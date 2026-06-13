import { getLeagueIdentity } from '@/components/ui/LeagueCrest'

export interface ManagerStripMember {
  id: string
  userId: string
  displayName: string
  isMe: boolean
}

export interface ManagerStripProps {
  members: ManagerStripMember[]
  selectedId: string
  onSelect: (id: string) => void
  /** Micro-label shown before the chips (default "Rosa di"). */
  label?: string
  className?: string
}

/**
 * Horizontal avatar-strip of managers (who you are viewing). Replaces the old
 * <select>: a pill per manager with a deterministic-color Monogram, "me" marked
 * with a dashed border, the selected one highlighted in gold. Scrolls
 * horizontally on narrow screens. Shared across the Rose / Giocatori cluster.
 */
export function ManagerStrip({ members, selectedId, onSelect, label = 'Rosa di', className = '' }: ManagerStripProps) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className="micro-label flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
        {members.map(m => {
          const selected = m.id === selectedId
          const { gradient } = getLeagueIdentity(m.displayName)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => { onSelect(m.id); }}
              aria-pressed={selected}
              className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs flex-shrink-0 transition-colors border ${
                selected
                  ? 'border-accent-500/55 bg-accent-500/10 text-white font-semibold'
                  : 'border-surface-50 bg-surface-300 text-gray-400 hover:text-gray-200'
              } ${m.isMe ? 'border-dashed' : ''}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br ${gradient} font-display font-bold text-[9px] text-white flex-shrink-0`}
                aria-hidden="true"
              >
                {getLeagueIdentity(m.displayName).initials}
              </span>
              <span className="whitespace-nowrap">
                {m.displayName}
                {m.isMe && <span className="text-accent-400"> (tu)</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ManagerStrip
