import { useMemo, useState } from 'react'
import { PlayerPhoto } from '@/components/players/PlayerPhoto'
import type { Player, SvincolatiPreference, SvincolatiPrefsPlayer } from '../../types/svincolati.types'

interface ExportedStrategy {
  playerName: string
  playerId: string
  isWatchlist: boolean
  isAutoPass: boolean
  maxBid: number | null
  priority: number | null
  notes: string | null
}

interface ExportedStrategies {
  version: 1
  exportedAt: string
  strategies: ExportedStrategy[]
}

interface SvincolatiStrategySummaryProps {
  freeAgents: Player[]
  preferencesMap: Map<string, SvincolatiPreference>
  onOpenPrefsModal: (player: SvincolatiPrefsPlayer) => void
  canEditPreferences: boolean
  onBulkSetPreference: (playerIds: string[], data: { isWatchlist?: boolean; isAutoPass?: boolean; maxBid?: number | null }) => Promise<void>
  onImportPreferences: (strategies: Array<{ playerId: string; isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }>) => Promise<void>
  isSubmitting: boolean
}

/**
 * Watchlist/priorità/note per gli svincolati — stesso pattern di
 * RubataStrategySummary, semplificato: nessun concetto di proprietario o
 * "giocatore già passato" (un libero, una volta acquisito, sparisce
 * semplicemente dal pool al refetch successivo).
 */
export function SvincolatiStrategySummary({
  freeAgents,
  preferencesMap,
  onOpenPrefsModal,
  canEditPreferences,
  onBulkSetPreference,
  onImportPreferences,
  isSubmitting,
}: SvincolatiStrategySummaryProps) {
  const [filterType, setFilterType] = useState<'all' | 'watchlist' | 'autopass' | 'maxbid'>('all')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkMaxBid, setBulkMaxBid] = useState('')
  const [bulkPosition, setBulkPosition] = useState<'P' | 'D' | 'C' | 'A' | null>(null)
  const [ioMessage, setIoMessage] = useState<string | null>(null)

  const { configured, total, items } = useMemo(() => {
    const itemList = freeAgents
      .map(p => ({ player: p, pref: preferencesMap.get(p.id) }))
      .filter(item => {
        const p = item.pref
        if (!p) return false
        const hasAny = p.isWatchlist || p.isAutoPass || p.maxBid || p.priority || p.notes
        if (!hasAny) return false
        if (filterType === 'watchlist') return p.isWatchlist
        if (filterType === 'autopass') return p.isAutoPass
        if (filterType === 'maxbid') return !!p.maxBid
        return true
      })

    const configuredCount = freeAgents.filter(p => {
      const pref = preferencesMap.get(p.id)
      return pref && (pref.isWatchlist || pref.isAutoPass || pref.maxBid || pref.priority || pref.notes)
    }).length

    return { configured: configuredCount, total: freeAgents.length, items: itemList }
  }, [freeAgents, preferencesMap, filterType])

  const getPlayerIdsByPosition = (pos: 'P' | 'D' | 'C' | 'A') =>
    freeAgents.filter(p => p.position === pos).map(p => p.id)

  const handleExport = async () => {
    const strategies: ExportedStrategy[] = []
    for (const [playerId, pref] of preferencesMap) {
      const hasAny = pref.isWatchlist || pref.isAutoPass || pref.maxBid || pref.priority || pref.notes
      if (!hasAny) continue
      const player = freeAgents.find(p => p.id === playerId)
      strategies.push({
        playerName: player?.name ?? playerId,
        playerId,
        isWatchlist: pref.isWatchlist,
        isAutoPass: pref.isAutoPass,
        maxBid: pref.maxBid,
        priority: pref.priority,
        notes: pref.notes,
      })
    }
    const exported: ExportedStrategies = { version: 1, exportedAt: new Date().toISOString(), strategies }
    try {
      await navigator.clipboard.writeText(JSON.stringify(exported, null, 2))
      setIoMessage(`Esportate ${strategies.length} strategie negli appunti`)
    } catch {
      setIoMessage('Errore: impossibile copiare negli appunti')
    }
    setTimeout(() => { setIoMessage(null) }, 3000)
  }

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text) as ExportedStrategies
      if (!parsed.version || !Array.isArray(parsed.strategies)) {
        setIoMessage('Formato JSON non valido')
        setTimeout(() => { setIoMessage(null) }, 3000)
        return
      }
      const matched: Array<{ playerId: string; isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }> = []
      for (const s of parsed.strategies) {
        let targetId = s.playerId
        const directMatch = freeAgents.find(p => p.id === targetId)
        if (!directMatch) {
          const nameMatch = freeAgents.find(p => p.name === s.playerName)
          if (nameMatch) {
            targetId = nameMatch.id
          } else {
            continue
          }
        }
        matched.push({ playerId: targetId, isWatchlist: s.isWatchlist, isAutoPass: s.isAutoPass, maxBid: s.maxBid, priority: s.priority, notes: s.notes })
      }
      if (matched.length === 0) {
        setIoMessage('Nessun giocatore corrispondente trovato')
        setTimeout(() => { setIoMessage(null) }, 3000)
        return
      }
      await onImportPreferences(matched)
      setIoMessage(`Importate ${matched.length}/${parsed.strategies.length} strategie`)
    } catch {
      setIoMessage('Errore: contenuto appunti non valido')
    }
    setTimeout(() => { setIoMessage(null) }, 3000)
  }

  if (total === 0) {
    return <p className="text-gray-500 text-center text-sm py-6">Nessun giocatore libero disponibile</p>
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1">
        <div className="flex gap-1 overflow-x-auto flex-1">
          {([
            { key: 'all' as const, label: 'Tutti' },
            { key: 'watchlist' as const, label: 'Watchlist' },
            { key: 'autopass' as const, label: 'Skip' },
            { key: 'maxbid' as const, label: 'Max bid' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilterType(tab.key); }}
              className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-all ${
                filterType === tab.key ? 'bg-primary-500/20 text-primary-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 font-mono flex-shrink-0">
          {configured}/{total}
        </span>
        {canEditPreferences && (
          <button
            onClick={() => { setBulkMode(prev => !prev); }}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              bulkMode ? 'bg-accent-500/20 text-accent-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Bulk
          </button>
        )}
      </div>

      {bulkMode && canEditPreferences && (
        <div className="p-3 bg-surface-300/50 rounded-lg border border-surface-50/20 space-y-2">
          <p className="text-[11px] text-gray-400 font-medium">Azioni rapide per ruolo</p>
          <div className="flex gap-1.5">
            {(['P', 'D', 'C', 'A'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => { setBulkPosition(prev => prev === pos ? null : pos); }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  bulkPosition === pos ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40' : 'bg-surface-300 text-gray-400 border border-surface-50/20'
                }`}
              >
                {pos} ({getPlayerIdsByPosition(pos).length})
              </button>
            ))}
          </div>
          {bulkPosition && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-1.5">
                <button
                  onClick={() => { void onBulkSetPreference(getPlayerIdsByPosition(bulkPosition), { isWatchlist: true, isAutoPass: false }); }}
                  disabled={isSubmitting}
                  className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 disabled:opacity-30 transition-all"
                >
                  Watchlist tutti {bulkPosition}
                </button>
                <button
                  onClick={() => { void onBulkSetPreference(getPlayerIdsByPosition(bulkPosition), { isAutoPass: true, isWatchlist: false }); }}
                  disabled={isSubmitting}
                  className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 disabled:opacity-30 transition-all"
                >
                  Skip tutti {bulkPosition}
                </button>
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  value={bulkMaxBid}
                  onChange={(e) => { setBulkMaxBid(e.target.value); }}
                  placeholder="Max bid"
                  className="flex-1 px-2 py-1.5 rounded text-xs bg-surface-300 border border-surface-50/20 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => {
                    const val = parseInt(bulkMaxBid)
                    if (val > 0) {
                      void onBulkSetPreference(getPlayerIdsByPosition(bulkPosition), { maxBid: val })
                      setBulkMaxBid('')
                    }
                  }}
                  disabled={isSubmitting || !bulkMaxBid}
                  className="px-3 py-1.5 rounded text-[11px] font-medium bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 disabled:opacity-30 transition-all whitespace-nowrap"
                >
                  MaxBid {bulkPosition}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-2">
          {configured === 0 ? 'Nessuna strategia impostata' : 'Nessun risultato per questo filtro'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {items.map(({ player, pref }) => (
            <button
              key={player.id}
              type="button"
              onClick={() => { if (canEditPreferences) onOpenPrefsModal({ playerId: player.id, playerName: player.name, playerTeam: player.team, playerPosition: player.position as 'P' | 'D' | 'C' | 'A', playerAge: player.age, playerApiFootballId: player.apiFootballId, preference: pref || null }); }}
              disabled={!canEditPreferences}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 bg-surface-300/50 hover:bg-surface-300 ${canEditPreferences ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <PlayerPhoto apiFootballId={player.apiFootballId} name={player.name} position={player.position} size="xs" showRoleBadge />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-300 truncate block">{player.name}</span>
                <span className="text-[10px] text-gray-500 truncate block">{player.team}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {pref?.isWatchlist && <span className="text-[10px] font-mono font-bold text-primary-400" title="Watchlist">WL</span>}
                {pref?.isAutoPass && <span className="text-[10px] font-mono font-bold text-gray-500" title="Auto-skip">SKIP</span>}
                {pref?.priority && <span className="text-accent-400">{'★'.repeat(pref.priority)}</span>}
                {pref?.maxBid && <span className="text-primary-400 font-mono">{pref.maxBid}M</span>}
                {pref?.notes && <span className="text-[10px] text-gray-500" title={pref.notes}>Note</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { void handleExport() }}
          disabled={isSubmitting || configured === 0}
          className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300 disabled:opacity-30 transition-all"
          title="Esporta strategie negli appunti"
        >
          Esporta
        </button>
        <button
          onClick={() => { void handleImport() }}
          disabled={isSubmitting || !canEditPreferences}
          className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300 disabled:opacity-30 transition-all"
          title="Importa strategie dagli appunti"
        >
          Importa
        </button>
      </div>
      {ioMessage && <p className="text-[11px] text-center text-primary-400">{ioMessage}</p>}

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${total > 0 ? (configured / total) * 100 : 0}%` }} />
        </div>
        <span className="text-[10px] text-gray-500">{total > 0 ? Math.round((configured / total) * 100) : 0}%</span>
      </div>
    </div>
  )
}
