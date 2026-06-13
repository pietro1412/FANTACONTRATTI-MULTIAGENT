import { PositionBadge } from '@/components/ui/PositionBadge'
import { Monogram } from '@/components/ui/Monogram'
import { AmountStepper } from '@/components/ui/AmountStepper'
import { getTeamLogo } from '@/utils/teamLogos'

interface IndemnityPlayer {
  playerId: string
  playerName: string
  position: string
  team: string
  quotation: number
  exitReason: 'RITIRATO' | 'RETROCESSO' | 'ESTERO'
  contract: {
    salary: number
    duration: number
    rescissionClause: number | null
  } | null
}

interface IndemnityMember {
  id: string
  teamName: string
  username: string
  indemnityPlayers: IndemnityPlayer[]
}

interface IndemnityTableProps {
  members: IndemnityMember[]
  /** Resolve the (custom or default) indemnity amount for a player. */
  getAmount: (playerId: string) => number
  /** True when the admin can still edit the ESTERO amounts. */
  editable: boolean
  /** Player id currently being saved (dims its stepper). */
  savingPlayerId: string | null
  onAmountChange: (playerId: string, newAmount: number) => void
}

const EXIT_CONFIG: Record<IndemnityPlayer['exitReason'], { label: string; chip: string }> = {
  RITIRATO: { label: 'Ritirato', chip: 'text-gray-400 bg-surface-100 border-surface-50/40' },
  RETROCESSO: { label: 'Retrocesso', chip: 'text-accent-400 bg-accent-500/10 border-accent-500/30' },
  ESTERO: { label: 'Estero', chip: 'text-primary-400 bg-primary-500/10 border-primary-500/30' },
}

function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt=""
      className="w-full h-full object-contain"
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

/**
 * Deduplicated indemnity table (single responsive layout, no separate desktop/mobile trees).
 * Rows are flattened across members; each row shows its owner via a Monogram.
 */
export function IndemnityTable({
  members,
  getAmount,
  editable,
  savingPlayerId,
  onAmountChange,
}: IndemnityTableProps) {
  const rows = members
    .filter(m => m.indemnityPlayers.length > 0)
    .flatMap(member => member.indemnityPlayers.map(player => ({ member, player })))

  const esteroTotal = members
    .flatMap(m => m.indemnityPlayers)
    .filter(p => p.exitReason === 'ESTERO')
    .reduce((sum, p) => sum + getAmount(p.playerId), 0)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-50/20">
              <th className="text-left py-2 px-2 micro-label">Giocatore</th>
              <th className="text-left py-2 px-2 micro-label">Manager</th>
              <th className="text-right py-2 px-2 micro-label hidden sm:table-cell">Quot.</th>
              <th className="text-right py-2 px-2 micro-label hidden sm:table-cell">Contratto</th>
              <th className="text-center py-2 px-2 micro-label">Motivo</th>
              <th className="text-right py-2 px-2 micro-label">Indennizzo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, player }) => {
              const exit = EXIT_CONFIG[player.exitReason]
              return (
                <tr
                  key={`${member.id}-${player.playerId}`}
                  className="border-b border-surface-50/10 last:border-b-0 hover:bg-surface-100/30"
                >
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2.5">
                      <PositionBadge position={player.position} size="sm" showIcon={false} />
                      <div className="w-7 h-7 bg-white rounded p-0.5 flex-shrink-0 hidden sm:block">
                        <TeamLogo team={player.team} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-white truncate">{player.playerName}</p>
                        <p className="text-[11px] text-gray-500">{player.team}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <Monogram name={member.teamName || member.username} size="sm" />
                      <span className="font-display font-bold text-[12.5px] text-gray-300 truncate">
                        {member.teamName || member.username}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400 hidden sm:table-cell">
                    {player.quotation}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400 hidden sm:table-cell">
                    {player.contract ? `${player.contract.salary}×${player.contract.duration}` : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={`inline-block text-[10px] font-mono font-bold uppercase rounded-md px-2 py-0.5 border ${exit.chip}`}>
                      {exit.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {player.exitReason === 'ESTERO' ? (
                      editable ? (
                        <AmountStepper
                          value={getAmount(player.playerId)}
                          onChange={(v) => { onAmountChange(player.playerId, v) }}
                          min={0}
                          unit="M"
                          tone="accent"
                          size="sm"
                          disabled={savingPlayerId === player.playerId}
                          aria-label={`Indennizzo per ${player.playerName}`}
                        />
                      ) : (
                        <span className="stat-number text-accent-400">{getAmount(player.playerId)}M</span>
                      )
                    ) : (
                      <span className="text-gray-600">−</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-surface-50/30">
              <td colSpan={5} className="py-3 px-2 text-right">
                <span className="micro-label">Totale indennizzi estero</span>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="stat-number text-lg text-accent-400">{esteroTotal}M</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
