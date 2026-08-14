import { POSITION_GRADIENTS, POSITION_TEXT_COLORS } from '@/components/ui/PositionBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'

export interface CompositionRankingRow {
  memberId: string
  displayName: string
  total: number
  byPosition: { P: number; D: number; C: number; A: number }
  isMe: boolean
}

export interface RosterSidebarProps {
  total: number
  byPosition: { P: number; D: number; C: number; A: number }
  teamCounts: { team: string; count: number }[]
  teamFilter: string
  onTeamToggle: (team: string) => void
  ranking: CompositionRankingRow[]
  selectedMemberId: string
  onSelectMember: (memberId: string) => void
}

const ROLES = ['P', 'D', 'C', 'A'] as const

// Row grid shared by header and ranking rows: rank + manager name + P/D/C/A + total
const RANK_GRID = 'grid grid-cols-[16px_minmax(0,1fr)_18px_18px_18px_18px_24px] gap-1 items-center'

/**
 * Cockpit sidebar for the Rose / Giocatori cluster: selected member composition
 * bars, a league-wide composition ranking (clickable to switch the roster) and
 * teams represented (clickable to toggle the team filter).
 */
export function RosterSidebar({
  total,
  byPosition,
  teamCounts,
  teamFilter,
  onTeamToggle,
  ranking,
  selectedMemberId,
  onSelectMember,
}: RosterSidebarProps) {
  const maxRole = Math.max(1, ...ROLES.map(r => byPosition[r]))

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      {/* Composition (selected member) */}
      <div className="bg-surface-200 border border-surface-50 rounded-xl p-3.5 flex-shrink-0">
        <div className="micro-label mb-3">Composizione · {total} giocatori</div>
        <div className="flex flex-col gap-2.5">
          {ROLES.map(role => {
            const count = byPosition[role]
            const pct = Math.round((count / maxRole) * 100)
            return (
              <div key={role} className="flex items-center gap-2.5">
                <span className={`w-4 font-display font-bold text-xs ${POSITION_TEXT_COLORS[role] ?? ''}`}>{role}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-50/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${POSITION_GRADIENTS[role] ?? ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-gray-400 w-7 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* League-wide composition ranking */}
      {ranking.length > 0 && (
        <div
          data-testid="composition-ranking"
          className="bg-surface-200 border border-surface-50 rounded-xl p-3.5 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
        >
          <div className="micro-label mb-2 flex-shrink-0">Classifica composizione</div>
          <div className={`${RANK_GRID} mb-1 flex-shrink-0 text-[9px] font-mono font-bold text-gray-500`}>
            <span className="text-right">#</span>
            <span>Manager</span>
            <span className="text-center text-accent-400">P</span>
            <span className="text-center text-primary-400">D</span>
            <span className="text-center text-secondary-400">C</span>
            <span className="text-center text-danger-400">A</span>
            <span className="text-center text-gray-300">Tot</span>
          </div>
          <div className="lg:panel-scroll lg:flex-1 lg:min-h-0 -mr-1 pr-1 flex flex-col gap-0.5">
            {ranking.map((row, i) => {
              const active = row.memberId === selectedMemberId
              return (
                <button
                  key={row.memberId}
                  type="button"
                  onClick={() => { onSelectMember(row.memberId); }}
                  aria-pressed={active}
                  className={`${RANK_GRID} rounded-lg px-1 py-1 text-[11px] transition-colors ${
                    active ? 'bg-primary-500/20 text-primary-300' : 'text-gray-400 hover:bg-surface-100/60'
                  }`}
                >
                  <span className="font-mono text-[10px] text-right text-gray-500">{i + 1}</span>
                  <span className="flex items-center gap-1 min-w-0 text-left truncate">
                    <span className="truncate font-medium">{row.displayName}</span>
                    {row.isMe && <span className="dot-live bg-accent-400 flex-shrink-0" title="La mia rosa" />}
                  </span>
                  <span className="font-mono text-center">{row.byPosition.P}</span>
                  <span className="font-mono text-center">{row.byPosition.D}</span>
                  <span className="font-mono text-center">{row.byPosition.C}</span>
                  <span className="font-mono text-center">{row.byPosition.A}</span>
                  <span className="font-mono text-center font-bold text-white">{row.total}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Teams represented */}
      {teamCounts.length > 0 && (
        <div className="bg-surface-200 border border-surface-50 rounded-xl p-3.5 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          <div className="micro-label mb-3 flex-shrink-0">Squadre rappresentate</div>
          <div className="flex flex-col gap-1.5 lg:panel-scroll lg:flex-1 lg:min-h-0 -mr-1 pr-1">
            {teamCounts.map(({ team, count }) => {
              const active = teamFilter === team
              return (
                <button
                  key={team}
                  type="button"
                  onClick={() => { onTeamToggle(team); }}
                  aria-pressed={active}
                  className={`flex items-center gap-2 text-[11.5px] rounded-lg px-1.5 py-1 transition-colors ${
                    active ? 'bg-primary-500/20 text-primary-300' : 'text-gray-400 hover:bg-surface-100/60'
                  }`}
                >
                  <TeamLogo team={team} size="xs" />
                  <span className="flex-1 text-left truncate">{team}</span>
                  <span className="font-mono font-bold text-gray-500">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default RosterSidebar
