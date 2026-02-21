import { useState, useMemo } from 'react'
import type { BoardPlayer, RubataPreference } from '../../types/rubata.types'

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

interface RubataStrategySummaryProps {
  board: BoardPlayer[] | null
  preferencesMap: Map<string, RubataPreference>
  myMemberId: string | undefined
  currentIndex: number | null
  onOpenPrefsModal: (player: BoardPlayer & { preference: RubataPreference | null }) => void
  canEditPreferences: boolean
  onBulkSetPreference: (playerIds: string[], data: { isWatchlist?: boolean; isAutoPass?: boolean; maxBid?: number | null }) => Promise<void>
  onImportPreferences: (strategies: Array<{ playerId: string; isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }>) => Promise<void>
  isSubmitting: boolean
}

export function RubataStrategySummary({
  board,
  preferencesMap,
  myMemberId,
  currentIndex,
  onOpenPrefsModal,
  canEditPreferences,
  onBulkSetPreference,
  onImportPreferences,
  isSubmitting,
}: RubataStrategySummaryProps) {
  const [expanded, setExpanded] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'watchlist' | 'autopass' | 'maxbid'>('all')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkMaxBid, setBulkMaxBid] = useState('')
  const [bulkPosition, setBulkPosition] = useState<'P' | 'D' | 'C' | 'A' | null>(null)
  const [ioMessage, setIoMessage] = useState<string | null>(null)

  const { configured, total, items, eligiblePlayers } = useMemo(() => {
    if (!board) return { configured: 0, total: 0, items: [], eligiblePlayers: [] }
    const eligible = board.filter(p => p.memberId !== myMemberId)
    const itemList = eligible
      .map(p => ({
        player: p,
        pref: preferencesMap.get(p.playerId),
        isPassed: board.indexOf(p) < (currentIndex ?? 0),
      }))
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

    const configuredCount = eligible.filter(p => {
      const pref = preferencesMap.get(p.playerId)
      return pref && (pref.isWatchlist || pref.isAutoPass || pref.maxBid || pref.priority || pref.notes)
    }).length

    return { configured: configuredCount, total: eligible.length, items: itemList, eligiblePlayers: eligible }
  }, [board, preferencesMap, myMemberId, currentIndex, filterType])

  const getPlayerIdsByPosition = (pos: 'P' | 'D' | 'C' | 'A') =>
    eligiblePlayers
      .filter(p => p.playerPosition === pos && board!.indexOf(p) >= (currentIndex ?? 0))
      .map(p => p.playerId)

  const handleExport = async () => {
    const strategies: ExportedStrategy[] = []
    for (const [playerId, pref] of preferencesMap) {
      const hasAny = pref.isWatchlist || pref.isAutoPass || pref.maxBid || pref.priority || pref.notes
      if (!hasAny) continue
      const player = board?.find(p => p.playerId === playerId)
      strategies.push({
        playerName: player?.playerName ?? playerId,
        playerId,
        isWatchlist: pref.isWatchlist,
        isAutoPass: pref.isAutoPass,
        maxBid: pref.maxBid,
        priority: pref.priority,
        notes: pref.notes,
      })
    }
    const exported: ExportedStrategies = {
      version: 1,
      exportedAt: new Date().toISOString(),
      strategies,
    }
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
      // Match by playerId first, then by playerName
      const matched: Array<{ playerId: string; isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }> = []
      for (const s of parsed.strategies) {
        let targetId = s.playerId
        // Check if playerId exists in current board
        const directMatch = board?.find(p => p.playerId === targetId)
        if (!directMatch) {
          // Fall back to name match
          const nameMatch = board?.find(p => p.playerName === s.playerName)
          if (nameMatch) {
            targetId = nameMatch.playerId
          } else {
            continue // Skip unmatched
          }
        }
        matched.push({
          playerId: targetId,
          isWatchlist: s.isWatchlist,
          isAutoPass: s.isAutoPass,
          maxBid: s.maxBid,
          priority: s.priority,
          notes: s.notes,
        })
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

  if (!board || total === 0) return null

  return (
    <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => { setExpanded(prev => !prev); }}
        className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm font-bold text-white">Strategie</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
            {configured}/{total}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 md:px-4 md:pb-4">
          {/* Filter tabs + bulk toggle */}
          <div className="flex items-center gap-1 mb-3">
            <div className="flex gap-1 overflow-x-auto flex-1">
              {([
                { key: 'all' as const, label: 'Tutti' },
                { key: 'watchlist' as const, label: '👁️' },
                { key: 'autopass' as const, label: '⏭️' },
                { key: 'maxbid' as const, label: '💰' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setFilterType(tab.key); }}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-all ${
                    filterType === tab.key
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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

          {/* Bulk operations panel */}
          {bulkMode && canEditPreferences && (
            <div className="mb-3 p-3 bg-surface-300/50 rounded-lg border border-surface-50/20 space-y-2">
              <p className="text-[11px] text-gray-400 font-medium">Azioni rapide per ruolo</p>

              {/* Position selector */}
              <div className="flex gap-1.5">
                {(['P', 'D', 'C', 'A'] as const).map(pos => (
                  <button
                    key={pos}
                    onClick={() => { setBulkPosition(prev => prev === pos ? null : pos); }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      bulkPosition === pos
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                        : 'bg-surface-300 text-gray-400 border border-surface-50/20'
                    }`}
                  >
                    {pos} ({getPlayerIdsByPosition(pos).length})
                  </button>
                ))}
              </div>

              {bulkPosition && (
                <div className="space-y-2 pt-1">
                  {/* Watchlist all */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { void onBulkSetPreference(getPlayerIdsByPosition(bulkPosition), { isWatchlist: true, isAutoPass: false }); }}
                      disabled={isSubmitting}
                      className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-30 transition-all"
                    >
                      👁️ Watchlist tutti {bulkPosition}
                    </button>
                    <button
                      onClick={() => { void onBulkSetPreference(getPlayerIdsByPosition(bulkPosition), { isAutoPass: true, isWatchlist: false }); }}
                      disabled={isSubmitting}
                      className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 disabled:opacity-30 transition-all"
                    >
                      ⏭️ Skip tutti {bulkPosition}
                    </button>
                  </div>

                  {/* MaxBid for position */}
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
                      className="px-3 py-1.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 transition-all whitespace-nowrap"
                    >
                      MaxBid {bulkPosition}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Strategy list */}
          {items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">
              {configured === 0 ? 'Nessuna strategia impostata' : 'Nessun risultato per questo filtro'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 md:max-h-60 overflow-y-auto">
              {items.map(({ player, pref, isPassed }) => (
                <button
                  key={player.playerId}
                  type="button"
                  onClick={() => { if (canEditPreferences) onOpenPrefsModal({ ...player, preference: pref || null }); }}
                  disabled={!canEditPreferences}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                    isPassed ? 'opacity-40 bg-surface-50/5' : 'bg-surface-300/50 hover:bg-surface-300'
                  } ${canEditPreferences ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="font-medium text-gray-300 truncate flex-1 min-w-0">
                    {player.playerName}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {pref?.isWatchlist && <span title="Watchlist">👁️</span>}
                    {pref?.isAutoPass && <span title="Auto-skip">⏭️</span>}
                    {pref?.priority && (
                      <span className="text-purple-400">{'★'.repeat(pref.priority)}</span>
                    )}
                    {pref?.maxBid && (
                      <span className="text-blue-400 font-mono">{pref.maxBid}M</span>
                    )}
                    {pref?.notes && <span title={pref.notes}>📝</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* D6: Import/Export buttons */}
          <div className="mt-3 flex items-center gap-1.5">
            <button
              onClick={() => { void handleExport() }}
              disabled={isSubmitting || configured === 0}
              className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300 disabled:opacity-30 transition-all"
              title="Esporta strategie negli appunti"
            >
              📤 Esporta
            </button>
            <button
              onClick={() => { void handleImport() }}
              disabled={isSubmitting || !canEditPreferences}
              className="flex-1 px-2 py-1.5 rounded text-[11px] font-medium bg-surface-300/50 text-gray-400 hover:text-white hover:bg-surface-300 disabled:opacity-30 transition-all"
              title="Importa strategie dagli appunti"
            >
              📥 Importa
            </button>
          </div>
          {ioMessage && (
            <p className="mt-1.5 text-[11px] text-center text-indigo-400 animate-[fadeIn_0.2s_ease-out]">{ioMessage}</p>
          )}

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${total > 0 ? (configured / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{total > 0 ? Math.round((configured / total) * 100) : 0}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
