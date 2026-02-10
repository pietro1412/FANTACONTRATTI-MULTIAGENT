import { Button } from '../ui/Button'

interface Appeal {
  id: string
  content: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  resolutionNote?: string
  createdAt: string
  resolvedAt?: string
  auction: {
    id: string
    currentPrice: number
    basePrice: number
    player: { id: string; name: string; team: string; position: string }
    winner?: { user: { username: string } }
    bids: Array<{ amount: number; bidder: { user: { username: string } } }>
  }
  member: { user: { username: string } }
  resolvedBy?: { user: { username: string } }
}

export interface AdminAppealsTabProps {
  appeals: Appeal[]
  isLoadingAppeals: boolean
  isSubmitting: boolean
  appealFilter: 'PENDING' | 'ACCEPTED' | 'REJECTED' | ''
  setAppealFilter: (filter: 'PENDING' | 'ACCEPTED' | 'REJECTED' | '') => void
  resolutionNote: string
  setResolutionNote: (note: string) => void
  selectedAppealId: string | null
  setSelectedAppealId: (id: string | null) => void
  handleResolveAppeal: (appealId: string, decision: 'ACCEPTED' | 'REJECTED') => void
  handleSimulateAppeal: () => void
}

export function AdminAppealsTab({
  appeals,
  isLoadingAppeals,
  isSubmitting,
  appealFilter,
  setAppealFilter,
  resolutionNote,
  setResolutionNote,
  selectedAppealId,
  setSelectedAppealId,
  handleResolveAppeal,
  handleSimulateAppeal,
}: AdminAppealsTabProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      <div className="p-5 border-b border-surface-50/20">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Gestione Ricorsi</h3>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAppealFilter('')}
                className={`px-3 py-1 rounded-lg text-sm ${appealFilter === '' ? 'bg-primary-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
              >
                Tutti
              </button>
              <button
                onClick={() => setAppealFilter('PENDING')}
                className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
              >
                In Attesa
              </button>
              <button
                onClick={() => setAppealFilter('ACCEPTED')}
                className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'ACCEPTED' ? 'bg-green-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
              >
                Accettati
              </button>
              <button
                onClick={() => setAppealFilter('REJECTED')}
                className={`px-3 py-1 rounded-lg text-sm ${appealFilter === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-surface-300 text-gray-400 hover:bg-surface-400'}`}
              >
                Respinti
              </button>
            </div>
            <button
              onClick={handleSimulateAppeal}
              disabled={isSubmitting}
              className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isSubmitting ? '...' : 'Simula Ricorso'}
            </button>
          </div>
        </div>
      </div>
      <div className="p-5">
        {isLoadingAppeals ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto"></div>
          </div>
        ) : appeals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {appealFilter === 'PENDING' ? 'Nessun ricorso in attesa' : 'Nessun ricorso trovato'}
          </div>
        ) : (
          <div className="space-y-4">
            {appeals.map(appeal => (
              <div key={appeal.id} className={`border rounded-xl p-4 ${
                appeal.status === 'PENDING' ? 'border-amber-500/50 bg-amber-500/10' :
                appeal.status === 'ACCEPTED' ? 'border-green-500/50 bg-green-500/10' :
                'border-red-500/50 bg-red-500/10'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      appeal.status === 'PENDING' ? 'bg-amber-500 text-white' :
                      appeal.status === 'ACCEPTED' ? 'bg-green-500 text-white' :
                      'bg-red-500 text-white'
                    }`}>
                      {appeal.status === 'PENDING' ? 'IN ATTESA' : appeal.status === 'ACCEPTED' ? 'ACCETTATO' : 'RESPINTO'}
                    </span>
                    <span className="text-gray-400 text-sm ml-3">
                      {new Date(appeal.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">
                    da <span className="text-white font-medium">{appeal.member.user.username}</span>
                  </span>
                </div>

                {/* Dettagli Asta */}
                <div className="bg-surface-300 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      appeal.auction.player.position === 'P' ? 'bg-amber-500' :
                      appeal.auction.player.position === 'D' ? 'bg-blue-500' :
                      appeal.auction.player.position === 'C' ? 'bg-green-500' : 'bg-red-500'
                    }`}>{appeal.auction.player.position}</span>
                    <div>
                      <p className="font-bold text-white">{appeal.auction.player.name}</p>
                      <p className="text-sm text-gray-400">{appeal.auction.player.team}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-accent-400 font-bold">{appeal.auction.currentPrice}M</p>
                      {appeal.auction.winner && (
                        <p className="text-sm text-gray-400">Vinta da: {appeal.auction.winner.user.username}</p>
                      )}
                    </div>
                  </div>
                  {appeal.auction.bids.length > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Ultime offerte: {appeal.auction.bids.slice(0, 3).map(b => `${b.bidder.user.username} (${b.amount})`).join(', ')}
                    </div>
                  )}
                </div>

                {/* Motivazione Ricorso */}
                <div className="mb-3">
                  <p className="text-sm text-gray-400 mb-1">Motivazione:</p>
                  <p className="text-white bg-surface-400 rounded-lg p-3 italic">"{appeal.content}"</p>
                </div>

                {/* Risoluzione */}
                {appeal.status !== 'PENDING' && appeal.resolvedBy && (
                  <div className="bg-surface-400 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-400">
                      Risolto da <span className="text-white">{appeal.resolvedBy.user.username}</span> il {new Date(appeal.resolvedAt!).toLocaleDateString('it-IT')}
                    </p>
                    {appeal.resolutionNote && (
                      <p className="text-sm text-white mt-1">Nota: {appeal.resolutionNote}</p>
                    )}
                  </div>
                )}

                {/* Azioni Admin */}
                {appeal.status === 'PENDING' && (
                  <div className="border-t border-surface-50/20 pt-3 mt-3">
                    {selectedAppealId === appeal.id ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full bg-surface-400 border border-surface-50/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm"
                          placeholder="Nota di risoluzione (opzionale)"
                          rows={2}
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleResolveAppeal(appeal.id, 'ACCEPTED')}
                            disabled={isSubmitting}
                          >
                            Accetta (Riapri Asta)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveAppeal(appeal.id, 'REJECTED')}
                            disabled={isSubmitting}
                          >
                            Respingi
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedAppealId(null); setResolutionNote('') }}
                          >
                            Annulla
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedAppealId(appeal.id)}
                      >
                        Gestisci Ricorso
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
