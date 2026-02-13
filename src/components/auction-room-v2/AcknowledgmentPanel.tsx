import type { PendingAcknowledgment } from '../../types/auctionroom.types'

interface AcknowledgmentPanelProps {
  pendingAck: PendingAcknowledgment
  onAcknowledge: () => void
  ackSubmitting: boolean
  isAdmin: boolean
  onForceAcknowledgeAll?: () => void
}

export function AcknowledgmentPanel({
  pendingAck,
  onAcknowledge,
  ackSubmitting,
  isAdmin,
  onForceAcknowledgeAll,
}: AcknowledgmentPanelProps) {
  const percent = pendingAck.totalMembers > 0
    ? (pendingAck.totalAcknowledged / pendingAck.totalMembers) * 100
    : 0

  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-14 h-14 mx-auto rounded-full bg-teal-500/20 flex items-center justify-center">
        <span className="text-2xl">{pendingAck.winner ? '🏆' : '🔄'}</span>
      </div>

      {/* Result */}
      <div>
        <h3 className="text-lg font-bold text-white mb-1">
          {pendingAck.winner
            ? `${pendingAck.player.name} → ${pendingAck.winner.username}`
            : `${pendingAck.player.name} - Nessuna offerta`}
        </h3>
        {pendingAck.winner && (
          <p className="text-2xl font-black text-accent-400">{pendingAck.finalPrice}</p>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-sms mb-1">
          <span className="text-gray-400">Conferme</span>
          <span className="font-bold text-white">{pendingAck.totalAcknowledged}/{pendingAck.totalMembers}</span>
        </div>
        <div className="w-full bg-surface-400 rounded-full h-2">
          <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Members status */}
      {(pendingAck.acknowledgedMembers.length > 0 || pendingAck.pendingMembers.length > 0) && (
        <div className="bg-surface-300/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2 text-sms">
            <div className="text-left">
              <p className="text-teal-400 font-semibold mb-1">Confermato</p>
              {pendingAck.acknowledgedMembers.map(m => (
                <p key={m.id} className="text-gray-300">{m.username}</p>
              ))}
            </div>
            <div className="text-left">
              <p className="text-amber-400 font-semibold mb-1">In attesa</p>
              {pendingAck.pendingMembers.map(m => (
                <p key={m.id} className="text-gray-400">{m.username}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!pendingAck.userAcknowledged ? (
        <p className="text-sm text-gray-500">Conferma nel pannello modale...</p>
      ) : (
        <p className="text-teal-400 font-medium text-sm">Confermato - In attesa degli altri</p>
      )}

      {isAdmin && onForceAcknowledgeAll && (
        <button
          onClick={onForceAcknowledgeAll}
          className="px-4 py-1.5 text-sms border border-accent-500/50 text-accent-400 rounded-lg hover:bg-accent-500/10"
        >
          [TEST] Forza Conferme
        </button>
      )}
    </div>
  )
}
