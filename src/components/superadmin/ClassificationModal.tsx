import { Button } from '../ui/Button'
import {
  POSITION_CHIP,
  EXIT_REASON_CHIP,
  type ExitReason,
  type ExitedPlayerInfo,
} from './types'

export interface ClassificationModalProps {
  step: 'edit' | 'confirm' | 'success'
  players: ExitedPlayerInfo[]
  classifications: Record<string, ExitReason>
  submittedClassifications: Array<{ player: ExitedPlayerInfo; reason: ExitReason }>
  classifiedCount: number
  classifyingPlayers: boolean
  errorMessage: string | null
  onClose: () => void
  onChange: (playerId: string, reason: ExitReason) => void
  onGoToConfirm: () => void
  onGoBackToEdit: () => void
  onSubmit: () => void
}

const REASON_LABELS: Record<ExitReason, string> = {
  RITIRATO: 'Ritirato',
  RETROCESSO: 'Retrocesso',
  ESTERO: 'Estero',
}

export function ClassificationModal({
  step,
  players,
  classifications,
  submittedClassifications,
  classifiedCount,
  classifyingPlayers,
  errorMessage,
  onClose,
  onChange,
  onGoToConfirm,
  onGoBackToEdit,
  onSubmit,
}: ClassificationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-xl border border-surface-50 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-surface-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-white">
                {step === 'success'
                  ? 'Classificazione Completata'
                  : step === 'confirm'
                  ? 'Conferma Classificazioni'
                  : 'Classifica Giocatori Usciti'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {step === 'success'
                  ? `${classifiedCount} giocatori classificati con successo`
                  : step === 'confirm'
                  ? 'Verifica le classificazioni prima di confermare'
                  : 'Indica il motivo per cui ogni giocatore non e\' piu\' in lista'}
              </p>
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
          {/* Step 1: Edit */}
          {step === 'edit' && (
            <>
              <div className="bg-surface-300 border border-surface-50 rounded-xl p-4 mb-6">
                <h3 className="micro-label text-gray-400 mb-3">Legenda Classificazioni</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_CHIP.RITIRATO}`}>RITIRATO</span>
                    <p className="text-xs text-gray-400">Il giocatore ha smesso di giocare. Contratto terminato senza compenso.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_CHIP.RETROCESSO}`}>RETROCESSO</span>
                    <p className="text-xs text-gray-400">Il giocatore e' sceso in Serie B o inferiore. Il manager decidera' se tenerlo.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${EXIT_REASON_CHIP.ESTERO}`}>ESTERO</span>
                    <p className="text-xs text-gray-400">Il giocatore e' andato all'estero. Il manager ricevera' un compenso se rilascia.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {players.map((player) => (
                  <div key={player.playerId} className="bg-surface-300 border border-surface-50 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-full border flex items-center justify-center font-display font-bold text-sm ${POSITION_CHIP[player.position] ?? ''}`}>
                          {player.position}
                        </span>
                        <div>
                          <p className="font-display font-bold text-white">{player.playerName}</p>
                          <p className="text-sm text-gray-400">{player.team} · Quot. <span className="text-accent-400 font-mono">{player.lastQuotation}</span></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right mr-4">
                          <p className="text-xs text-gray-500">Contratti attivi</p>
                          <p className="text-sm">
                            {player.contracts.map((c, i) => (
                              <span key={c.memberId} className="text-primary-400">
                                {i > 0 && ', '}
                                {c.memberUsername}
                              </span>
                            ))}
                          </p>
                        </div>

                        <select
                          value={classifications[player.playerId] || 'RITIRATO'}
                          onChange={(e) => { onChange(player.playerId, e.target.value as ExitReason); }}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                            EXIT_REASON_CHIP[classifications[player.playerId] || 'RITIRATO']
                          } cursor-pointer min-w-[140px]`}
                        >
                          <option value="RITIRATO">Ritirato</option>
                          <option value="RETROCESSO">Retrocesso</option>
                          <option value="ESTERO">Estero</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && (
            <>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {(['RITIRATO', 'RETROCESSO', 'ESTERO'] as ExitReason[]).map(reason => {
                  const count = submittedClassifications.filter(c => c.reason === reason).length
                  return (
                    <div key={reason} className={`p-4 rounded-xl border ${EXIT_REASON_CHIP[reason]}`}>
                      <div className="stat-number text-2xl">{count}</div>
                      <div className="text-sm opacity-80">
                        {reason === 'RITIRATO' ? 'Ritirati' : reason === 'RETROCESSO' ? 'Retrocessi' : 'Estero'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <h4 className="micro-label text-gray-400 mb-3">Riepilogo Classificazioni</h4>
              <div className="space-y-2">
                {submittedClassifications.map(({ player, reason }) => (
                  <div key={player.playerId} className="bg-surface-300 border border-surface-50 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-display font-bold text-xs ${POSITION_CHIP[player.position] ?? ''}`}>
                        {player.position}
                      </span>
                      <div>
                        <p className="font-display font-bold text-white text-sm">{player.playerName}</p>
                        <p className="text-xs text-gray-500">{player.team}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-medium border ${EXIT_REASON_CHIP[reason]}`}>
                      {REASON_LABELS[reason]}
                    </span>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="mt-4 p-4 rounded-lg bg-danger-500/20 border border-danger-500/50 text-danger-400">
                  <p className="font-medium">{errorMessage}</p>
                </div>
              )}
            </>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-secondary-500/20 border border-secondary-500/40 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mb-2">Classificazione Salvata!</h3>
              <p className="text-gray-400 mb-8">
                {classifiedCount} giocatori sono stati classificati correttamente.
                <br />
                I manager interessati vedranno i loro giocatori nella fase Indennizzi.
              </p>

              <div className="grid md:grid-cols-3 gap-4 max-w-lg mx-auto">
                {(['RITIRATO', 'RETROCESSO', 'ESTERO'] as ExitReason[]).map(reason => {
                  const count = submittedClassifications.filter(c => c.reason === reason).length
                  if (count === 0) return null
                  return (
                    <div key={reason} className={`p-3 rounded-xl border ${EXIT_REASON_CHIP[reason]}`}>
                      <div className="stat-number text-xl">{count}</div>
                      <div className="text-xs opacity-80">
                        {reason === 'RITIRATO' ? 'Ritirati' : reason === 'RETROCESSO' ? 'Retrocessi' : 'Estero'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-50 bg-surface-300 flex gap-3">
          {step === 'edit' && (
            <>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Annulla
              </Button>
              <Button
                className="flex-1"
                onClick={onGoToConfirm}
                disabled={players.length === 0}
              >
                Prosegui ({players.length})
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" className="flex-1" onClick={onGoBackToEdit}>
                Modifica
              </Button>
              <Button
                className="flex-1"
                onClick={onSubmit}
                disabled={classifyingPlayers}
              >
                {classifyingPlayers ? 'Salvataggio...' : 'Conferma e Salva'}
              </Button>
            </>
          )}

          {step === 'success' && (
            <Button className="flex-1" onClick={onClose}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
