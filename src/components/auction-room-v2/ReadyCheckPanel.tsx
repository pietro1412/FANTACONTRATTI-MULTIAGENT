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
  return (
    <div className="mb-6">
      {/* 2-column layout matching WaitingPanel / BiddingPanel */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        {/* Left: Player Card */}
        <div>
          {readyStatus.player && (
            <PlayerCard
              name={readyStatus.player.name}
              team={readyStatus.player.team}
              position={readyStatus.player.position}
              quotation={readyStatus.player.quotation}
              age={readyStatus.player.age}
              apiFootballId={readyStatus.player.apiFootballId}
              appearances={readyStatus.player.appearances}
              goals={readyStatus.player.goals}
              assists={readyStatus.player.assists}
              avgRating={readyStatus.player.avgRating}
              size="lg"
            />
          )}
        </div>

        {/* Right: Ready Check Controls */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative rounded-xl p-5 text-center w-full border-2 border-sky-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/80 overflow-hidden">
            <p className="text-sm text-sky-400 uppercase tracking-wider font-bold mb-3">Conferma Pronti</p>

            {/* Ready Progress */}
            <div className="mb-4">
              <p className="text-5xl lg:text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-white to-sky-400 mb-1">
                {readyStatus.readyCount}/{readyStatus.totalMembers}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">DG Pronti</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-700/50 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-accent-500 transition-all duration-500"
                style={{ width: `${readyStatus.totalMembers > 0 ? (readyStatus.readyCount / readyStatus.totalMembers) * 100 : 0}%` }}
              />
            </div>

            {/* Action area */}
            {readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Conferma la tua scelta</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={onConfirmNomination} disabled={markingReady} className="btn-accent px-8 py-3 text-lg font-bold">
                    {markingReady ? 'Attendi...' : 'CONFERMA'}
                  </Button>
                  <Button onClick={onCancelNomination} variant="outline" className="border-gray-500 text-gray-300 px-6 py-3">
                    Cambia
                  </Button>
                </div>
                <p className="text-[10px] text-gray-500">Dopo la conferma, gli altri DG potranno dichiararsi pronti</p>
              </div>
            )}

            {readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-green-400 font-medium">Confermato — In attesa degli altri</span>
                </div>
                {isAdmin && onForceAllReady && (
                  <div>
                    <Button size="sm" variant="outline" onClick={onForceAllReady} className="border-accent-500/50 text-accent-400 text-xs">
                      [TEST] Forza Tutti Pronti
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!readyStatus.userIsNominator && !readyStatus.nominatorConfirmed && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm text-amber-400">Attendi che <strong>{readyStatus.nominatorUsername}</strong> confermi...</span>
              </div>
            )}

            {!readyStatus.userIsNominator && readyStatus.nominatorConfirmed && (
              <div className="space-y-3">
                {!readyStatus.userIsReady ? (
                  <Button onClick={onMarkReady} disabled={markingReady} className="btn-accent px-12 py-3 text-lg font-bold">
                    {markingReady ? 'Attendi...' : 'SONO PRONTO'}
                  </Button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-green-400 font-medium">Pronto — In attesa degli altri</span>
                  </div>
                )}
                {isAdmin && onForceAllReady && (
                  <div>
                    <Button size="sm" variant="outline" onClick={onForceAllReady} className="border-accent-500/50 text-accent-400 text-xs">
                      [TEST] Forza Tutti Pronti
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Members list below */}
      {readyStatus.nominatorConfirmed && (
        <div className="mt-3">
          <ReadyMembersList readyMembers={readyStatus.readyMembers} pendingMembers={readyStatus.pendingMembers} />
        </div>
      )}
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

