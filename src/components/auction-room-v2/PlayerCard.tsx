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
  appearances?: number | null
  goals?: number | null
  assists?: number | null
  avgRating?: number | null
  size?: 'sm' | 'md' | 'lg'
}

function getAgeColor(age: number | null | undefined): string {
  if (age == null) return 'text-gray-500'
  if (age < 20) return 'text-emerald-400'
  if (age < 25) return 'text-green-400'
  if (age < 30) return 'text-yellow-400'
  if (age < 35) return 'text-orange-400'
  return 'text-red-400'
}

function getAgeBg(age: number | null | undefined): string {
  if (age == null) return 'bg-gray-500/20 border-gray-500/30'
  if (age < 20) return 'bg-emerald-500/20 border-emerald-500/30'
  if (age < 25) return 'bg-green-500/15 border-green-500/30'
  if (age < 30) return 'bg-yellow-500/15 border-yellow-500/30'
  if (age < 35) return 'bg-orange-500/15 border-orange-500/30'
  return 'bg-red-500/20 border-red-500/30'
}

function getMvColor(mv: number | null | undefined): { text: string; bg: string; border: string } {
  if (mv == null) return { text: 'text-gray-400', bg: 'bg-slate-700/40', border: '' }
  if (mv >= 7.0) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border border-emerald-500/30' }
  if (mv >= 6.5) return { text: 'text-green-400', bg: 'bg-green-500/15', border: 'border border-green-500/30' }
  if (mv >= 6.0) return { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border border-sky-500/20' }
  if (mv >= 5.5) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border border-orange-500/20' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border border-red-500/20' }
}

export function PlayerCard({ name, team, position, quotation, age, apiFootballId, appearances, goals, assists, avgRating, size = 'md' }: PlayerCardProps) {
  const posName = POSITION_NAMES[position as keyof typeof POSITION_NAMES] || position
  const posGradient = POSITION_GRADIENTS[position as keyof typeof POSITION_GRADIENTS] || 'from-gray-500 to-gray-600'
  const posBg = POSITION_FILTER_COLORS[position as keyof typeof POSITION_FILTER_COLORS] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  const photoUrl = getPlayerPhotoUrl(apiFootballId)
  const [imgError, setImgError] = useState(false)
  const hasStats = appearances != null || goals != null || assists != null || avgRating != null
  const mvColor = getMvColor(avgRating)

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
      <div className="relative p-4">
        {/* Horizontal layout: photo left, info right */}
        <div className="flex items-start gap-4">
          {/* Player photo */}
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={name}
              className={`rounded-xl object-cover bg-slate-700 flex-shrink-0 ${size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'}`}
              onError={() => setImgError(true)}
            />
          ) : (
            <span className={`rounded-xl bg-gradient-to-br ${posGradient} flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 ${size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'}`}>
              {position}
            </span>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`font-black text-white uppercase truncate ${size === 'lg' ? 'text-lg' : 'text-base'}`}>{name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="w-5 h-5 bg-white/90 rounded flex items-center justify-center flex-shrink-0">
                <img src={getTeamLogo(team)} alt={team} className="w-3.5 h-3.5 object-contain" />
              </div>
              <span className="text-sm text-gray-400">{team}</span>
              <span className="text-gray-600">·</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${posBg}`}>{posName}</span>
              {age != null && age > 0 && (
                <>
                  <span className="text-gray-600">·</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getAgeBg(age)} ${getAgeColor(age)}`}>
                    {age} anni
                  </span>
                </>
              )}
            </div>

            {/* Quotation */}
            {quotation != null && quotation > 0 && (
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-accent-500/15 rounded-lg border border-accent-500/25">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Quot.</span>
                <span className="text-lg font-black font-mono text-accent-400">{quotation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        {hasStats && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {appearances != null && (
              <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Presenze</p>
                <p className="text-sm font-mono font-bold text-white">{appearances}</p>
              </div>
            )}
            {goals != null && (
              <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Gol</p>
                <p className="text-sm font-mono font-bold text-white">{goals}</p>
              </div>
            )}
            {assists != null && (
              <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-[9px] text-gray-500 uppercase font-semibold">Assist</p>
                <p className="text-sm font-mono font-bold text-white">{assists}</p>
              </div>
            )}
            {avgRating != null && (
              <div className={`${mvColor.bg} rounded-lg p-2 text-center ${mvColor.border}`}>
                <p className={`text-[9px] uppercase font-semibold ${mvColor.text}`}>MV</p>
                <p className={`text-sm font-mono font-bold ${mvColor.text}`}>{avgRating}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
