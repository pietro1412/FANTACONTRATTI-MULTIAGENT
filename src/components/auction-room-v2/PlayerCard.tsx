import { useState } from 'react'
import { getTeamLogo } from '../../utils/teamLogos'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { POSITION_GRADIENTS, POSITION_FILTER_COLORS, POSITION_NAMES } from '../ui/PositionBadge'

interface PlayerCardProps {
  name: string
  team: string
  position: string
  quotation?: number
  age?: number | null
  apiFootballId?: number | null
  size?: 'sm' | 'md' | 'lg'
}

export function PlayerCard({ name, team, position, quotation, age, apiFootballId, size = 'md' }: PlayerCardProps) {
  const posName = POSITION_NAMES[position as keyof typeof POSITION_NAMES] || position
  const posGradient = POSITION_GRADIENTS[position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
  const posBg = POSITION_FILTER_COLORS[position as keyof typeof POSITION_FILTER_COLORS] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  const photoUrl = getPlayerPhotoUrl(apiFootballId)
  const [imgError, setImgError] = useState(false)

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-7 h-7 rounded-full object-cover bg-slate-700 flex-shrink-0"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${posGradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>{position}</span>
        )}
        <div className="w-6 h-6 bg-white/90 rounded flex items-center justify-center p-0.5 flex-shrink-0">
          <img src={getTeamLogo(team)} alt={team} className="w-5 h-5 object-contain" />
        </div>
        <span className="text-sm font-medium text-white truncate">{name}</span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${posGradient}`} />
      <div className="relative text-center p-5">
        <div className="relative inline-block mb-3">
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={name}
              className={`rounded-xl object-cover bg-slate-700 border-2 border-white/20 shadow-xl mx-auto ${size === 'lg' ? 'w-24 h-24' : 'w-16 h-16'}`}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xl border-2 border-white/30 mx-auto">
              <img src={getTeamLogo(team)} alt={team} className="w-12 h-12 object-contain" />
            </div>
          )}
        </div>
        <h2 className={`font-black text-white mb-1 tracking-tight ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>{name}</h2>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-gray-400 text-sm">{team}</span>
          <span className="text-gray-600">·</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${posBg}`}>{posName}</span>
          {age != null && age > 0 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400 text-sm font-mono">{age} anni</span>
            </>
          )}
        </div>
        {quotation != null && quotation > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-500/15 rounded-lg border border-accent-500/25">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Quot.</span>
            <span className="text-lg font-black font-mono text-accent-400">{quotation}</span>
          </div>
        )}
      </div>
    </div>
  )
}
