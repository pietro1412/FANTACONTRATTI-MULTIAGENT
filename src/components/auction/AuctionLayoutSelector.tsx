/**
 * AuctionLayoutSelector.tsx - Selettore Layout Asta
 *
 * 3 layout consolidati:
 * - Mobile: Card Stack con tab (ottimizzato touchscreen)
 * - Desktop: Best Mix responsive (default)
 * - Pro: Completo con obiettivi, ready check, acknowledgment
 *
 * Sprint 4: Consolidato da 6 layout (A-F) a 3
 */

import { useState, useEffect } from 'react'

export type AuctionLayout = 'mobile' | 'desktop' | 'pro' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'classic'

interface LayoutOption {
  id: AuctionLayout
  name: string
  description: string
  icon: string
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'mobile',
    name: 'Mobile',
    description: 'Card stack, tab, touch-friendly',
    icon: '📱'
  },
  {
    id: 'desktop',
    name: 'Desktop',
    description: 'Best mix, timer + grid info',
    icon: '🖥️'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Obiettivi, flussi completi',
    icon: '🏆'
  }
]

// Map old layout IDs to new consolidated ones
function migrateLayout(layout: string): AuctionLayout {
  switch (layout) {
    case 'B': return 'mobile'
    case 'A':
    case 'C':
    case 'D':
    case 'classic': return 'desktop'
    case 'E':
    case 'F': return 'pro'
    default:
      if (['mobile', 'desktop', 'pro'].includes(layout)) return layout as AuctionLayout
      return 'desktop'
  }
}

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
            className={`w-8 h-8 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-sm transition-all ${
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
      <div className="grid grid-cols-3 gap-2">
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
      const saved = localStorage.getItem('auction-layout')
      return saved ? migrateLayout(saved) : 'desktop'
    }
    return 'desktop'
  })

  useEffect(() => {
    localStorage.setItem('auction-layout', layout)
  }, [layout])

  return [layout, setLayout]
}

export default AuctionLayoutSelector
