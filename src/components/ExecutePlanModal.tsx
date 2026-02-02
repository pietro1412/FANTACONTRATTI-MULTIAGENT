/**
 * ExecutePlanModal - Confirmation and execution modal for clause payment plan
 *
 * Features:
 * - Shows list of planned players with their clauses
 * - Displays total budget impact
 * - Sequential execution with real-time feedback
 * - Success/error status for each player
 */

import { useState, useCallback } from 'react'

interface PlannedPlayer {
  id: string
  name: string
  position: string
  team: string
  maxBid: number
  type: 'owned' | 'svincolato'
  ownerTeam: string
}

interface ExecutionResult {
  playerId: string
  success: boolean
  error?: string
}

interface ExecutePlanModalProps {
  isOpen: boolean
  onClose: () => void
  players: PlannedPlayer[]
  totalBudget: number
  availableBudget: number
  onPayClause: (playerId: string, type: 'owned' | 'svincolato') => Promise<{ success: boolean; message?: string }>
  onComplete: () => void
}

// Position colors
const POS_COLORS: Record<string, string> = {
  P: 'bg-yellow-500',
  D: 'bg-green-500',
  C: 'bg-blue-500',
  A: 'bg-red-500',
}

export function ExecutePlanModal({
  isOpen,
  onClose,
  players,
  totalBudget,
  availableBudget,
  onPayClause,
  onComplete,
}: ExecutePlanModalProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [results, setResults] = useState<ExecutionResult[]>([])
  const [isComplete, setIsComplete] = useState(false)

  const canExecute = totalBudget <= availableBudget

  const handleExecute = useCallback(async () => {
    setIsExecuting(true)
    setResults([])
    setIsComplete(false)

    // Execute each clause sequentially
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      setCurrentIndex(i)

      try {
        const result = await onPayClause(player.id, player.type)
        setResults(prev => [...prev, {
          playerId: player.id,
          success: result.success,
          error: result.success ? undefined : result.message,
        }])
      } catch (error) {
        setResults(prev => [...prev, {
          playerId: player.id,
          success: false,
          error: error instanceof Error ? error.message : 'Errore sconosciuto',
        }])
      }

      // Small delay between executions for better UX
      await new Promise(r => setTimeout(r, 500))
    }

    setCurrentIndex(-1)
    setIsExecuting(false)
    setIsComplete(true)
  }, [players, onPayClause])

  const handleClose = useCallback(() => {
    if (isComplete) {
      onComplete()
    }
    setIsExecuting(false)
    setCurrentIndex(-1)
    setResults([])
    setIsComplete(false)
    onClose()
  }, [isComplete, onComplete, onClose])

  const getPlayerStatus = (playerId: string) => {
    const result = results.find(r => r.playerId === playerId)
    if (!result) {
      const playerIndex = players.findIndex(p => p.id === playerId)
      if (playerIndex === currentIndex) return 'executing'
      if (playerIndex < currentIndex) return 'pending'
      return 'waiting'
    }
    return result.success ? 'success' : 'error'
  }

  const getPlayerError = (playerId: string) => {
    const result = results.find(r => r.playerId === playerId)
    return result?.error
  }

  const successCount = results.filter(r => r.success).length
  const errorCount = results.filter(r => !r.success).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isExecuting ? undefined : handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-200 rounded-2xl border border-surface-50/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-surface-50/20 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{isComplete ? (errorCount > 0 ? '\u26A0\uFE0F' : '\u2705') : '\uD83C\uDFAF'}</span>
            {isComplete ? 'Esecuzione Completata' : 'Esegui Piano Clausole'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isComplete
              ? `${successCount} clausole pagate, ${errorCount} errori`
              : `Stai per pagare ${players.length} clausole per un totale di ${totalBudget}M`
            }
          </p>
        </div>

        {/* Budget Check */}
        {!isComplete && (
          <div className={`p-3 border-b border-surface-50/20 ${canExecute ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Budget disponibile</span>
              <span className="text-sm font-bold text-green-400">{availableBudget}M</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-gray-400">Totale clausole</span>
              <span className={`text-sm font-bold ${canExecute ? 'text-orange-400' : 'text-red-400'}`}>
                -{totalBudget}M
              </span>
            </div>
            {!canExecute && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <span>\u26A0\uFE0F</span>
                Budget insufficiente! Mancano {totalBudget - availableBudget}M
              </div>
            )}
          </div>
        )}

        {/* Players List */}
        <div className="max-h-64 overflow-y-auto">
          {players.map((player, index) => {
            const status = getPlayerStatus(player.id)
            const error = getPlayerError(player.id)

            return (
              <div
                key={player.id}
                className={`p-3 border-b border-surface-50/10 flex items-center gap-3 transition-colors ${
                  status === 'executing' ? 'bg-blue-500/10' :
                  status === 'success' ? 'bg-green-500/10' :
                  status === 'error' ? 'bg-red-500/10' : ''
                }`}
              >
                {/* Status indicator */}
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {status === 'waiting' && (
                    <span className="text-gray-500 text-sm">{index + 1}</span>
                  )}
                  {status === 'executing' && (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {status === 'success' && (
                    <span className="text-green-400 text-lg">\u2713</span>
                  )}
                  {status === 'error' && (
                    <span className="text-red-400 text-lg">\u2717</span>
                  )}
                </div>

                {/* Position badge */}
                <span className={`w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 ${POS_COLORS[player.position] || 'bg-gray-500'}`}>
                  {player.position}
                </span>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{player.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {player.team} {player.type === 'svincolato' ? '\uD83C\uDD93' : `\u2190 ${player.ownerTeam}`}
                  </div>
                  {error && (
                    <div className="text-xs text-red-400 mt-1 truncate">{error}</div>
                  )}
                </div>

                {/* Price */}
                <div className="text-sm font-bold text-orange-400 flex-shrink-0">
                  {player.maxBid}M
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-50/20 bg-surface-300/30 flex items-center gap-3">
          {isComplete ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors"
              >
                Chiudi
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={isExecuting}
                className="flex-1 py-3 rounded-xl bg-surface-300 hover:bg-surface-100 text-gray-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annulla
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting || !canExecute}
                className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Esecuzione...
                  </>
                ) : (
                  <>
                    <span>\uD83D\uDCB0</span>
                    Paga {players.length} Clausole
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExecutePlanModal
