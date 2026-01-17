import { useState, useEffect } from 'react'
import { historyApi } from '../../services/api'

interface PlayerCareerPanelProps {
  leagueId: string
  playerId: string
  playerName: string
  onClose: () => void
}

interface PlayerCareer {
  player: {
    id: string
    name: string
    position: string
    team: string
    quotation: number
  }
  currentOwner: {
    memberId: string
    username: string
    teamName: string | null
    contract: {
      salary: number
      duration: number
      rescissionClause: number | null
    } | null
  } | null
  timeline: Array<{
    id: string
    type: string
    date: string
    from: { username: string; teamName: string | null } | null
    to: { username: string; teamName: string | null } | null
    price: number | null
    oldContract: { salary: number; duration: number; clause: number | null } | null
    newContract: { salary: number; duration: number; clause: number | null } | null
    session: string | null
  }>
  stats: {
    totalMovements: number
    trades: number
    acquisitions: number
    renewals: number
    totalValue: number
    teams: string[]
  }
}

const eventTypeConfig: Record<string, { icon: string; label: string; color: string }> = {
  FIRST_MARKET: { icon: '🏆', label: 'Primo Mercato', color: 'text-yellow-400' },
  TRADE: { icon: '🔄', label: 'Scambio', color: 'text-blue-400' },
  RUBATA: { icon: '🎯', label: 'Rubata', color: 'text-red-400' },
  SVINCOLATI: { icon: '📋', label: 'Svincolati', color: 'text-green-400' },
  RELEASE: { icon: '📤', label: 'Cessione', color: 'text-gray-400' },
  CONTRACT_RENEW: { icon: '📝', label: 'Rinnovo', color: 'text-purple-400' },
  // Indemnity movement types
  RETIREMENT: { icon: '🛑', label: 'Ritiro', color: 'text-gray-500' },
  RELEGATION_RELEASE: { icon: '⬇️', label: 'Retrocesso (Rilascio)', color: 'text-amber-500' },
  RELEGATION_KEEP: { icon: '⬇️', label: 'Retrocesso (Mantenuto)', color: 'text-amber-400' },
  ABROAD_COMPENSATION: { icon: '✈️', label: 'Estero (Compenso)', color: 'text-cyan-400' },
  ABROAD_KEEP: { icon: '✈️', label: 'Estero (Mantenuto)', color: 'text-cyan-300' },
}

const positionColors: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  D: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  A: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function PlayerCareerPanel({ leagueId, playerId, playerName, onClose }: PlayerCareerPanelProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [career, setCareer] = useState<PlayerCareer | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCareer()
  }, [leagueId, playerId])

  async function loadCareer() {
    setIsLoading(true)
    setError('')

    try {
      const result = await historyApi.getPlayerCareer(leagueId, playerId)
      if (result.success && result.data) {
        setCareer(result.data as PlayerCareer)
      } else {
        setError(result.message || 'Errore nel caricamento')
      }
    } catch (err) {
      setError('Errore di connessione')
    }
    setIsLoading(false)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (error || !career) {
    return (
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Carriera: {playerName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            x
          </button>
        </div>
        <p className="text-red-400">{error || 'Errore sconosciuto'}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden mb-6">
      {/* Header */}
      <div className="p-4 border-b border-surface-50/20 bg-surface-300/30">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Position Badge */}
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border ${
                positionColors[career.player.position]
              }`}
            >
              {career.player.position}
            </div>
            {/* Player Info */}
            <div>
              <h3 className="text-xl font-bold text-white">{career.player.name}</h3>
              <p className="text-gray-400">{career.player.team}</p>
              <p className="text-sm text-gray-500">Quotazione: {career.player.quotation}M</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-surface-300 rounded-lg transition-colors"
          >
            x
          </button>
        </div>
      </div>

      {/* Current Owner */}
      {career.currentOwner && (
        <div className="p-4 border-b border-surface-50/20 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-400">Proprietario attuale:</span>
              <p className="font-medium text-white">
                {career.currentOwner.teamName || career.currentOwner.username}
              </p>
            </div>
            {career.currentOwner.contract && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Contratto</p>
                <p className="font-medium text-primary-400">
                  {career.currentOwner.contract.salary}M / {career.currentOwner.contract.duration}a
                </p>
                {career.currentOwner.contract.rescissionClause && (
                  <p className="text-xs text-yellow-500">
                    RC: {career.currentOwner.contract.rescissionClause}M
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!career.currentOwner && (
        <div className="p-4 border-b border-surface-50/20 bg-surface-300/30">
          <p className="text-gray-400">Attualmente svincolato</p>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 border-b border-surface-50/20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{career.stats.totalMovements}</div>
            <div className="text-xs text-gray-400">Movimenti</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{career.stats.trades}</div>
            <div className="text-xs text-gray-400">Scambi</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{career.stats.acquisitions}</div>
            <div className="text-xs text-gray-400">Acquisti</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{career.stats.renewals}</div>
            <div className="text-xs text-gray-400">Rinnovi</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-400">{career.stats.totalValue}M</div>
            <div className="text-xs text-gray-400">Valore Totale</div>
          </div>
        </div>

        {/* Teams */}
        {career.stats.teams.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Squadre:</span>
            {career.stats.teams.map(team => (
              <span
                key={team}
                className="px-2 py-1 bg-surface-300 rounded text-sm text-white"
              >
                {team}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4">
        <h4 className="font-medium text-white mb-4">Cronologia</h4>
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-surface-50/30" />

          <div className="space-y-4">
            {career.timeline.map((event) => {
              const config = eventTypeConfig[event.type] || {
                icon: '📌',
                label: event.type,
                color: 'text-gray-400',
              }

              return (
                <div key={event.id} className="relative pl-10">
                  {/* Dot */}
                  <div className="absolute left-1.5 top-2 w-4 h-4 bg-surface-200 rounded-full border-2 border-surface-50/50 flex items-center justify-center">
                    <span className="text-xs">{config.icon}</span>
                  </div>

                  <div className="bg-surface-300/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {/* Type & Date */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(event.date)}
                          </span>
                          {event.session && (
                            <span className="text-xs text-gray-500">• {event.session}</span>
                          )}
                        </div>

                        {/* Transfer */}
                        <div className="text-sm">
                          {event.from && (
                            <span className="text-gray-400">
                              Da: {event.from.teamName || event.from.username}
                            </span>
                          )}
                          {event.from && event.to && (
                            <span className="text-gray-500 mx-2">→</span>
                          )}
                          {event.to && (
                            <span className="text-gray-400">
                              A: {event.to.teamName || event.to.username}
                            </span>
                          )}
                        </div>

                        {/* Contract Change */}
                        {(event.oldContract || event.newContract) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {event.oldContract && (
                              <span>
                                {event.oldContract.salary}M/{event.oldContract.duration}a
                              </span>
                            )}
                            {event.oldContract && event.newContract && (
                              <span className="mx-1">→</span>
                            )}
                            {event.newContract && (
                              <span className="text-primary-400">
                                {event.newContract.salary}M/{event.newContract.duration}a
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price */}
                      {event.price !== null && event.price > 0 && (
                        <div className="text-lg font-bold text-primary-400">
                          {event.price}M
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {career.timeline.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Nessun movimento registrato per questo giocatore
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
