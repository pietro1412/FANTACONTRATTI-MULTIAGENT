import { useState } from 'react'
import { Button } from '../ui/Button'
import type { ReadyStatus } from '../../types/rubata.types'

interface RubataReadyBannerProps {
  variant: 'ready' | 'paused'
  readyStatus: ReadyStatus
  isAdmin: boolean
  isSubmitting: boolean
  pausedInfo?: { remainingSeconds: number | null; fromState: string | null }
  onSetReady: () => void
  onForceAllReady: () => void
}

export function RubataReadyBanner({
  variant,
  readyStatus,
  isAdmin,
  isSubmitting,
  pausedInfo,
  onSetReady,
  onForceAllReady,
}: RubataReadyBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const hasPending = readyStatus.pendingMembers.length > 0
  const progressPct = readyStatus.totalMembers > 0
    ? (readyStatus.readyCount / readyStatus.totalMembers) * 100
    : 0

  const isPaused = variant === 'paused'
  const borderColor = isPaused ? 'border-gray-500/50' : 'border-blue-500/50'
  const icon = isPaused ? '⏸️' : '🔔'
  const title = isPaused ? 'IN PAUSA' : 'Pronti?'
  const titleColor = isPaused ? 'text-gray-300' : 'text-blue-400'

  return (
    <div className={`mb-3 bg-surface-200 rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className="text-base">{icon}</span>
        <span className={`font-bold text-sm ${titleColor}`}>{title}</span>
        <span className="text-gray-400 text-xs">{readyStatus.readyCount}/{readyStatus.totalMembers}</span>

        {/* Progress bar */}
        <div className="w-20 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Paused timer info */}
        {isPaused && pausedInfo?.remainingSeconds != null && (
          <span className="text-yellow-400 text-xs">
            ({pausedInfo.remainingSeconds}s — {pausedInfo.fromState === 'AUCTION' ? 'Asta' : 'Offerta'})
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!readyStatus.userIsReady ? (
            <Button onClick={onSetReady} disabled={isSubmitting} size="sm" className="text-xs py-1 px-3">
              ✅ Sono Pronto
            </Button>
          ) : (
            <span className="px-2 py-0.5 bg-secondary-500/20 border border-secondary-500/40 rounded text-secondary-400 text-xs">
              ✓ Pronto
            </span>
          )}
          {isAdmin && (
            <Button
              onClick={onForceAllReady}
              disabled={isSubmitting}
              variant="outline"
              size="sm"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 text-xs py-1 px-2"
            >
              🤖 Forza Tutti
            </Button>
          )}
        </div>

        {/* Expand toggle for pending list */}
        {hasPending && (
          <button
            type="button"
            onClick={() => { setExpanded(prev => !prev); }}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            title={expanded ? 'Nascondi in attesa' : 'Mostra in attesa'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {/* Expandable pending members list */}
      {expanded && hasPending && (
        <div className="px-3 pb-2 flex items-center gap-2 flex-wrap text-xs border-t border-surface-50/10 pt-2">
          <span className="text-gray-500">In attesa:</span>
          {readyStatus.pendingMembers.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-500/20 text-warning-400 rounded text-[11px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  member.isConnected === true ? 'bg-green-500' : member.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                }`}
              />
              {member.username}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
