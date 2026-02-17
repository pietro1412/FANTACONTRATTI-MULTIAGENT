import { useState, useEffect } from 'react'
import { indemnityApi, leagueApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Navigation } from '../components/Navigation'
import { getTeamLogo } from '../utils/teamLogos'
import { POSITION_COLORS } from '../components/ui/PositionBadge'

interface IndemnityProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface AffectedPlayer {
  playerId: string
  playerName: string
  position: string
  team: string
  exitReason: 'RITIRATO' | 'RETROCESSO' | 'ESTERO'
  exitDate: string | null
  contract: {
    id: string
    salary: number
    duration: number
    rescissionClause: number
  }
  roster: {
    id: string
    acquisitionPrice: number
  }
}

interface DecisionStatus {
  memberId: string
  username: string
  teamName: string | null
  affectedCount: number
  hasDecided: boolean
  decidedAt: string | null
}

type Decision = 'KEEP' | 'RELEASE'

const EXIT_REASON_CONFIG = {
  RITIRATO: {
    label: 'Ritirato',
    description: 'Il giocatore si e\' ritirato. Il contratto viene automaticamente risolto.',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    icon: '🛑',
    canDecide: false,
    releaseLabel: 'Rilasciato',
    keepLabel: '-',
    releaseCompensation: null,
  },
  RETROCESSO: {
    label: 'Retrocesso',
    description: 'Il giocatore e\' sceso in Serie B. Puoi tenerlo o rilasciarlo senza compenso.',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    icon: '⬇️',
    canDecide: true,
    releaseLabel: 'Rilascia (senza compenso)',
    keepLabel: 'Mantieni (continua a pagare)',
    releaseCompensation: 0,
  },
  ESTERO: {
    label: 'Estero',
    description: 'Il giocatore e\' andato all\'estero. Puoi tenerlo o rilasciarlo ricevendo un compenso.',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    icon: '✈️',
    canDecide: true,
    releaseLabel: 'Rilascia (con compenso)',
    keepLabel: 'Mantieni (continua a pagare)',
    releaseCompensation: 'calculated', // Will be calculated
  },
}

function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-6 h-6 object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

export function Indemnity({ leagueId, onNavigate }: IndemnityProps) {
  const [affectedPlayers, setAffectedPlayers] = useState<AffectedPlayer[]>([])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [currentBudget, setCurrentBudget] = useState(0)
  const [inCalcoloPhase, setInCalcoloPhase] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Admin view
  const [decisionStatuses, setDecisionStatuses] = useState<DecisionStatus[]>([])
  const [allDecided, setAllDecided] = useState(false)
  const [indennizzoEstero, setIndennizzoEstero] = useState(50) // Default 50M, fetched from API

  useEffect(() => {
    loadData()
  }, [leagueId])

  async function loadData() {
    setIsLoading(true)
    setError('')

    // Check if admin
    const leagueResponse = await leagueApi.getById(leagueId)
    if (leagueResponse.success && leagueResponse.data) {
      const data = leagueResponse.data as { userMembership?: { role: string } }
      setIsLeagueAdmin(data.userMembership?.role === 'ADMIN')
    }

    // Load my affected players
    const myResult = await indemnityApi.getMyAffectedPlayers(leagueId)
    if (myResult.success && myResult.data) {
      const data = myResult.data as {
        inCalcoloIndennizziPhase: boolean
        hasSubmittedDecisions: boolean
        submittedAt: string | null
        currentBudget: number
        indennizzoEstero: number
        affectedPlayers: AffectedPlayer[]
      }
      setInCalcoloPhase(data.inCalcoloIndennizziPhase)
      setHasSubmitted(data.hasSubmittedDecisions)
      setSubmittedAt(data.submittedAt)
      setCurrentBudget(data.currentBudget)
      setIndennizzoEstero(data.indennizzoEstero || 50)
      setAffectedPlayers(data.affectedPlayers)

      // Initialize decisions with KEEP for all players (except RITIRATO which is auto)
      const initialDecisions: Record<string, Decision> = {}
      for (const p of data.affectedPlayers) {
        if (p.exitReason !== 'RITIRATO') {
          initialDecisions[p.roster.id] = 'KEEP'
        }
      }
      setDecisions(initialDecisions)
    }

    // If admin, load all statuses
    if (isLeagueAdmin) {
      await loadAdminStatus()
    }

    setIsLoading(false)
  }

  async function loadAdminStatus() {
    const result = await indemnityApi.getAllDecisionsStatus(leagueId)
    if (result.success && result.data) {
      const data = result.data as {
        inCalcoloIndennizziPhase: boolean
        managers: DecisionStatus[]
        allDecided: boolean
      }
      setDecisionStatuses(data.managers)
      setAllDecided(data.allDecided)
    }
  }

  function handleDecisionChange(rosterId: string, decision: Decision) {
    setDecisions(prev => ({
      ...prev,
      [rosterId]: decision
    }))
  }

  async function handleSubmitDecisions() {
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    const decisionArray = Object.entries(decisions).map(([rosterId, decision]) => ({
      rosterId,
      decision
    }))

    const result = await indemnityApi.submitDecisions(leagueId, decisionArray)

    if (result.success) {
      setSuccess(result.message || 'Decisioni inviate con successo!')
      setHasSubmitted(true)
      setSubmittedAt(new Date().toISOString())
      // Refresh data
      loadData()
    } else {
      setError(result.message || 'Errore durante l\'invio delle decisioni')
    }

    setIsSubmitting(false)
  }

  // Calculate compensation for ESTERO release
  function calculateCompensation(player: AffectedPlayer): number {
    if (player.exitReason !== 'ESTERO') return 0
    return Math.min(player.contract.rescissionClause, indennizzoEstero)
  }

  // Players that need manager decision (not RITIRATO)
  const playersNeedingDecision = affectedPlayers.filter(p => p.exitReason !== 'RITIRATO')
  const ritiratiPlayers = affectedPlayers.filter(p => p.exitReason === 'RITIRATO')

  // Calculate total compensation if all ESTERO players are released
  const totalPotentialCompensation = playersNeedingDecision
    .filter(p => p.exitReason === 'ESTERO' && decisions[p.roster.id] === 'RELEASE')
    .reduce((sum, p) => sum + calculateCompensation(p), 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento indennizzi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-100">
      <Navigation currentPage="indemnity" leagueId={leagueId} onNavigate={onNavigate} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2">Calcolo Indennizzi</h1>
          <p className="text-gray-400">
            Gestisci i giocatori che sono usciti dalla lista quotazioni
          </p>
        </div>

        {/* Phase Status */}
        {!inCalcoloPhase && (
          <Card className="p-6 mb-6 bg-surface-300/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-500/20 flex items-center justify-center">
                <span className="text-2xl">⏸️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Fase non attiva</h3>
                <p className="text-gray-400">
                  La fase CALCOLO_INDENNIZZI non e' attualmente attiva.
                  {isLeagueAdmin && ' Come admin, puoi attivarla dal pannello mercato.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Already Submitted */}
        {hasSubmitted && (
          <Card className="p-6 mb-6 bg-secondary-500/10 border border-secondary-500/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary-500/20 flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-secondary-400">Decisioni inviate</h3>
                <p className="text-gray-400">
                  Hai gia' inviato le tue decisioni
                  {submittedAt && ` il ${new Date(submittedAt).toLocaleString('it-IT')}`}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-danger-500/20 border border-danger-500/50 rounded-lg text-danger-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-secondary-500/20 border border-secondary-500/50 rounded-lg text-secondary-400">
            {success}
          </div>
        )}

        {/* Admin Status Panel */}
        {isLeagueAdmin && inCalcoloPhase && decisionStatuses.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>📊</span> Stato Decisioni Manager
            </h2>
            <div className="grid gap-3">
              {decisionStatuses.map(status => (
                <div
                  key={status.memberId}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    status.hasDecided
                      ? 'bg-secondary-500/10 border border-secondary-500/30'
                      : 'bg-surface-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status.hasDecided ? 'bg-secondary-500/20 text-secondary-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {status.hasDecided ? '✓' : '⏳'}
                    </span>
                    <div>
                      <p className="font-medium text-white">{status.teamName || status.username}</p>
                      <p className="text-xs text-gray-400">{status.affectedCount} giocatori interessati</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {status.hasDecided ? (
                      <span className="text-secondary-400">
                        Completato {status.decidedAt && new Date(status.decidedAt).toLocaleTimeString('it-IT')}
                      </span>
                    ) : (
                      <span className="text-amber-400">In attesa</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {allDecided && (
              <div className="mt-4 p-3 bg-secondary-500/20 rounded-lg text-center">
                <p className="text-secondary-400 font-medium">
                  ✅ Tutti i manager hanno inviato le decisioni. Puoi procedere alla fase successiva.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* No Affected Players */}
        {affectedPlayers.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-white mb-2">Nessun giocatore interessato</h3>
            <p className="text-gray-400">
              Non hai giocatori nella tua rosa che siano usciti dalla lista quotazioni.
            </p>
          </Card>
        )}

        {/* RITIRATO Players (automatic release) */}
        {ritiratiPlayers.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>{EXIT_REASON_CONFIG.RITIRATO.icon}</span> Giocatori Ritirati
              <span className="text-sm font-normal text-gray-400">(rilasciati automaticamente)</span>
            </h2>
            <div className="space-y-3">
              {ritiratiPlayers.map(player => (
                <div key={player.playerId} className="bg-surface-300 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-full ${
                        POSITION_COLORS[player.position] || 'bg-gray-500'
                      } flex items-center justify-center text-white font-bold text-sm`}>
                        {player.position}
                      </span>
                      <div className="flex items-center gap-2">
                        <TeamLogo team={player.team} />
                        <div>
                          <p className="font-medium text-white">{player.playerName}</p>
                          <p className="text-xs text-gray-400">{player.team}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Contratto</p>
                        <p className="text-sm text-gray-400">
                          {player.contract.salary}M x {player.contract.duration} sem
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${EXIT_REASON_CONFIG.RITIRATO.color}`}>
                        Rilasciato
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Players Needing Decision */}
        {playersNeedingDecision.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Le Tue Decisioni</h2>

            {/* Legend */}
            <div className="bg-surface-300 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Legenda</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${EXIT_REASON_CONFIG.RETROCESSO.color}`}>
                    {EXIT_REASON_CONFIG.RETROCESSO.icon} RETROCESSO
                  </span>
                  <p className="text-xs text-gray-400">{EXIT_REASON_CONFIG.RETROCESSO.description}</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${EXIT_REASON_CONFIG.ESTERO.color}`}>
                    {EXIT_REASON_CONFIG.ESTERO.icon} ESTERO
                  </span>
                  <p className="text-xs text-gray-400">{EXIT_REASON_CONFIG.ESTERO.description}</p>
                </div>
              </div>
            </div>

            {/* Players */}
            <div className="space-y-4">
              {playersNeedingDecision.map(player => {
                const config = EXIT_REASON_CONFIG[player.exitReason]
                const compensation = calculateCompensation(player)
                const currentDecision = decisions[player.roster.id]

                return (
                  <div key={player.playerId} className="bg-surface-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-12 h-12 rounded-full ${
                          POSITION_COLORS[player.position] || 'bg-gray-500'
                        } flex items-center justify-center text-white font-bold`}>
                          {player.position}
                        </span>
                        <div className="flex items-center gap-2">
                          <TeamLogo team={player.team} />
                          <div>
                            <p className="font-medium text-white text-lg">{player.playerName}</p>
                            <p className="text-sm text-gray-400">{player.team}</p>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>

                    {/* Contract Info */}
                    <div className="grid grid-cols-4 gap-4 mb-4 bg-surface-200 rounded-lg p-3">
                      <div>
                        <p className="text-xs text-gray-500">Ingaggio</p>
                        <p className="font-mono text-accent-400">{player.contract.salary}M</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Durata</p>
                        <p className="font-mono text-white">{player.contract.duration} sem</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Clausola</p>
                        <p className="font-mono text-primary-400">{player.contract.rescissionClause}M</p>
                      </div>
                      {player.exitReason === 'ESTERO' && (
                        <div>
                          <p className="text-xs text-gray-500">Compenso Rilascio</p>
                          <p className="font-mono text-secondary-400">{compensation}M</p>
                        </div>
                      )}
                    </div>

                    {/* Decision Buttons */}
                    {!hasSubmitted && inCalcoloPhase && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => { handleDecisionChange(player.roster.id, 'KEEP'); }}
                          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            currentDecision === 'KEEP'
                              ? 'bg-primary-500 text-white'
                              : 'bg-surface-200 text-gray-400 hover:bg-surface-50/20'
                          }`}
                        >
                          🏠 {config.keepLabel}
                        </button>
                        <button
                          onClick={() => { handleDecisionChange(player.roster.id, 'RELEASE'); }}
                          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                            currentDecision === 'RELEASE'
                              ? 'bg-danger-500 text-white'
                              : 'bg-surface-200 text-gray-400 hover:bg-surface-50/20'
                          }`}
                        >
                          🚪 {config.releaseLabel}
                          {player.exitReason === 'ESTERO' && (
                            <span className="ml-2 text-secondary-400">+{compensation}M</span>
                          )}
                        </button>
                      </div>
                    )}

                    {hasSubmitted && (
                      <div className="text-center text-gray-400 py-2">
                        Decisione inviata
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Summary and Submit */}
        {playersNeedingDecision.length > 0 && !hasSubmitted && inCalcoloPhase && (
          <Card className="p-6 bg-gradient-to-r from-surface-300 to-surface-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Riepilogo</h3>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-400">
                    Budget attuale: <span className="text-accent-400 font-mono">{currentBudget}M</span>
                  </span>
                  {totalPotentialCompensation > 0 && (
                    <span className="text-gray-400">
                      Compenso da rilasci: <span className="text-secondary-400 font-mono">+{totalPotentialCompensation}M</span>
                    </span>
                  )}
                </div>
              </div>
              <Button
                onClick={handleSubmitDecisions}
                disabled={isSubmitting || playersNeedingDecision.length === 0}
                className="btn-primary"
              >
                {isSubmitting ? 'Invio in corso...' : 'Conferma Decisioni'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
