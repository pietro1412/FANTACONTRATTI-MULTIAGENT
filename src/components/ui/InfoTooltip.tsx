import { useState, type ReactNode } from 'react'

interface InfoTooltipProps {
  /** Contenuto esplicativo (testo o nodo). */
  content: ReactNode
  /** Etichetta accessibile del pulsante (es. nome del concetto). */
  label?: string
  /** Allineamento del popover rispetto all'icona. */
  align?: 'center' | 'left' | 'right'
  className?: string
}

const ALIGN_CLASS: Record<NonNullable<InfoTooltipProps['align']>, string> = {
  center: 'left-1/2 -translate-x-1/2',
  left: 'left-0',
  right: 'right-0',
}

/**
 * Tooltip "i" riusabile per spiegare concetti/numeri ambigui nel punto d'uso
 * (P3 / F-HIER-2). Pattern estratto da finance/KPICard per riuso su tutta la
 * piattaforma (Assioma 4). Apertura su hover (desktop) e tap (mobile).
 */
export function InfoTooltip({ content, label = 'Maggiori informazioni', align = 'center', className = '' }: InfoTooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className="text-gray-500 hover:text-gray-300 transition-colors"
        onMouseEnter={() => { setShow(true); }}
        onMouseLeave={() => { setShow(false); }}
        onClick={() => { setShow((prev) => !prev); }}
        aria-label={`Info: ${label}`}
      >
        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {show && (
        <span
          role="tooltip"
          className={`absolute z-50 bottom-full ${ALIGN_CLASS[align]} mb-2 w-52 md:w-64 p-2.5 bg-surface-100 border border-surface-50/30 rounded-lg shadow-xl text-[10px] md:text-xs text-gray-300 leading-relaxed block`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
