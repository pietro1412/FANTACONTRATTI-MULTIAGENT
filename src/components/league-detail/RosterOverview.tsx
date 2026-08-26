import { Monogram } from '@/components/ui/Monogram'
import { RoleTag } from '@/components/league/attention'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatStat, NOT_DISPONIBILE } from '@/utils/stat-format'
import { computeBilancio } from '@/utils/finance'

export interface RosterMemberData {
  memberId: string
  username: string
  teamName: string | null
  role: string
  budget: number
  /** Monte ingaggi fissato all'ultimo consolidamento (LeagueMember.totalSalaries) — non live. */
  totalSalaries: number
  playerCount: number
  players: Array<{ position: string; age?: number | null; contract?: { salary: number } | null }>
}

interface RosterOverviewProps {
  rosters: RosterMemberData[]
  myMemberId: string | null
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

const POSITIONS = ['P', 'D', 'C', 'A'] as const
type Position = (typeof POSITIONS)[number]

/** Colore per reparto, coerente con i badge ruolo già in uso in piattaforma. */
const POS_TEXT_COLOR: Record<Position, string> = {
  P: 'text-accent-400',
  D: 'text-primary-400',
  C: 'text-secondary-400',
  A: 'text-danger-400',
}

function computeAvailableBudget(member: RosterMemberData): number {
  return computeBilancio(member.budget, member.totalSalaries)
}

/** Solo conteggio: dopo il 1° Mercato non esistono più limiti di slot per ruolo. */
function countByPosition(players: RosterMemberData['players']): Record<(typeof POSITIONS)[number], number> {
  const counts = { P: 0, D: 0, C: 0, A: 0 }
  for (const p of players) {
    if (p.position === 'P' || p.position === 'D' || p.position === 'C' || p.position === 'A') counts[p.position]++
  }
  return counts
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function averageAge(players: RosterMemberData['players']): number | null {
  return average(players.map(p => p.age).filter((a): a is number => a != null))
}

function averageAgeByPosition(players: RosterMemberData['players']): Record<(typeof POSITIONS)[number], number | null> {
  const result = {} as Record<(typeof POSITIONS)[number], number | null>
  for (const pos of POSITIONS) {
    result[pos] = average(players.filter(p => p.position === pos).map(p => p.age).filter((a): a is number => a != null))
  }
  return result
}

function formatAge(age: number | null): string {
  return formatStat(age, { decimals: 1, fallback: NOT_DISPONIBILE })
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="micro-label text-gray-500">{label}</p>
      <p className={`font-mono text-sm mt-0.5 ${tone ?? 'text-gray-200'}`}>{value}</p>
    </div>
  )
}

/**
 * Età media e conteggio giocatori per reparto, come due gruppi di colonne distinti
 * (mockup A — "Colonne separate", scelto da Pietro il 2026-08-26): ogni cella mostra
 * un solo valore, niente numeri impilati/ambigui. Riusato da "La mia rosa" e dalle
 * card avversari mobile (stessa logica, il desktop usa una tabella vera).
 */
function CompositionGroups({ ages, counts }: { ages: Record<Position, number | null>; counts: Record<Position, number> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="micro-label text-gray-500 mb-2">Età media per reparto</p>
        <div className="grid grid-cols-4 gap-1.5">
          {POSITIONS.map(pos => (
            <div key={pos} className="text-center bg-surface-50/5 rounded-lg py-1.5">
              <p className={`micro-label ${POS_TEXT_COLOR[pos]}`}>{pos}</p>
              <p className="font-mono text-sm text-gray-100 mt-0.5">{formatAge(ages[pos])}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="micro-label text-gray-500 mb-2">N. giocatori per reparto</p>
        <div className="grid grid-cols-4 gap-1.5">
          {POSITIONS.map(pos => (
            <div key={pos} className="text-center bg-surface-50/5 rounded-lg py-1.5">
              <p className={`micro-label ${POS_TEXT_COLOR[pos]}`}>{pos}</p>
              <p className="font-mono text-sm text-gray-100 mt-0.5">{counts[pos]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Colonne condivise fra header e righe della tabella avversari (desktop): 2 gruppi da 4 (età + conteggio). */
const OPPONENTS_TABLE_GRID = 'grid-cols-[minmax(160px,1.6fr)_70px_40px_40px_40px_40px_40px_40px_40px_40px_100px_20px]'
const OPPONENTS_TABLE_MIN_WIDTH = 'min-w-[900px]'

/**
 * "La mia rosa" + "Rose degli avversari": budget e composizione per ruolo di
 * ogni manager, ogni rosa cliccabile → pagina Rose con quel manager selezionato.
 * Niente classifica bilanci/movimenti/KPI di lega qui: vivono già nelle loro
 * pagine dedicate (Finanze, Storico) — non duplicati (mockup 28-dashboard-lega/E).
 */
export function RosterOverview({ rosters, myMemberId, leagueId, onNavigate }: RosterOverviewProps) {
  if (rosters.length === 0) {
    return <EmptyState compact icon="👥" title="Nessuna rosa disponibile" />
  }

  const mine = rosters.find(r => r.memberId === myMemberId) ?? null
  const others = rosters.filter(r => r.memberId !== myMemberId)
  const minePosAges = mine ? averageAgeByPosition(mine.players) : null
  const minePosCounts = mine ? countByPosition(mine.players) : null

  return (
    <div className="space-y-6">
      {mine && (
        <div>
          <span className="micro-label text-gray-400">La mia rosa</span>
          <button
            onClick={() => { onNavigate('rose', { leagueId }); }}
            className="mt-2 w-full text-left bg-surface-200 border border-secondary-500/35 rounded-xl p-4 sm:p-5 hover:border-secondary-500/70 hover:bg-surface-100/40 transition-colors relative overflow-hidden group"
          >
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-secondary-500" aria-hidden="true" />
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Monogram name={mine.teamName || mine.username} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold text-white">{mine.teamName || mine.username}</span>
                    <span className="text-xs font-bold text-secondary-400 border border-secondary-500/50 rounded px-1.5 py-px tracking-wide">TU</span>
                    {mine.role === 'ADMIN' && <RoleTag role={mine.role} />}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Età rosa {formatAge(averageAge(mine.players))}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="micro-label text-gray-500">Bilancio</p>
                <p className="budget-display text-3xl text-accent-400 leading-none mt-1">
                  {computeAvailableBudget(mine)}<span className="text-base text-gray-500 ml-0.5">M</span>
                </p>
              </div>
            </div>
            {minePosAges && minePosCounts && (
              <div className="mt-3.5 pt-3.5 border-t border-surface-50/10">
                <CompositionGroups ages={minePosAges} counts={minePosCounts} />
              </div>
            )}
            <span className="absolute right-4 bottom-4 text-gray-500 text-sm group-hover:text-secondary-400 transition-colors" aria-hidden="true">↗</span>
          </button>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <span className="micro-label text-gray-400">Rose degli avversari</span>

          {/* Desktop: tabella vera, età media e conteggio per reparto come due gruppi di colonne
              distinte (mockup A). 12 colonne → scroll orizzontale interno su schermi stretti. */}
          <div className="hidden md:block mt-2 overflow-x-auto">
            <div className={OPPONENTS_TABLE_MIN_WIDTH}>
              <div className="rounded-lg border border-surface-50/60 bg-surface-300/50 overflow-hidden">
                <div className={`grid ${OPPONENTS_TABLE_GRID} gap-1.5 px-4 pt-2.5`}>
                  <span className="micro-label text-gray-400">Squadra</span>
                  <span className="micro-label text-gray-400 text-right">Età rosa</span>
                  <span className="micro-label text-gray-400 text-center col-span-4">Età media per reparto</span>
                  <span className="micro-label text-gray-400 text-center col-span-4">N. giocatori per reparto</span>
                  <span className="micro-label text-gray-400 text-right">Bilancio</span>
                  <span />
                </div>
                <div className={`grid ${OPPONENTS_TABLE_GRID} gap-1.5 px-4 pb-2.5`}>
                  <span /><span />
                  {POSITIONS.map(pos => (
                    <span key={`eta-${pos}`} className={`micro-label text-center ${POS_TEXT_COLOR[pos]}`}>{pos}</span>
                  ))}
                  {POSITIONS.map(pos => (
                    <span key={`n-${pos}`} className={`micro-label text-center ${POS_TEXT_COLOR[pos]}`}>{pos}</span>
                  ))}
                  <span /><span />
                </div>
              </div>
              <div className="space-y-1.5 mt-1.5">
                {others.map(r => {
                  const posAges = averageAgeByPosition(r.players)
                  const posCounts = countByPosition(r.players)
                  return (
                    <button
                      key={r.memberId}
                      onClick={() => { onNavigate('rose', { leagueId, memberId: r.memberId }); }}
                      className={`grid ${OPPONENTS_TABLE_GRID} gap-1.5 items-center w-full bg-surface-200 border border-surface-50/20 rounded-lg px-4 py-3 hover:border-primary-500/50 hover:bg-surface-100/30 transition-colors text-left`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Monogram name={r.teamName || r.username} size="sm" />
                        <span className="text-sm font-bold text-white truncate">{r.teamName || r.username}</span>
                        {r.role === 'ADMIN' && <RoleTag role={r.role} />}
                      </span>
                      <span className="font-mono text-sm text-gray-200 text-right">{formatAge(averageAge(r.players))}</span>
                      {POSITIONS.map(pos => (
                        <span key={`eta-${pos}`} className="font-mono text-xs text-gray-400 text-center">{formatAge(posAges[pos])}</span>
                      ))}
                      {POSITIONS.map(pos => (
                        <span key={`n-${pos}`} className="font-mono text-xs text-gray-400 text-center">{posCounts[pos]}</span>
                      ))}
                      <span className="budget-display text-sm text-accent-400 text-right">{computeAvailableBudget(r)}<span className="text-xs text-gray-500">M</span></span>
                      <span className="text-gray-500 text-base text-right" aria-hidden="true">›</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Mobile: card impilate con label esplicite per ogni dato (niente troncamento/colonne strette). */}
          <div className="md:hidden mt-2 space-y-2">
            {others.map(r => {
              const posAges = averageAgeByPosition(r.players)
              const posCounts = countByPosition(r.players)
              return (
                <button
                  key={r.memberId}
                  onClick={() => { onNavigate('rose', { leagueId, memberId: r.memberId }); }}
                  className="w-full text-left bg-surface-200 border border-surface-50/20 rounded-lg p-4 hover:border-primary-500/50 hover:bg-surface-100/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <Monogram name={r.teamName || r.username} size="md" />
                      <span className="text-sm font-bold text-white truncate">{r.teamName || r.username}</span>
                      {r.role === 'ADMIN' && <RoleTag role={r.role} />}
                    </span>
                    <span className="text-gray-500 text-base flex-shrink-0" aria-hidden="true">›</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Età media rosa" value={formatAge(averageAge(r.players))} />
                    <Field label="Bilancio" value={`${computeAvailableBudget(r)}M`} tone="text-accent-400" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-50/10">
                    <CompositionGroups ages={posAges} counts={posCounts} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
