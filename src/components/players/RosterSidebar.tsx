import { POSITION_GRADIENTS, POSITION_TEXT_COLORS } from '@/components/ui/PositionBadge'
import { TeamLogo } from '@/components/ui/TeamLogo'

export interface RosterSidebarProps {
  total: number
  byPosition: { P: number; D: number; C: number; A: number }
  teamCounts: { team: string; count: number }[]
  teamFilter: string
  onTeamToggle: (team: string) => void
}

const ROLES = ['P', 'D', 'C', 'A'] as const

/**
 * Cockpit sidebar for the Rose / Giocatori cluster: role composition bars +
 * teams represented (clickable to toggle the team filter).
 */
export function RosterSidebar({ total, byPosition, teamCounts, teamFilter, onTeamToggle }: RosterSidebarProps) {
  const maxRole = Math.max(1, ...ROLES.map(r => byPosition[r]))

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      {/* Composition */}
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
