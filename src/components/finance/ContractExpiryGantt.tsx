import { type PlayerData, POSITION_COLORS } from './types'

interface ContractExpiryGanttProps {
  players: PlayerData[]
}

export function ContractExpiryGantt({ players }: ContractExpiryGanttProps) {
  // Filter active players with contracts, sort by duration (shortest first = most urgent)
  const activePlayers = players
    .filter(p => p.duration > 0 && !p.draftReleased)
    .sort((a, b) => a.duration - b.duration)

  if (activePlayers.length === 0) {
    return (
      <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
        <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">Scadenze Contrattuali</div>
        <div className="text-sm text-gray-500 text-center py-4">Nessun contratto attivo</div>
      </div>
    )
  }

  const maxDuration = Math.max(...activePlayers.map(p => p.duration), 4)

  // Count expiring contracts
  const expiring1 = activePlayers.filter(p => p.duration === 1).length
  const expiring2 = activePlayers.filter(p => p.duration === 2).length

  // Duration colors
  const getDurationColor = (dur: number) => {
    if (dur === 1) return 'bg-danger-500'
    if (dur === 2) return 'bg-amber-500'
    if (dur === 3) return 'bg-primary-500'
    return 'bg-green-500'
  }

  const getDurationTextColor = (dur: number) => {
    if (dur === 1) return 'text-danger-400'
    if (dur === 2) return 'text-amber-400'
    if (dur === 3) return 'text-primary-400'
    return 'text-green-400'
  }

  return (
    <div className="bg-surface-300/50 rounded-lg p-3 md:p-4 border border-surface-50/10">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider mb-3">
        Scadenze Contrattuali
      </div>

      {/* Timeline header */}
      <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-500">
        <div className="w-24 md:w-32" />
        {Array.from({ length: maxDuration }, (_, i) => (
          <div key={i} className="flex-1 text-center">
            Sem.{i + 1}
          </div>
        ))}
      </div>

      {/* Player bars */}
      <div className="space-y-1.5">
        {activePlayers.map(player => {
          const barWidth = (player.duration / maxDuration) * 100

          return (
            <div key={player.id} className="flex items-center gap-2">
              <div className="w-24 md:w-32 flex items-center gap-1.5 min-w-0">
                <span className={`px-1 py-0.5 rounded text-[8px] md:text-[10px] font-bold ${POSITION_COLORS[player.position] ?? ''}`}>
                  {player.position}
                </span>
                <span className="text-[10px] md:text-xs text-white truncate">{player.name}</span>
              </div>
              <div className="flex-1 h-4 md:h-5 bg-surface-100/30 rounded-full overflow-hidden relative">
                <div
                  className={`h-full ${getDurationColor(player.duration)} rounded-full transition-all duration-300 opacity-70`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`text-[10px] md:text-xs font-medium w-6 text-right ${getDurationTextColor(player.duration)}`}>
                {player.duration}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {(expiring1 > 0 || expiring2 > 0) && (
        <div className="mt-3 pt-2 border-t border-surface-50/20 text-[10px] md:text-xs">
          {expiring1 > 0 && (
            <div className="text-danger-400">
              {expiring1} contratt{expiring1 === 1 ? 'o' : 'i'} in scadenza al prossimo semestre
            </div>
          )}
          {expiring2 > 0 && (
            <div className="text-amber-400 mt-0.5">
              {expiring2} contratt{expiring2 === 1 ? 'o' : 'i'} in scadenza entro 2 semestri
            </div>
          )}
        </div>
      )}
    </div>
  )
}
