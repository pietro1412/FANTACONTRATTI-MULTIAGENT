/**
 * AuctionLayoutSelector.tsx - Selettore Layout Asta
 *
 * Permette di scegliere tra 4 layout diversi per la sala asta:
 * - A: Split Screen Focus
 * - B: Card Stack Mobile-First
 * - C: Dashboard Real-Time
 * - D: Best Mix (combinazione migliori caratteristiche)
 *
 * Creato il: 24/01/2026
 */

import { useState, useEffect } from 'react'

export type AuctionLayout = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'classic'

interface LayoutOption {
  id: AuctionLayout
  name: string
  description: string
  icon: string
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'classic',
    name: 'Classico',
    description: 'Layout originale a 3 colonne',
    icon: '📋'
  },
  {
    id: 'A',
    name: 'Split Focus',
    description: 'Timer gigante, sidebar info',
    icon: '🎯'
  },
  {
    id: 'B',
    name: 'Card Stack',
    description: 'Mobile-first, una card',
    icon: '📱'
  },
  {
    id: 'C',
    name: 'Dashboard',
    description: 'Stile trading, max info',
    icon: '📊'
  },
  {
    id: 'D',
    name: 'Best Mix',
    description: 'Migliori caratteristiche',
    icon: '⭐'
  },
  {
    id: 'E',
    name: 'Compatto',
    description: 'Stile pro, info dense',
    icon: '🎮'
  },
  {
    id: 'F',
    name: 'Pro',
    description: 'Completo con tutti i flussi',
    icon: '🏆'
  }
]

interface AuctionLayoutSelectorProps {
  currentLayout: AuctionLayout
  onLayoutChange: (layout: AuctionLayout) => void
  compact?: boolean
}

export function AuctionLayoutSelector({
  currentLayout,
  onLayoutChange,
  compact = false
}: AuctionLayoutSelectorProps) {

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Layout:</span>
        {LAYOUT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onLayoutChange(opt.id)}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-all ${
              currentLayout === opt.id
                ? 'bg-primary-500 text-white shadow-lg'
                : 'bg-surface-300 text-gray-400 hover:bg-surface-200'
            }`}
            title={`${opt.name}: ${opt.description}`}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span>🎨</span>
        Seleziona Layout
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {LAYOUT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onLayoutChange(opt.id)}
            className={`p-3 rounded-lg text-left transition-all ${
              currentLayout === opt.id
                ? 'bg-primary-500/20 border-2 border-primary-500'
                : 'bg-surface-300 border-2 border-transparent hover:border-surface-50/30'
            }`}
          >
            <div className="text-2xl mb-1">{opt.icon}</div>
            <div className={`text-sm font-bold ${currentLayout === opt.id ? 'text-primary-400' : 'text-white'}`}>
              {opt.name}
            </div>
            <div className="text-xs text-gray-500">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Hook per persistere la scelta del layout
export function useAuctionLayout(): [AuctionLayout, (layout: AuctionLayout) => void] {
  const [layout, setLayout] = useState<AuctionLayout>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('auction-layout') as AuctionLayout
      return saved || 'D'
    }
    return 'D'
  })

  useEffect(() => {
    localStorage.setItem('auction-layout', layout)
  }, [layout])

  return [layout, setLayout]
}

export default AuctionLayoutSelector
