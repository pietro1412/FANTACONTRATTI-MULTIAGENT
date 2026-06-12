import { useState } from 'react'

export interface PanelTabDef {
  key: string
  label: string
  content: React.ReactNode
}

export interface PanelTabsProps {
  tabs: PanelTabDef[]
  /** Tab attivo iniziale (default: il primo) */
  initialKey?: string
  /** Contenuto a destra della riga tab (es. conteggio) */
  rightSlot?: React.ReactNode
  /** Se true il contenuto scorre internamente con .panel-scroll (cockpit) */
  scrollContent?: boolean
  className?: string
}

/**
 * Pannello a tab leggero (mockup cockpit): header tab in micro-label
 * JetBrains Mono, tab attivo con sottolineatura oro, contenuto con
 * scroll interno opzionale. Usato per Bilanci | Attività | Strategie.
 */
export function PanelTabs({
  tabs,
  initialKey,
  rightSlot,
  scrollContent = false,
  className = '',
}: PanelTabsProps) {
  const [activeKey, setActiveKey] = useState(initialKey ?? tabs[0]?.key)
  const active = tabs.find(t => t.key === activeKey) ?? tabs[0]
  if (!active) return null

  return (
    <div className={`bg-surface-200 border border-surface-50 rounded-xl overflow-hidden flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center border-b border-surface-50 flex-shrink-0" role="tablist">
        {tabs.map(tab => {
          const isActive = tab.key === active.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveKey(tab.key); }}
              className={`font-mono text-[10.5px] font-bold tracking-[0.09em] uppercase px-4 py-2.5 border-b-2 transition-colors ${
                isActive
                  ? 'text-accent-400 border-accent-400 bg-accent-500/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
        {rightSlot && (
          <span className="ml-auto pr-3.5 font-mono text-[10.5px] text-gray-500">{rightSlot}</span>
        )}
      </div>
      <div
        role="tabpanel"
        className={scrollContent ? 'panel-scroll flex-1 min-h-0' : 'min-h-0'}
      >
        {active.content}
      </div>
    </div>
  )
}
