import { useState } from 'react'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import type { Appeal } from '../admin/types'

interface AdminActionsPanelProps {
  /** Whether a manual close is possible (an auction is currently active) */
  canCloseAuction: boolean
  onCloseAuction?: () => void
  /** Whether the last completed auction can be reopened (= annulla ultimo movimento) */
  canReopenAuction: boolean
  onReopenAuction?: () => void
  /** Pending appeals of the league */
  pendingAppeals: Appeal[]
  resolvingAppealId: string | null
  onResolveAppeal: (appealId: string, decision: 'ACCEPTED' | 'REJECTED', resolutionNote?: string) => void
  /** Currently selected auction timer (seconds) */
  timerSetting: number
  /** Update the auction timer; applies immediately to an in-progress auction */
  onUpdateTimer?: (seconds: number) => void
}

const TIMER_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60]

export function AdminActionsPanel({
  canCloseAuction,
  onCloseAuction,
  canReopenAuction,
  onReopenAuction,
  pendingAppeals,
  resolvingAppealId,
  onResolveAppeal,
  timerSetting,
  onUpdateTimer,
}: AdminActionsPanelProps) {
  const [open, setOpen] = useState(false)
  // Optional resolution note per appeal
  const [notes, setNotes] = useState<Record<string, string>>({})

  const appealsCount = pendingAppeals.length

  const setNote = (appealId: string, value: string) => {
    setNotes(prev => ({ ...prev, [appealId]: value }))
  }

  return (
    <div className="bg-surface-200 rounded-xl border border-accent-500/30 overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); }}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-300/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-accent-400">
          <span>⚙️</span>
          Azioni Admin
        </span>
        <span className="flex items-center gap-2">
          {appealsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-danger-500 text-white text-xs font-bold">
              {appealsCount} {appealsCount === 1 ? 'ricorso' : 'ricorsi'}
            </span>
          )}
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-4">
          {/* Timer setting — applies to the in-progress auction (test-session #27) */}
          {onUpdateTimer && (
            <div className="space-y-2">
              <p className="text-xs uppercase font-semibold text-gray-500">Timer asta</p>
              <div className="flex flex-wrap gap-1">
                {TIMER_PRESETS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => { onUpdateTimer(sec); }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      timerSetting === sec
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-300 text-gray-400 hover:bg-surface-50/20 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auction actions */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-semibold text-gray-500">Asta corrente</p>
            <Button
              variant="secondary"
              fullWidth
              size="sm"
              disabled={!canCloseAuction}
              onClick={onCloseAuction}
            >
              Concludi asta manualmente
            </Button>
            <Button
              variant="outline"
              fullWidth
              size="sm"
              disabled={!canReopenAuction}
              onClick={onReopenAuction}
              className="border-danger-500/60 text-danger-400 hover:bg-danger-500/10"
            >
              Annulla ultimo movimento
            </Button>
            <p className="text-[11px] text-gray-500">
              {canReopenAuction
                ? 'Riapre l’ultima asta conclusa. Disponibile finché non parte la prossima asta.'
                : 'Disponibile finché non parte la prossima asta.'}
            </p>
          </div>

          {/* Appeals management */}
          <div className="space-y-2">
            <p className="text-xs uppercase font-semibold text-gray-500">
              Ricorsi in attesa
            </p>
            {appealsCount === 0 ? (
              <p className="text-sm text-gray-500">Nessun ricorso da gestire.</p>
            ) : (
              <div className="space-y-3">
                {pendingAppeals.map(appeal => {
                  const isResolving = resolvingAppealId === appeal.id
                  return (
                    <div
                      key={appeal.id}
                      className="bg-surface-300 rounded-lg p-3 border border-danger-500/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-white text-sm">
                          {appeal.auction.player.name}
                          <span className="text-gray-400 font-normal"> ({appeal.auction.player.team})</span>
                        </p>
                        {appeal.auction.winner && (
                          <span className="text-xs text-accent-400 font-mono">
                            {appeal.auction.currentPrice}M → {appeal.auction.winner.user.username}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-1">
                        Presentato da <span className="text-white">{appeal.member.user.username}</span>
                      </p>
                      <p className="text-sm text-gray-300 bg-surface-400/40 rounded p-2 mb-2">
                        {appeal.content}
                      </p>
                      <Textarea
                        value={notes[appeal.id] ?? ''}
                        onChange={e => { setNote(appeal.id, e.target.value); }}
                        rows={2}
                        placeholder="Nota (opzionale)..."
                        maxLength={500}
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth
                          disabled={isResolving}
                          onClick={() => { onResolveAppeal(appeal.id, 'ACCEPTED', notes[appeal.id]?.trim() || undefined); }}
                          className="bg-secondary-500 hover:bg-secondary-600 text-white"
                        >
                          {isResolving ? 'Attendi...' : 'Accetta'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          fullWidth
                          disabled={isResolving}
                          onClick={() => { onResolveAppeal(appeal.id, 'REJECTED', notes[appeal.id]?.trim() || undefined); }}
                        >
                          {isResolving ? 'Attendi...' : 'Rifiuta'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
