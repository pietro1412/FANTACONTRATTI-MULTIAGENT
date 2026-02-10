import { Button } from '../ui/Button'
import { PlayerCard } from './PlayerCard'
import type { ReadyStatus } from '../../types/auctionroom.types'

interface ReadyCheckPanelProps {
  readyStatus: ReadyStatus
  onConfirmNomination: () => void
  onCancelNomination: () => void
  onMarkReady: () => void
  markingReady: boolean
  isAdmin: boolean
  onForceAllReady?: () => void
}

export function ReadyCheckPanel({
  readyStatus,
  onConfirmNomination,
  onCancelNomination,
  onMarkReady,
  markingReady,
  isAdmin,
  onForceAllReady,
}: ReadyCheckPanelProps) {
  const progressPercent = readyStatus.totalMembers > 0
    ? (readyStatus.readyCount / readyStatus.totalMembers) * 100
    : 0

  return (
    <div className="space-y-4">
      {/* Player Card */}
      {readyStatus.player && (
        <PlayerCard
          name={readyStatus.player.name}
          team={readyStatus.player.team}
          position={readyStatus.player.position}
          quotation={readyStatus.player.quotation}
          size="md"
        />
      )}

      {/* Nominator: Confirm/Cancel (before confirmation) */}
      {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-400">Conferma la tua scelta</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={onConfirmNomination} disabled={markingReady} className="btn-accent px-8 py-3 text-lg font-bold">
              {markingReady ? 'Attendi...' : 'CONFERMA'}
            </Button>
            <Button onClick={onCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
              Cambia
            </Button>
          </div>
          <p className="text-xs text-gray-500">Dopo la conferma, gli altri DG potranno dichiararsi pronti</p>
        </div>
      )}

      {/* Nominator: After confirmation */}
      {readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
        <ReadyProgressSection
          readyStatus={readyStatus}
          label="Confermato - In attesa degli altri"
          isAdmin={isAdmin}
          onForceAllReady={onForceAllReady}
        />
      )}

      {/* Non-nominator: Waiting for confirmation */}
      {!readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
        <div className="text-center py-4">
          <p className="text-amber-400 font-medium">Attendi che {readyStatus.nominatorUsername} confermi la scelta...</p>
        </div>
      )}

      {/* Non-nominator: After confirmation */}
      {!readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
        <div className="space-y-4">
          <ReadyProgressBar readyCount={readyStatus.readyCount} totalMembers={readyStatus.totalMembers} />
          <ReadyMembersList readyMembers={readyStatus.readyMembers} pendingMembers={readyStatus.pendingMembers} />
          {!readyStatus.userIsReady ? (
            <div className="text-center">
              <Button onClick={onMarkReady} disabled={markingReady} className="btn-accent px-12 py-3 text-lg font-bold">
                {markingReady ? 'Attendi...' : 'SONO PRONTO'}
              </Button>
            </div>
          ) : (
            <ReadyProgressSection
              readyStatus={readyStatus}
              label="Pronto - In attesa degli altri"
              isAdmin={isAdmin}
              onForceAllReady={onForceAllReady}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ReadyProgressBar({ readyCount, totalMembers }: { readyCount: number; totalMembers: number }) {
  const percent = totalMembers > 0 ? (readyCount / totalMembers) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">DG pronti</span>
        <span className="font-bold text-white">{readyCount}/{totalMembers}</span>
      </div>
      <div className="w-full bg-surface-400 rounded-full h-2">
        <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function ReadyMembersList({ readyMembers, pendingMembers }: {
  readyMembers: { id: string; username: string }[]
  pendingMembers: { id: string; username: string }[]
}) {
  return (
    <div className="bg-surface-300/50 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-secondary-400 font-semibold mb-1 text-xs">Pronti</p>
          {readyMembers.length > 0 ? (
            readyMembers.map(m => <p key={m.id} className="text-gray-300 text-xs">{m.username}</p>)
          ) : (
            <p className="text-gray-500 italic text-xs">Nessuno</p>
          )}
        </div>
        <div>
          <p className="text-amber-400 font-semibold mb-1 text-xs">In attesa</p>
          {pendingMembers.length > 0 ? (
            pendingMembers.map(m => <p key={m.id} className="text-gray-400 text-xs">{m.username}</p>)
          ) : (
            <p className="text-gray-500 italic text-xs">Nessuno</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ReadyProgressSection({ readyStatus, label, isAdmin, onForceAllReady }: {
  readyStatus: ReadyStatus
  label: string
  isAdmin: boolean
  onForceAllReady?: () => void
}) {
  return (
    <div className="space-y-3">
      <ReadyProgressBar readyCount={readyStatus.readyCount} totalMembers={readyStatus.totalMembers} />
      <ReadyMembersList readyMembers={readyStatus.readyMembers} pendingMembers={readyStatus.pendingMembers} />
      <p className="text-secondary-400 font-medium text-center text-sm">{label}</p>
      {isAdmin && onForceAllReady && (
        <div className="text-center">
          <Button size="sm" variant="outline" onClick={onForceAllReady} className="border-accent-500/50 text-accent-400 text-xs">
            [TEST] Forza Tutti Pronti
          </Button>
        </div>
      )}
    </div>
  )
}
