import { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody } from './ui/Modal'
import { POSITION_GRADIENTS } from './ui/PositionBadge'
import { ContractInline } from './ui/ContractInline'
import { getPlayerPhotoUrl, getTeamLogoUrl } from '../utils/player-images'
import { historyApi } from '../services/api'
import { NOT_DISPONIBILE, getAgeColor } from '../utils/stat-format'
import type { PlayerCareer } from './history/PlayerCareerPanel'

// Italian labels for player movement types (shared with PlayerCareerPanel data shape)
const MOVEMENT_LABELS: Record<string, string> = {
  FIRST_MARKET: 'Primo Mercato',
  TRADE: 'Scambio',
  RUBATA: 'Rubata',
  SVINCOLATI: 'Svincolati',
  CONTRACT_RENEW: 'Rinnovo',
  RETIREMENT: 'Ritiro',
  RELEGATION_RELEASE: 'Retrocesso (Rilascio)',
  RELEGATION_KEEP: 'Retrocesso (Mantenuto)',
  ABROAD_COMPENSATION: 'Estero (Compenso)',
  ABROAD_KEEP: 'Estero (Mantenuto)',
}

// RELEASE copre due casi distinti, distinguibili dal prezzo: taglio volontario
// (costo di taglio > 0, minimo 1) vs fine contratto/scadenza (costo 0).
function getMovementLabel(type: string, price: number | null | undefined): string {
  if (type === 'RELEASE') {
    return price != null && price > 0 ? 'Taglio' : 'Fine contratto'
  }
  return MOVEMENT_LABELS[type] || type
}

function formatCareerDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const API_URL = String(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3003'))

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

/**
 * Axioms 6 + 9: current contract snapshot (ingaggio/durata/clausola), shown
 * prominently in the modal with explicit labels via ContractInline. Rubata
 * price (clausola + ingaggio) is derived at render time, not stored here.
 */
export interface PlayerContractInfo {
  /** Ingaggio (salary) in crediti. */
  salary: number
  /** Durata contratto in semestri. */
  duration: number
  /** Clausola rescissoria in crediti. Null/undefined se non applicabile. */
  clause?: number | null
}

/** Etichette italiane per PlayerExitReason (prisma/schemas/_base.prisma). */
export const EXIT_REASON_LABELS: Record<string, string> = {
  RITIRATO: 'Ritirato',
  RETROCESSO: 'Retrocesso',
  ESTERO: 'Estero',
}

type ExitAware = { listStatus?: string; exitReason?: string | null }

/**
 * True se il giocatore non è più in nessuna squadra di Serie A. Va SEMPRE
 * verificato tramite listStatus, non tramite la sola presenza di exitReason:
 * un giocatore può risultare NOT_IN_LIST prima che l'admin/il sistema
 * categorizzi il motivo specifico (visto in dati reali locali).
 */
export function isOutOfSerieA(player: ExitAware): boolean {
  return player.listStatus === 'NOT_IN_LIST'
}

/** Etichetta del motivo di uscita, o null se non ancora categorizzato. */
export function getExitReasonLabel(player: ExitAware): string | null {
  if (!player.exitReason) return null
  return EXIT_REASON_LABELS[player.exitReason] ?? player.exitReason
}

export interface PlayerInfo {
  name: string
  /**
   * Squadra Serie A del giocatore. Se `exitReason` è valorizzato il giocatore
   * NON è più in nessuna squadra di Serie A: questo campo resta l'ULTIMA
   * squadra nota (aggiornata solo al re-import quotazioni, quindi può restare
   * stantia dopo un trasferimento realmente avvenuto) — chi lo mostra deve
   * sempre affiancarlo all'indicatore di uscita, non trattarlo come squadra
   * attuale.
   */
  team: string
  position: string
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
  computedStats?: ComputedSeasonStats | null
  statsSyncedAt?: string | null
  /** League SerieAPlayer id — enables the "Carriera Lega" tab when paired with leagueId */
  leaguePlayerId?: string
  /**
   * Current contract (ingaggio/durata/clausola), when known by the caller.
   * Optional — some contexts (free agents, players without a signed
   * contract yet) legitimately have none: the section is simply hidden.
   */
  contract?: PlayerContractInfo | null
  /** PlayerListStatus — 'NOT_IN_LIST' se il giocatore non è più in Serie A. */
  listStatus?: string
  /** Motivo di uscita dalla Serie A (RITIRATO/RETROCESSO/ESTERO), se noto. */
  exitReason?: string | null
}

interface PlayerStatsModalProps {
  isOpen: boolean
  onClose: () => void
  player: PlayerInfo | null
  /** League id — enables the "Carriera Lega" tab (together with the player's league id) */
  leagueId?: string
  /** League SerieAPlayer id — overrides player.leaguePlayerId if provided */
  leaguePlayerId?: string
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

export function PlayerStatsModal({ isOpen, onClose, player, leagueId, leaguePlayerId }: PlayerStatsModalProps) {
  const [activeTab, setActiveTab] = useState<'panoramica' | 'storico' | 'carriera'>('panoramica')
  const [matchHistory, setMatchHistory] = useState<MatchRating[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Carriera Lega tab
  const effectiveLeaguePlayerId = leaguePlayerId ?? player?.leaguePlayerId
  const careerEnabled = !!(leagueId && effectiveLeaguePlayerId)
  const [career, setCareer] = useState<PlayerCareer | null>(null)
  const [careerLoading, setCareerLoading] = useState(false)
  const [careerError, setCareerError] = useState<string | null>(null)

  // Reset tab when player changes
  useEffect(() => { setActiveTab('panoramica') }, [player?.name])

  // Reset career data when target player/league changes
  useEffect(() => {
    setCareer(null)
    setCareerError(null)
  }, [leagueId, effectiveLeaguePlayerId])

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

  // Fetch league career as soon as the modal has enough context — not gated by the
  // "carriera" tab, since the current league team is shown always-visible (see below),
  // not just inside that tab.
  useEffect(() => {
    if (!leagueId || !effectiveLeaguePlayerId || career) return
    setCareerLoading(true)
    setCareerError(null)
    historyApi.getPlayerCareer(leagueId, effectiveLeaguePlayerId)
      .then(result => {
        if (result.success && result.data) {
          setCareer(result.data as PlayerCareer)
        } else {
          setCareerError(result.message || 'Errore nel caricamento della carriera')
        }
      })
      .catch(() => { setCareerError('Errore di connessione'); })
      .finally(() => { setCareerLoading(false); })
  }, [leagueId, effectiveLeaguePlayerId, career])

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
  const exitLabel = getExitReasonLabel(player)

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
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[player.position] ?? ''} flex items-center justify-center text-white font-bold text-xl`}
              >
                {player.position}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${POSITION_GRADIENTS[player.position] ?? ''} flex items-center justify-center text-white font-bold text-xs border-2 border-surface-200`}
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
              {isOutOfSerieA(player) ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-warning-500/15 text-warning-400 font-medium">
                  <span aria-hidden="true">⊘</span>
                  Fuori Serie A{exitLabel ? ` · ${exitLabel}` : ''}
                </span>
              ) : (
                <>
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
                </>
              )}
              <span className={`ml-2 ${getAgeColor(player.age)}`}>
                • {player.age != null ? `${player.age} anni` : NOT_DISPONIBILE}
              </span>
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
        {/* Squadra in lega + contratto: sempre visibili sopra le tab, non solo dentro
            "Carriera Lega" — la squadra attuale della lega è tra le info più importanti
            del giocatore (Assioma 6) e non deve richiedere un click per essere vista. */}
        {(careerEnabled || player.contract) && (
          <div className="mb-4 bg-surface-100/50 rounded-xl p-4 space-y-3">
            {careerEnabled && (
              <div>
                <div className="micro-label text-gray-500 mb-1">Squadra in Lega</div>
                <div className="font-display font-bold text-white">
                  {career ? (
                    career.currentOwner
                      ? (career.currentOwner.teamName || career.currentOwner.username)
                      : 'Svincolato'
                  ) : careerError ? (
                    <span className="text-danger-400 font-normal text-sm">{careerError}</span>
                  ) : (
                    <span className="text-gray-500 font-normal">Caricamento…</span>
                  )}
                </div>
              </div>
            )}
            {player.contract && (
              <div className={careerEnabled ? 'pt-3 border-t border-surface-50/10' : ''}>
                <div className="micro-label text-gray-500 mb-2">Contratto</div>
                <ContractInline
                  salary={player.contract.salary}
                  duration={player.contract.duration}
                  clause={player.contract.clause}
                  rubataPrice={player.contract.clause != null ? player.contract.clause + player.contract.salary : null}
                  variant="full"
                  className="text-base"
                />
              </div>
            )}
          </div>
        )}

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
          {careerEnabled && (
            <button
              onClick={() => { setActiveTab('carriera'); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'carriera' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Carriera Lega
            </button>
          )}
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

        {/* Carriera Lega tab */}
        {activeTab === 'carriera' && (
          careerLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-9 h-9 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : careerError ? (
            <div className="text-center py-8 text-danger-400">{careerError}</div>
          ) : !career || career.timeline.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">Mai posseduto in questa lega</div>
              <div className="text-sm text-gray-500">
                Nessun passaggio registrato per questo giocatore
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Movements table. "Proprietario attuale" e' gia' sempre visibile sopra le
                  tab (vedi "Squadra in Lega"), e le squadre passate si leggono gia' dalle
                  colonne Da/A qui sotto — niente riepiloghi duplicati. */}
              <div className="bg-surface-100/50 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1.4fr_1.4fr_1fr_auto] gap-2 px-3 py-2 border-b border-surface-50/20">
                  <span className="micro-label text-gray-500 text-center">Da</span>
                  <span className="micro-label text-gray-500 text-center">A</span>
                  <span className="micro-label text-gray-500 text-center">Movimento</span>
                  <span className="micro-label text-gray-500 text-right">Prezzo</span>
                </div>
                <div className="divide-y divide-surface-50/10">
                  {career.timeline.map(event => (
                    <div
                      key={event.id}
                      className="grid grid-cols-[1.4fr_1.4fr_1fr_auto] gap-2 px-3 py-2.5 items-center text-sm hover:bg-surface-300/40"
                    >
                      <span className="text-gray-300 truncate text-center">
                        {event.from ? (event.from.teamName || event.from.username) : '—'}
                      </span>
                      <span className="text-white truncate text-center">
                        {event.to ? (event.to.teamName || event.to.username) : '—'}
                      </span>
                      <span className="text-gray-400 min-w-0 text-center">
                        <span className="block truncate">
                          {getMovementLabel(event.type, event.price)}
                        </span>
                        <span className="block text-[10px] text-gray-500">
                          {formatCareerDate(event.date)}
                        </span>
                      </span>
                      <span className="text-right font-mono font-semibold text-primary-400">
                        {event.price != null && event.price > 0 ? `${event.price}M` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
