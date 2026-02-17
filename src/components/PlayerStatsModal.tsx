import { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody } from './ui/Modal'
import { POSITION_GRADIENTS } from './ui/PositionBadge'
import { getPlayerPhotoUrl, getTeamLogoUrl } from '../utils/player-images'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003')

// Age color function - younger is better
function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400 font-bold'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

// Legacy stats structure from API-Football (kept for backward compatibility)
export interface PlayerStats {
  games: {
    appearences: number | null
    minutes: number | null
    rating: number | null
  }
  goals: {
    total: number | null
    assists: number | null
    conceded: number | null
    saves: number | null
  }
  shots: {
    total: number | null
    on: number | null
  }
  passes: {
    total: number | null
    key: number | null
    accuracy: number | null
  }
  tackles: {
    total: number | null
    interceptions: number | null
  }
  dribbles: {
    attempts: number | null
    success: number | null
  }
  cards: {
    yellow: number | null
    red: number | null
  }
  penalty: {
    scored: number | null
    missed: number | null
    saved: number | null
  }
}

// Computed stats from PlayerMatchRating (accurate data source)
export interface ComputedSeasonStats {
  season: string
  appearances: number
  totalMinutes: number
  avgRating: number | null
  totalGoals: number
  totalAssists: number
  startingXI: number
  matchesInSquad: number
}

export interface PlayerInfo {
  name: string
  team: string
  position: string
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
  statsSyncedAt?: string | null
}

interface PlayerStatsModalProps {
  isOpen: boolean
  onClose: () => void
  player: PlayerInfo | null
}

function StatValue({ value, suffix = '' }: { value: number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) return <span className="text-gray-500">-</span>
  return <span className="text-white font-semibold">{value}{suffix}</span>
}

function StatRow({ label, value, suffix = '' }: { label: string; value: number | null | undefined; suffix?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-surface-50/10 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <StatValue value={value} suffix={suffix} />
    </div>
  )
}

function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-100/50 rounded-lg p-4">
      <h3 className="text-primary-400 font-semibold text-sm uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

interface MatchRating {
  matchDate: string
  round: string | null
  rating: number | null
  minutesPlayed: number | null
  goals: number | null
  assists: number | null
}

export function PlayerStatsModal({ isOpen, onClose, player }: PlayerStatsModalProps) {
  const [activeTab, setActiveTab] = useState<'panoramica' | 'storico'>('panoramica')
  const [matchHistory, setMatchHistory] = useState<MatchRating[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Reset tab when player changes
  useEffect(() => { setActiveTab('panoramica') }, [player?.name])

  // T-025: Fetch match history when storico tab is selected
  useEffect(() => {
    if (activeTab !== 'storico' || !player?.apiFootballId) return
    setHistoryLoading(true)
    fetch(`${API_URL}/api/players/${player.apiFootballId}/match-history`)
      .then(res => res.ok ? res.json() : { data: [] })
      .then(data => { setMatchHistory(data.data || []); })
      .catch(() => { setMatchHistory([]); })
      .finally(() => { setHistoryLoading(false); })
  }, [activeTab, player?.apiFootballId])

  if (!player) return null

  const stats = player.computedStats

  const positionLabels: Record<string, string> = {
    P: 'Portiere',
    D: 'Difensore',
    C: 'Centrocampista',
    A: 'Attaccante',
  }

  const playerPhotoUrl = getPlayerPhotoUrl(player.apiFootballId)
  const teamLogoUrl = getTeamLogoUrl(player.team)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader>
        <div className="flex items-center gap-4">
          {/* Player photo with position badge */}
          <div className="relative flex-shrink-0">
            {playerPhotoUrl ? (
              <img
                src={playerPhotoUrl}
                alt={player.name}
                className="w-16 h-16 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[player.position]} flex items-center justify-center text-white font-bold text-xl`}
              >
                {player.position}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[player.position]} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
            >
              {player.position}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{player.name}</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-500/20 text-primary-400">
                {positionLabels[player.position] || player.position}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
              {teamLogoUrl && (
                <img
                  src={teamLogoUrl}
                  alt={player.team}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              )}
              {player.team}
              {player.age != null && (
                <span className={`ml-2 ${getAgeColor(player.age)}`}>• {player.age} anni</span>
              )}
              {player.quotation && (
                <span className="ml-2 px-2 py-0.5 rounded bg-primary-500/20 text-primary-400 font-medium">
                  {player.quotation}M
                </span>
              )}
            </div>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[70vh]">
        {/* T-025: Tab bar */}
        <div className="flex gap-1 mb-4 bg-surface-300/50 rounded-lg p-1">
          <button
            onClick={() => { setActiveTab('panoramica'); }}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'panoramica' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Panoramica
          </button>
          <button
            onClick={() => { setActiveTab('storico'); }}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'storico' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Storico Partite
          </button>
        </div>

        {/* Storico tab */}
        {activeTab === 'storico' && (
          historyLoading ? (
            <div className="text-center py-8 text-gray-400">Caricamento...</div>
          ) : matchHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">Storico partite non disponibile</div>
              <div className="text-sm text-gray-500">
                {!player.apiFootballId
                  ? 'Giocatore non associato ad API-Football'
                  : 'Nessun dato match-by-match disponibile'}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-6 gap-2 text-[10px] text-gray-500 uppercase tracking-wider px-2 pb-1 border-b border-surface-50/20">
                <span className="col-span-2">Giornata</span>
                <span className="text-center">Min</span>
                <span className="text-center">Rating</span>
                <span className="text-center">Gol</span>
                <span className="text-center">Assist</span>
              </div>
              {matchHistory.map((m, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 text-sm px-2 py-1.5 rounded hover:bg-surface-300/50">
                  <span className="col-span-2 text-gray-300 truncate text-xs">
                    {m.round?.replace('Regular Season - ', 'G') || new Date(m.matchDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-center text-gray-400">{m.minutesPlayed ?? '-'}</span>
                  <span className={`text-center font-medium ${
                    m.rating && m.rating >= 7 ? 'text-secondary-400' :
                    m.rating && m.rating >= 6 ? 'text-white' : 'text-danger-400'
                  }`}>{m.rating?.toFixed(1) ?? '-'}</span>
                  <span className="text-center text-white">{m.goals || '-'}</span>
                  <span className="text-center text-white">{m.assists || '-'}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Panoramica tab */}
        {activeTab === 'panoramica' && (!stats || stats.appearances === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">Statistiche non disponibili</div>
            <div className="text-sm text-gray-500">
              {!player.apiFootballId ? (
                'Giocatore non ancora associato ad API-Football'
              ) : (
                'Nessuna statistica Serie A disponibile per questo giocatore nella stagione corrente'
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Generali */}
            <StatSection title="Generali">
              <StatRow label="Presenze" value={stats.appearances} />
              <StatRow label="Minuti Totali" value={stats.totalMinutes} />
              <StatRow label="Rating Medio" value={stats.avgRating != null ? Number(stats.avgRating.toFixed(2)) : null} />
              <StatRow label="Titolarita'" value={stats.startingXI} />
            </StatSection>

            {/* Rendimento */}
            <StatSection title="Rendimento">
              <StatRow label="Gol" value={stats.totalGoals} />
              <StatRow label="Assist" value={stats.totalAssists} />
              <StatRow label="Convocazioni" value={stats.matchesInSquad} />
              {stats.appearances > 0 && (
                <StatRow
                  label="Media Minuti/Partita"
                  value={Math.round(stats.totalMinutes / stats.appearances)}
                />
              )}
            </StatSection>

            {/* Statistiche Calcolate */}
            <StatSection title="Efficienza">
              {stats.totalGoals > 0 && stats.totalMinutes > 0 && (
                <StatRow
                  label="Minuti per Gol"
                  value={Math.round(stats.totalMinutes / stats.totalGoals)}
                />
              )}
              {stats.totalAssists > 0 && stats.totalMinutes > 0 && (
                <StatRow
                  label="Minuti per Assist"
                  value={Math.round(stats.totalMinutes / stats.totalAssists)}
                />
              )}
              {(stats.totalGoals > 0 || stats.totalAssists > 0) && stats.totalMinutes > 0 && (
                <StatRow
                  label="Minuti per G+A"
                  value={Math.round(stats.totalMinutes / (stats.totalGoals + stats.totalAssists))}
                />
              )}
              {stats.appearances > 0 && (
                <StatRow
                  label="% Titolarita'"
                  value={Math.round((stats.startingXI / stats.appearances) * 100)}
                  suffix="%"
                />
              )}
            </StatSection>

            {/* Info Stagione */}
            <StatSection title="Stagione">
              <StatRow label="Stagione" value={null} />
              <div className="flex justify-between items-center py-1.5 border-b border-surface-50/10 last:border-0">
                <span className="text-gray-400 text-sm">Stagione</span>
                <span className="text-white font-semibold">{stats.season}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Dati calcolati da {stats.matchesInSquad} partite monitorate
              </div>
            </StatSection>
          </div>
        ))}

        {player.statsSyncedAt && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Ultimo aggiornamento: {new Date(player.statsSyncedAt).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}

export default PlayerStatsModal
