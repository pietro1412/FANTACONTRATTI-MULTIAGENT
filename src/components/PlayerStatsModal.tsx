import { Modal, ModalHeader, ModalBody } from './ui/Modal'
import { getPlayerPhotoUrl, getTeamLogoUrl } from '../utils/player-images'

// Position colors
const POSITION_COLORS: Record<string, string> = {
  P: 'from-yellow-500 to-yellow-600',
  D: 'from-green-500 to-green-600',
  C: 'from-blue-500 to-blue-600',
  A: 'from-red-500 to-red-600',
}

// Stats structure from API-Football
export interface PlayerStats {
  games: {
    appearences: number | null
    minutes: number | null
    rating: number | null
  }
  goals: {
    total: number | null
    assists: number | null
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
  }
}

export interface PlayerInfo {
  name: string
  team: string
  position: string
  quotation?: number
  apiFootballId?: number | null
  apiFootballStats?: PlayerStats | null
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

export function PlayerStatsModal({ isOpen, onClose, player }: PlayerStatsModalProps) {
  if (!player) return null

  const stats = player.apiFootballStats as PlayerStats | null

  const positionLabels: Record<string, string> = {
    P: 'Portiere',
    D: 'Difensore',
    C: 'Centrocampista',
    A: 'Attaccante',
  }

  const playerPhotoUrl = getPlayerPhotoUrl(player.apiFootballId)
  const teamLogoUrl = getTeamLogoUrl(player.team)

  // Debug: log player data to verify apiFootballId is present
  console.log('PlayerStatsModal player:', player.name, 'apiFootballId:', player.apiFootballId, 'photoUrl:', playerPhotoUrl)

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
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xl`}
              >
                {player.position}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_COLORS[player.position]} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
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
        {!stats ? (
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
              <StatRow label="Presenze" value={stats.games.appearences} />
              <StatRow label="Minuti" value={stats.games.minutes} />
              <StatRow label="Rating Medio" value={stats.games.rating != null ? Number(Number(stats.games.rating).toFixed(2)) : null} />
            </StatSection>

            {/* Attacco */}
            <StatSection title="Attacco">
              <StatRow label="Gol" value={stats.goals.total} />
              <StatRow label="Assist" value={stats.goals.assists} />
              <StatRow label="Tiri Totali" value={stats.shots.total} />
              <StatRow label="Tiri in Porta" value={stats.shots.on} />
            </StatSection>

            {/* Passaggi */}
            <StatSection title="Passaggi">
              <StatRow label="Totali" value={stats.passes.total} />
              <StatRow label="Key Passes" value={stats.passes.key} />
              <StatRow label="Precisione" value={stats.passes.accuracy} suffix="%" />
            </StatSection>

            {/* Difesa */}
            <StatSection title="Difesa">
              <StatRow label="Tackles" value={stats.tackles.total} />
              <StatRow label="Intercetti" value={stats.tackles.interceptions} />
            </StatSection>

            {/* Dribbling */}
            <StatSection title="Dribbling">
              <StatRow label="Tentati" value={stats.dribbles.attempts} />
              <StatRow label="Riusciti" value={stats.dribbles.success} />
              {stats.dribbles.attempts && stats.dribbles.success && (
                <StatRow
                  label="Percentuale"
                  value={Math.round((stats.dribbles.success / stats.dribbles.attempts) * 100)}
                  suffix="%"
                />
              )}
            </StatSection>

            {/* Disciplina */}
            <StatSection title="Disciplina">
              <StatRow label="Cartellini Gialli" value={stats.cards.yellow} />
              <StatRow label="Cartellini Rossi" value={stats.cards.red} />
            </StatSection>

            {/* Rigori */}
            <StatSection title="Rigori">
              <StatRow label="Segnati" value={stats.penalty.scored} />
              <StatRow label="Sbagliati" value={stats.penalty.missed} />
            </StatSection>
          </div>
        )}

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
