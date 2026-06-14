import { Button } from '../ui/Button'
import { POSITION_CHIP, POSITION_NAMES, type MemberRosterData } from './types'

export interface RosterModalProps {
  rosterLoading: boolean
  rosterData: MemberRosterData | null
  onClose: () => void
}

export function RosterModal({ rosterLoading, rosterData, onClose }: RosterModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl border border-surface-50 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-surface-50">
          <div className="flex items-center justify-between">
            <div>
              {rosterData ? (
                <>
                  <h2 className="font-display font-bold text-xl text-white">
                    Rosa di {rosterData.member.username}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {rosterData.member.league.name} · Budget: <span className="text-accent-400 font-mono">{rosterData.member.currentBudget}</span>
                  </p>
                </>
              ) : (
                <h2 className="font-display font-bold text-xl text-white">Caricamento rosa...</h2>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-surface-300 hover:bg-surface-100 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {rosterLoading ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Caricamento rosa...</p>
            </div>
          ) : rosterData && rosterData.roster.length > 0 ? (
            <div className="space-y-4">
              {(['P', 'D', 'C', 'A'] as const).map(pos => {
                const posPlayers = rosterData.roster.filter(r => r.player.position === pos)
                if (posPlayers.length === 0) return null
                return (
                  <div key={pos}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-7 h-7 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[pos] ?? ''}`}>
                        {pos}
                      </span>
                      <span className="micro-label text-gray-300">{POSITION_NAMES[pos]} ({posPlayers.length})</span>
                    </div>
                    <div className="grid gap-2">
                      {posPlayers.map((entry) => (
                        <div key={entry.id} className="bg-surface-300 border border-surface-50 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <p className="font-display font-bold text-white">{entry.player.name}</p>
                            <p className="text-xs text-gray-400">{entry.player.team}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">
                              Quot. <span className="text-accent-400 font-mono">{entry.player.quotation}</span>
                            </p>
                            {entry.contract && (
                              <p className="text-xs text-gray-500">
                                Pagato: <span className="text-primary-400 font-mono">{entry.contract.purchasePrice}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : rosterData ? (
            <div className="py-12 text-center text-gray-400">
              <p>Questo Direttore Generale non ha ancora giocatori in rosa</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-50 bg-surface-300">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  )
}
