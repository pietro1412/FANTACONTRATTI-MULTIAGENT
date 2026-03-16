import { memo } from 'react'
import { Button } from '../ui/Button'
import type { PendingAck } from '../../types/rubata.types'

export interface PendingAckBannerProps {
  pendingAck: PendingAck
  isAdmin: boolean
  isSubmitting: boolean
  prophecyContent: string
  setProphecyContent: (v: string) => void
  onAcknowledge: () => void
  onForceAllAcknowledge: () => void
}

export const PendingAckBanner = memo(function PendingAckBanner({
  pendingAck,
  isAdmin,
  isSubmitting,
  prophecyContent,
  setProphecyContent,
  onAcknowledge,
  onForceAllAcknowledge,
}: PendingAckBannerProps) {
  const { player, winner, finalPrice, totalMembers, totalAcknowledged, userAcknowledged } = pendingAck
  const progressPct = totalMembers > 0 ? Math.round((totalAcknowledged / totalMembers) * 100) : 0

  return (
    <div className="mb-3 bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-3 space-y-2.5 animate-[fadeIn_0.3s_ease-out]">
      {/* Result headline */}
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">
            {player.name}{' '}
            <span className="text-primary-300">
              rubato da {winner?.username ?? 'nessuno'} per {finalPrice}M
            </span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {player.team} · {player.position}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-primary-400 font-mono whitespace-nowrap">
          {totalAcknowledged}/{totalMembers} confermati
        </span>
      </div>

      {/* Actions row */}
      {!userAcknowledged ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Prophecy input */}
          <input
            type="text"
            value={prophecyContent}
            onChange={(e) => setProphecyContent(e.target.value)}
            placeholder="Profezia (opzionale)..."
            className="flex-1 min-w-[140px] px-3 py-2 bg-surface-300 border border-surface-50/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
          />
          <Button
            onClick={onAcknowledge}
            disabled={isSubmitting}
            className="whitespace-nowrap"
          >
            ✅ Conferma
          </Button>
          {isAdmin && (
            <Button
              onClick={onForceAllAcknowledge}
              disabled={isSubmitting}
              variant="ghost"
              className="text-xs whitespace-nowrap"
            >
              🤖 Forza tutti
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-secondary-400">✓ Hai confermato. In attesa degli altri...</p>
      )}

      {/* Prophecies list */}
      {pendingAck.prophecies && pendingAck.prophecies.length > 0 && (
        <div className="border-t border-surface-50/15 pt-2 space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Profezie</p>
          {pendingAck.prophecies.map((p, i) => (
            <p key={i} className="text-xs text-gray-300">
              <span className="text-primary-400 font-medium">{p.username}</span>: {p.content}
            </p>
          ))}
        </div>
      )}
    </div>
  )
})
