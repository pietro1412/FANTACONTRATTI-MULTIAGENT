import { MOVEMENT_TYPE_SHORT, MOVEMENT_TYPE_COLORS, MOVEMENT_TYPE_ICONS } from '../../utils/movement-constants'
import { POSITION_TEXT_COLORS } from '@/components/ui/PositionBadge'

interface Movement {
  id: string
  type: string
  player: { name: string; position: string; team: string }
  from: { username: string } | null
  to: { username: string } | null
  price: number | null
  createdAt: string
}

interface RecentMovementsProps {
  movements: Movement[]
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

function timeAgo(dateString: string): string {
  const now = Date.now()
  const date = new Date(dateString).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ora'
  if (mins < 60) return `${mins}m fa`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h fa`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}g fa`
  return new Date(dateString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}


export function RecentMovements({ movements, onNavigate, leagueId }: RecentMovementsProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      <div className="p-5 border-b border-surface-50/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\uD83D\uDCDC'}</span>
          <h3 className="text-base font-bold text-white">Ultimi Movimenti</h3>
        </div>
        <button
          onClick={() => { onNavigate('movements', { leagueId }); }}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          Vedi tutti &rarr;
        </button>
      </div>

      {movements.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">
          Nessun movimento registrato
        </div>
      ) : (
        <div className="divide-y divide-surface-50/10">
          {movements.map((m) => {
            const typeColor = MOVEMENT_TYPE_COLORS[m.type] || 'bg-gray-500/20 text-gray-400'
            const icon = MOVEMENT_TYPE_ICONS[m.type] || '\uD83D\uDD04'
            const posColor = POSITION_TEXT_COLORS[m.player.position] || 'text-gray-400'
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-300/30 transition-colors">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${typeColor}`}>
                  {icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${posColor}`}>{m.player.position}</span>
                    <span className="text-sm text-white font-medium truncate">{m.player.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${typeColor}`}>
                      {MOVEMENT_TYPE_SHORT[m.type] || m.type.slice(0, 2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {m.from?.username || '\u2014'} &rarr; {m.to?.username || '\u2014'}
                    {m.price ? <span className="text-accent-400 ml-1.5">{m.price}cr</span> : null}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(m.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
