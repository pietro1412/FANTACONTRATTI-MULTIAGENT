import { useState, useMemo } from 'react'
import { POSITION_COLORS } from '../../types/rubata.types'
import type { BoardPlayer } from '../../types/rubata.types'

type ViewMode = 'feed' | 'summary'

interface RubataActivityFeedProps {
  board: BoardPlayer[] | null
}

interface ManagerSummary {
  username: string
  count: number
  totalSpent: number
}

export function RubataActivityFeed({ board }: RubataActivityFeedProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('feed')

  const stolenPlayers = useMemo(() => {
    if (!board) return []
    return board
      .filter(p => p.stolenByUsername)
      .reverse() // most recent first
  }, [board])

  const managerSummary = useMemo<ManagerSummary[]>(() => {
    const map = new Map<string, ManagerSummary>()
    for (const p of stolenPlayers) {
      const username = p.stolenByUsername ?? ''
      const existing = map.get(username)
      if (existing) {
        existing.count++
        existing.totalSpent += p.stolenPrice ?? p.rubataPrice
      } else {
        map.set(username, {
          username,
          count: 1,
          totalSpent: p.stolenPrice ?? p.rubataPrice,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [stolenPlayers])

  if (stolenPlayers.length === 0) return null

  return (
    <div className="border border-surface-50/20 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => { setCollapsed(!collapsed); }}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-300/50 hover:bg-surface-300/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-base font-bold text-white">Rubate</span>
          <span className="px-2 py-0.5 text-xs font-bold bg-danger-500/20 text-danger-400 rounded-full">
            {stolenPlayers.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {/* Toggle: Feed / Riepilogo */}
          <div className="flex gap-2">
            <button
              onClick={() => { setViewMode('feed'); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                viewMode === 'feed'
                  ? 'bg-danger-500/20 text-danger-400 border-danger-500/40'
                  : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
              }`}
            >
              Feed
            </button>
            <button
              onClick={() => { setViewMode('summary'); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                viewMode === 'summary'
                  ? 'bg-danger-500/20 text-danger-400 border-danger-500/40'
                  : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
              }`}
            >
              Riepilogo
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[300px] overflow-y-auto space-y-1.5">
            {viewMode === 'feed' ? (
              stolenPlayers.map(p => (
                <div key={p.rosterId} className="flex items-center gap-2 px-3 py-2 bg-surface-300/40 rounded-lg text-sm">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold flex-shrink-0 ${POSITION_COLORS[p.playerPosition] ?? ''}`}>
                    {p.playerPosition}
                  </span>
                  <span className="text-danger-400 font-bold flex-shrink-0">{p.stolenByUsername}</span>
                  <span className="text-gray-500 flex-shrink-0">ha rubato</span>
                  <span className="text-white font-medium truncate">{p.playerName}</span>
                  {p.stolenPrice != null && (
                    <span className="ml-auto text-xs font-mono text-warning-400 flex-shrink-0">
                      {p.stolenPrice}M
                    </span>
                  )}
                </div>
              ))
            ) : (
              managerSummary.map(ms => (
                <div key={ms.username} className="flex items-center justify-between px-3 py-2 bg-surface-300/40 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{ms.username}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-danger-500/20 text-danger-400 rounded">
                      {ms.count} {ms.count === 1 ? 'rubata' : 'rubate'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-warning-400">{ms.totalSpent}M spesi</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
