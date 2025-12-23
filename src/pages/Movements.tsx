import { useState, useEffect } from 'react'
import { movementApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'

interface MovementsProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface Player {
  id: string
  name: string
  team: string
  position: string
}

interface MemberInfo {
  memberId: string
  username: string
  teamName: string | null
}

interface ContractInfo {
  salary: number
  duration: number
  clause: number | null
}

interface Prophecy {
  id: string
  content: string
  authorRole: 'BUYER' | 'SELLER'
  author: MemberInfo
  createdAt: string
}

interface Movement {
  id: string
  type: string
  player: Player
  from: MemberInfo | null
  to: MemberInfo | null
  price: number | null
  oldContract: ContractInfo | null
  newContract: ContractInfo | null
  prophecies: Prophecy[]
  createdAt: string
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  FIRST_MARKET: 'Primo Mercato',
  TRADE: 'Scambio',
  RUBATA: 'Rubata',
  SVINCOLATI: 'Svincolati',
  RELEASE: 'Svincolo',
  CONTRACT_RENEW: 'Rinnovo',
}

const MOVEMENT_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  FIRST_MARKET: { bg: 'bg-primary-500/20', text: 'text-primary-400', border: 'border-primary-500/30' },
  TRADE: { bg: 'bg-secondary-500/20', text: 'text-secondary-400', border: 'border-secondary-500/30' },
  RUBATA: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  SVINCOLATI: { bg: 'bg-accent-500/20', text: 'text-accent-400', border: 'border-accent-500/30' },
  RELEASE: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  CONTRACT_RENEW: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
}

const POSITION_STYLES: Record<string, { gradient: string; text: string }> = {
  P: { gradient: 'from-amber-500 to-amber-600', text: 'text-amber-400' },
  D: { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-400' },
  C: { gradient: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400' },
  A: { gradient: 'from-red-500 to-red-600', text: 'text-red-400' },
}

export function Movements({ leagueId, onNavigate }: MovementsProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState<string>('')

  // Prophecy form
  const [prophecyContent, setProphecyContent] = useState('')
  const [prophecyMovementId, setProphecyMovementId] = useState<string | null>(null)
  const [canMakeProphecy, setCanMakeProphecy] = useState<Record<string, { can: boolean; role?: string }>>({})
  const [isSubmittingProphecy, setIsSubmittingProphecy] = useState(false)

  useEffect(() => {
    loadMovements()
  }, [leagueId, filterType])

  async function loadMovements() {
    setIsLoading(true)
    setError('')

    const options: { movementType?: string } = {}
    if (filterType) options.movementType = filterType

    const result = await movementApi.getLeagueMovements(leagueId, options)

    if (result.success && result.data) {
      const movementList = result.data as Movement[]
      setMovements(movementList)

      // Check prophecy eligibility for each movement
      const eligibility: Record<string, { can: boolean; role?: string }> = {}
      for (const movement of movementList) {
        const canRes = await movementApi.canMakeProphecy(movement.id)
        if (canRes.success && canRes.data) {
          const data = canRes.data as { canMakeProphecy: boolean; role?: string }
          eligibility[movement.id] = { can: data.canMakeProphecy, role: data.role }
        }
      }
      setCanMakeProphecy(eligibility)
    } else {
      setError(result.message || 'Errore nel caricamento')
    }

    setIsLoading(false)
  }

  async function handleAddProphecy(movementId: string) {
    if (!prophecyContent.trim()) return

    setIsSubmittingProphecy(true)
    const result = await movementApi.addProphecy(movementId, prophecyContent)

    if (result.success) {
      setProphecyContent('')
      setProphecyMovementId(null)
      loadMovements()
    } else {
      setError(result.message || 'Errore nell\'aggiunta della profezia')
    }

    setIsSubmittingProphecy(false)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento storico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="movements" leagueId={leagueId} onNavigate={onNavigate} />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
              <span className="text-3xl">📜</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Storico Movimenti</h1>
              <p className="text-gray-400 mt-1">Tutte le transazioni e le profezie</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5 mb-8">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-white">Filtra per tipo:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-surface-300 border border-surface-50/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="">Tutti i movimenti</option>
              <option value="FIRST_MARKET">Primo Mercato</option>
              <option value="TRADE">Scambi</option>
              <option value="RUBATA">Rubate</option>
              <option value="SVINCOLATI">Svincolati</option>
              <option value="RELEASE">Svincoli</option>
              <option value="CONTRACT_RENEW">Rinnovi</option>
            </select>
            <span className="text-gray-400 text-sm">{movements.length} movimenti trovati</span>
          </div>
        </div>

        {/* Movements List */}
        {movements.length === 0 ? (
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-16 text-center">
            <div className="text-5xl mb-4 opacity-50">📭</div>
            <p className="text-xl text-gray-400">Nessun movimento registrato</p>
          </div>
        ) : (
          <div className="space-y-4">
            {movements.map((movement) => {
              const posStyle = POSITION_STYLES[movement.player.position] || { gradient: 'from-gray-500 to-gray-600', text: 'text-gray-400' }
              const typeStyle = MOVEMENT_TYPE_STYLES[movement.type] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' }

              return (
                <div key={movement.id} className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden hover:border-primary-500/30 transition-all">
                  {/* Movement Header */}
                  <div className="p-5 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${posStyle.gradient} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                        {movement.player.position}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{movement.player.name}</h3>
                        <p className="text-gray-400">{movement.player.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border}`}>
                        {MOVEMENT_TYPE_LABELS[movement.type] || movement.type}
                      </span>
                      <p className="text-sm text-gray-500 mt-2">{formatDate(movement.createdAt)}</p>
                    </div>
                  </div>

                  {/* Movement Details */}
                  <div className="px-5 pb-5">
                    <div className="bg-surface-300 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 text-base">
                        {movement.from ? (
                          <span className="font-semibold text-white">{movement.from.username}</span>
                        ) : (
                          <span className="text-gray-500 italic">Svincolato</span>
                        )}
                        <span className="text-2xl text-gray-500">→</span>
                        {movement.to ? (
                          <span className="font-semibold text-white">{movement.to.username}</span>
                        ) : (
                          <span className="text-gray-500 italic">Svincolato</span>
                        )}
                        {movement.price && (
                          <span className="ml-auto text-xl font-bold text-accent-400">
                            {movement.price} crediti
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contract info */}
                    {(movement.oldContract || movement.newContract) && (
                      <div className="flex gap-4 mb-4">
                        {movement.oldContract && (
                          <div className="bg-surface-300 rounded-lg p-3 flex-1">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Contratto Precedente</p>
                            <p className="text-sm text-gray-300">
                              {movement.oldContract.salary}/sem x {movement.oldContract.duration} semestri
                            </p>
                          </div>
                        )}
                        {movement.newContract && (
                          <div className="bg-surface-300 rounded-lg p-3 flex-1 border border-secondary-500/30">
                            <p className="text-xs text-secondary-400 uppercase tracking-wide mb-1">Nuovo Contratto</p>
                            <p className="text-sm text-white">
                              {movement.newContract.salary}/sem x {movement.newContract.duration} semestri
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prophecies */}
                    {movement.prophecies.length > 0 && (
                      <div className="border-t border-surface-50/20 pt-4 mt-4">
                        <h4 className="text-sm font-bold text-accent-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <span>✨</span> Profezie
                        </h4>
                        <div className="space-y-3">
                          {movement.prophecies.map((prophecy) => (
                            <div key={prophecy.id} className="bg-gradient-to-r from-accent-500/10 to-accent-500/5 border border-accent-500/20 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">{prophecy.author.username}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    prophecy.authorRole === 'BUYER'
                                      ? 'bg-secondary-500/20 text-secondary-400'
                                      : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {prophecy.authorRole === 'BUYER' ? 'Acquirente' : 'Venditore'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">{formatDate(prophecy.createdAt)}</span>
                              </div>
                              <p className="text-gray-200 italic text-lg">"{prophecy.content}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add prophecy form */}
                    {canMakeProphecy[movement.id]?.can && (
                      <div className="border-t border-surface-50/20 pt-4 mt-4">
                        {prophecyMovementId === movement.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={prophecyContent}
                              onChange={(e) => setProphecyContent(e.target.value)}
                              placeholder="Scrivi la tua profezia su questo giocatore..."
                              className="w-full bg-surface-300 border border-surface-50/30 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                              rows={3}
                              maxLength={500}
                            />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">
                                {prophecyContent.length}/500 caratteri
                              </span>
                              <div className="flex gap-3">
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setProphecyMovementId(null)
                                    setProphecyContent('')
                                  }}
                                >
                                  Annulla
                                </Button>
                                <Button
                                  variant="accent"
                                  onClick={() => handleAddProphecy(movement.id)}
                                  disabled={!prophecyContent.trim() || isSubmittingProphecy}
                                >
                                  {isSubmittingProphecy ? 'Invio...' : 'Pubblica Profezia'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => setProphecyMovementId(movement.id)}
                            className="border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
                          >
                            <span className="mr-2">✨</span>
                            Aggiungi Profezia
                            <span className="ml-2 text-xs opacity-75">
                              ({canMakeProphecy[movement.id]?.role === 'BUYER' ? 'Acquirente' : 'Venditore'})
                            </span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
