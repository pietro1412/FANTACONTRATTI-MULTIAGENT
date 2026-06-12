import { memo } from 'react'
import { Monogram } from './Monogram'

export interface ManagerListRowProps {
  name: string
  /** Riga del manager corrente: bordo sinistro oro + tag TU */
  isMe?: boolean
  /** Detiene la miglior offerta: bordo sinistro blu */
  isHolding?: boolean
  /** Fuori gioco (slot pieni, budget insufficiente, proprietario): sbiadito */
  dim?: boolean
  /** Pallino oro con glow prima del nome (miglior offerta) */
  leadDot?: boolean
  /** Sottoriga di stato (testo o nodi) */
  statusLine?: React.ReactNode
  /** Numero grande a destra (Oswald) */
  bigValue: React.ReactNode
  /** Unità piccola accanto al numero grande (es. "max") */
  bigUnit?: string
  /** Numero grande in oro (es. offerta del leader, riga TU) */
  bigValueGold?: boolean
  /** Dettaglio piccolo sotto il numero (es. "budget 154") */
  smallValue?: React.ReactNode
  /** Pallino di connessione sull'avatar (true verde, false rosso, undefined nascosto) */
  connectedDot?: boolean | null
  onClick?: () => void
  title?: string
}

/**
 * P5 — Riga manager unificata (mockup cockpit): monogramma, titolo Outfit,
 * sottoriga di stato, numero grande Oswald + dettaglio piccolo a destra.
 * Adottata dalla lista Manager dell'asta e dal pannello Bilanci della rubata.
 */
export const ManagerListRow = memo(function ManagerListRow({
  name,
  isMe = false,
  isHolding = false,
  dim = false,
  leadDot = false,
  statusLine,
  bigValue,
  bigUnit,
  bigValueGold = false,
  smallValue,
  connectedDot,
  onClick,
  title,
}: ManagerListRowProps) {
  const rowClass = `flex items-center gap-3 px-3.5 py-2 border-b border-surface-50/40 last:border-b-0 ${
    isMe
      ? 'border-l-[3px] border-l-accent-500 bg-accent-500/[0.06]'
      : isHolding
        ? 'border-l-[3px] border-l-primary-500 bg-primary-500/[0.06]'
        : ''
  } ${dim ? 'opacity-40' : ''} ${onClick ? 'cursor-pointer hover:bg-surface-100/40 transition-colors' : ''}`

  return (
    <div onClick={onClick} title={title} className={rowClass}>
      {/* Avatar */}
      <span className="relative flex-shrink-0">
        <Monogram
          name={name}
          size="md"
          className={isMe ? 'border-accent-500/60 text-accent-400' : ''}
        />
        {connectedDot != null && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-200 ${
              connectedDot ? 'bg-secondary-500' : 'bg-danger-500'
            }`}
            aria-hidden="true"
          />
        )}
      </span>

      {/* Nome + sottoriga */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {leadDot && (
            <span className="dot-live w-[7px] h-[7px] flex-shrink-0" aria-hidden="true" />
          )}
          <span className="font-display font-bold text-sm text-white truncate">{name}</span>
          {isMe && (
            <span className="text-[9.5px] font-mono font-bold text-accent-400 border border-accent-500/50 rounded px-1.5 py-px tracking-[0.06em] flex-shrink-0">
              TU
            </span>
          )}
        </div>
        {statusLine && (
          <div className="text-[11.5px] text-gray-500 truncate mt-0.5">{statusLine}</div>
        )}
      </div>

      {/* Numeri a destra */}
      <div className="text-right flex-shrink-0">
        <div className={`stat-number text-[21px] leading-none ${bigValueGold || isMe ? 'text-accent-400' : 'text-white'}`}>
          {bigValue}
          {bigUnit && (
            <span className="font-mono text-[10px] font-semibold text-gray-500 ml-0.5">{bigUnit}</span>
          )}
        </div>
        {smallValue && (
          <div className="font-mono text-[10px] text-gray-500 mt-0.5">{smallValue}</div>
        )}
      </div>
    </div>
  )
})
