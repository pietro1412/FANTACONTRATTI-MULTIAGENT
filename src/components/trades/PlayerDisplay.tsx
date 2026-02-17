import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { POSITION_GRADIENTS } from '../ui/PositionBadge'
import { getRoleStyle } from './utils'
import type { Player } from './types'

// Componente logo squadra
export function TeamLogo({ team, size = 'md' }: { team: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className={`${sizeClass} object-contain`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

// Componente per visualizzare un giocatore con tutte le info
export function PlayerCard({ player, compact = false }: { player: Player, compact?: boolean }) {
  const roleStyle = getRoleStyle(player.position)

  const gradient = POSITION_GRADIENTS[player.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        {/* Player photo */}
        <div className="relative flex-shrink-0">
          {player.apiFootballId ? (
            <img
              src={getPlayerPhotoUrl(player.apiFootballId)}
              alt={player.name}
              className="w-7 h-7 rounded-full object-cover bg-surface-300"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} items-center justify-center text-[9px] font-bold text-white ${player.apiFootballId ? 'hidden' : 'flex'}`}>
            {player.position}
          </div>
        </div>
        <span className={`w-8 h-5 flex items-center justify-center text-[10px] font-bold rounded ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border} border`}>
          {roleStyle.label}
        </span>
        <span className="text-white font-medium text-sm">{player.name}</span>
        {player.contract ? (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-accent-400 font-mono">{player.contract.salary}M</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-warning-400 font-mono" title="Clausola Rubata">
              R: {player.contract.rescissionClause || '-'}M
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic ml-auto">n.d.</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-200/50 rounded-lg border border-surface-50/20 hover:border-surface-50/40 transition-colors">
      {/* Player photo with position badge */}
      <div className="relative flex-shrink-0">
        {player.apiFootballId ? (
          <img
            src={getPlayerPhotoUrl(player.apiFootballId)}
            alt={player.name}
            className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} items-center justify-center text-xs font-bold text-white ${player.apiFootballId ? 'hidden' : 'flex'}`}>
          {player.position}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[9px] border border-surface-200`}>
          {player.position}
        </span>
      </div>
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{player.name}</p>
        <p className="text-gray-500 text-xs">{player.team}</p>
      </div>
      {/* Contract Info */}
      <div className="text-right flex-shrink-0">
        {player.contract ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-end gap-2">
              <span className="text-accent-400 font-semibold text-sm font-mono">{player.contract.salary}M</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400 text-xs font-mono">{player.contract.duration}sem</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] text-gray-500 uppercase">Rubata:</span>
              <span className="text-warning-400 font-medium text-xs font-mono">
                {player.contract.rescissionClause ? `${player.contract.rescissionClause}M` : '-'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-xs italic">Contratto n.d.</p>
        )}
      </div>
    </div>
  )
}

// Helper component to render players in table format (for offers display)
export function PlayersTable({ players }: { players: Player[] }) {
  if (!players || players.length === 0) return null

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500 text-xs uppercase">
          <th className="text-left font-medium pb-1">Giocatore</th>
          <th className="text-center font-medium pb-1 w-14">Ruolo</th>
          <th className="text-center font-medium pb-1 w-14">Ing.</th>
          <th className="text-center font-medium pb-1 w-12">Dur.</th>
          <th className="text-center font-medium pb-1 w-16">Claus.</th>
        </tr>
      </thead>
      <tbody>
        {players.map(p => {
          const roleStyle = getRoleStyle(p.position)
          const photoUrl = getPlayerPhotoUrl(p.apiFootballId)
          const posGradient = POSITION_GRADIENTS[p.position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
          return (
            <tr key={p.id} className="border-t border-surface-50/10">
              <td className="py-2">
                <div className="flex items-center gap-2">
                  {/* Player photo with position badge */}
                  <div className="relative flex-shrink-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover bg-surface-300 border border-surface-50/20"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${posGradient} items-center justify-center text-[10px] font-bold text-white ${photoUrl ? 'hidden' : 'flex'}`}>
                      {p.position}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br ${posGradient} flex items-center justify-center text-white font-bold text-[8px] border border-surface-200`}>
                      {p.position}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-200 truncate block">{p.name}</span>
                    <span className="text-xs text-gray-500 truncate block">{p.team}</span>
                  </div>
                </div>
              </td>
              <td className="text-center">
                <span className={`inline-block px-1.5 py-0.5 text-xs font-bold rounded ${roleStyle.bg} ${roleStyle.text}`}>
                  {roleStyle.label}
                </span>
              </td>
              <td className="text-center text-accent-400 font-semibold font-mono">{p.contract?.salary ?? '-'}</td>
              <td className="text-center text-white font-mono">{p.contract?.duration ?? '-'}</td>
              <td className="text-center text-warning-400 font-mono">{p.contract?.rescissionClause ?? '-'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
