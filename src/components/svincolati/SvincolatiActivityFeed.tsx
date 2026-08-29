import { useMemo, useState } from 'react'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'
import type { SvincolatiActivityItem } from '../../types/svincolati.types'

type ViewMode = 'feed' | 'summary'

interface ManagerSummary {
  username: string
  count: number
  totalSpent: number
}

interface SvincolatiActivityFeedProps {
  items: SvincolatiActivityItem[]
}

/**
 * Feed acquisizioni della sessione Svincolati corrente — a differenza di
 * RubataActivityFeed (derivato dal board gia' in memoria) qui serve una vera
 * fetch (svincolatiApi.getHistory, ora scoping-corretta lato backend): il
 * pool "liberi" contiene solo i giocatori ancora disponibili, chi viene
 * acquisito sparisce dal pool e non lascia traccia locale.
 */
export function SvincolatiActivityFeed({ items }: SvincolatiActivityFeedProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('feed')

  const assigned = useMemo(() => items.filter(i => i.winner), [items])

  const managerSummary = useMemo<ManagerSummary[]>(() => {
    const map = new Map<string, ManagerSummary>()
    for (const item of assigned) {
      if (!item.winner) continue
      const username = item.winner
      const existing = map.get(username)
      if (existing) {
        existing.count++
        existing.totalSpent += item.finalPrice
      } else {
        map.set(username, { username, count: 1, totalSpent: item.finalPrice })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [assigned])

  if (items.length === 0) {
    return <p className="text-gray-500 text-center text-sm py-6">Nessuna acquisizione ancora in questa sessione</p>
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setViewMode('feed'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
            viewMode === 'feed'
              ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
              : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
          }`}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => { setViewMode('summary'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
            viewMode === 'summary'
              ? 'bg-secondary-500/20 text-secondary-400 border-secondary-500/40'
              : 'bg-surface-200 text-gray-400 border-surface-50/20 hover:border-surface-50/40'
          }`}
        >
          Riepilogo
        </button>
      </div>

      {viewMode === 'feed' ? (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-surface-300/40 rounded-lg text-sm">
              <PlayerPhoto apiFootballId={item.player.apiFootballId} name={item.player.name} position={item.player.position} size="xs" showRoleBadge />
              {item.winner ? (
                <>
                  <span className="text-secondary-400 font-bold flex-shrink-0">{item.winner}</span>
                  <span className="text-gray-500 flex-shrink-0">ha preso</span>
                </>
              ) : (
                <span className="text-gray-500 flex-shrink-0">Nessuna offerta per</span>
              )}
              <span className="text-white font-medium truncate">{item.player.name}</span>
              {item.winner && (
                <span className="ml-auto text-xs font-mono text-warning-400 flex-shrink-0">{item.finalPrice}M</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {managerSummary.length === 0 ? (
            <p className="text-gray-500 text-center text-sm py-2">Nessuna acquisizione ancora</p>
          ) : (
            managerSummary.map(ms => (
              <div key={ms.username} className="flex items-center justify-between px-3 py-2 bg-surface-300/40 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{ms.username}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-secondary-500/20 text-secondary-400 rounded">
                    {ms.count} {ms.count === 1 ? 'preso' : 'presi'}
                  </span>
                </div>
                <span className="text-xs font-mono text-warning-400">{ms.totalSpent}M spesi</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
