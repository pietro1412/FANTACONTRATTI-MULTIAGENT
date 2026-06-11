import type { ManagerData } from '../../types/auctionroom.types'

interface ManagerRowProps {
  manager: ManagerData
  isMe: boolean
  onClick: () => void
  currentRole: string
  isHolding: boolean // holds the current highest bid
}

export function computeManagerMaxBid(m: ManagerData): number {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  return Math.max(0, bilancio - Math.max(0, emptySlots - 1))
}

export function ManagerRow({ manager: m, isMe, onClick, currentRole, isHolding }: ManagerRowProps) {
  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
  const bilancio = m.currentBudget - monteIngaggi
  const emptySlots = (['P', 'D', 'C', 'A'] as const).reduce(
    (sum, pos) => sum + (m.slotsByPosition[pos].total - m.slotsByPosition[pos].filled), 0
  )
  const maxBid = computeManagerMaxBid(m)

  const roleSlot = m.slotsByPosition[currentRole as 'P' | 'D' | 'C' | 'A']
  const isRoleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl px-2.5 py-2 transition-all border flex items-center gap-2.5 ${
        isHolding
          ? 'bg-primary-500/10 border-primary-500/50 ring-1 ring-primary-500/25'
          : isMe
            ? 'bg-accent-500/5 border-accent-500/40 ring-1 ring-accent-500/15'
            : 'bg-surface-300/60 border-surface-50/60 hover:border-surface-50'
      } ${isRoleFull && !isMe ? 'opacity-40' : ''}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
          isHolding
            ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
            : isMe
              ? 'bg-gradient-to-br from-accent-500 to-accent-600 text-dark-900'
              : 'bg-surface-100 text-gray-300'
        }`}>
          {(m.username.slice(0, 2)).toUpperCase()}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-200 ${
          m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
        }`} />
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`text-sms font-bold truncate min-w-[3.5rem] ${
            isMe ? 'text-accent-400' : 'text-gray-200'
          }`}>
            {m.teamName || m.username}
          </p>
          {isMe && isHolding ? (
            <span className="px-1.5 py-px rounded text-sm font-bold bg-primary-500/20 text-primary-400 uppercase flex-shrink-0">Offerta tua</span>
          ) : isMe ? (
            <span className="px-1.5 py-px rounded text-sm font-bold bg-accent-500/20 text-accent-400 uppercase flex-shrink-0">io</span>
          ) : isHolding ? (
            <span className="px-1.5 py-px rounded text-sm font-bold bg-primary-500/20 text-primary-400 uppercase flex-shrink-0">Offerta</span>
          ) : null}
        </div>
        <p className="text-sm text-gray-500 truncate">
          {roleSlot
            ? isRoleFull
              ? `Slot ${currentRole} ${roleSlot.filled}/${roleSlot.total} — non può rilanciare`
              : `Slot ${currentRole} ${roleSlot.filled}/${roleSlot.total}`
            : ''}
        </p>
      </div>

      {/* The two actionable numbers: max bid (big) + budget (small) */}
      <div
        className="text-right flex-shrink-0"
        title={`Offerta max possibile.\nBudget (${bilancio}M) - Slot vuoti rimanenti (${Math.max(0, emptySlots - 1)}) = ${maxBid}M`}
      >
        <p className="stat-number text-sml font-bold text-amber-400 leading-none">
          {isRoleFull ? '—' : `${maxBid}`}
          {!isRoleFull && <span className="text-sm text-gray-500 font-sans font-semibold"> max</span>}
        </p>
        <p className="text-sm font-mono text-gray-500 leading-tight">budget {bilancio}</p>
      </div>
    </div>
  )
}
