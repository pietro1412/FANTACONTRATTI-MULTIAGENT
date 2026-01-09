import { useState, useEffect } from 'react'
import { getTeamLogo } from '../utils/teamLogos'
import { PositionBadge } from './ui/PositionBadge'

interface Player {
  name: string
  position: string
  team: string
  quotation?: number
}

interface PlayerRevealCardProps {
  player: Player
  price: number
  winner?: string
  isVisible: boolean
  onAnimationComplete?: () => void
}

/**
 * FIFA Ultimate Team style card reveal animation
 * Shows a dramatic card flip when acquiring a player
 */
export function PlayerRevealCard({
  player,
  price,
  winner,
  isVisible,
  onAnimationComplete,
}: PlayerRevealCardProps) {
  const [stage, setStage] = useState<'hidden' | 'appearing' | 'flipping' | 'revealed'>('hidden')

  useEffect(() => {
    if (isVisible) {
      // Start animation sequence
      setStage('appearing')

      const flipTimer = setTimeout(() => {
        setStage('flipping')
      }, 500)

      const revealTimer = setTimeout(() => {
        setStage('revealed')
        onAnimationComplete?.()
      }, 1200)

      return () => {
        clearTimeout(flipTimer)
        clearTimeout(revealTimer)
      }
    } else {
      setStage('hidden')
    }
  }, [isVisible, onAnimationComplete])

  if (!isVisible && stage === 'hidden') return null

  // Position colors for card glow
  const positionGlowColors: Record<string, string> = {
    P: 'shadow-amber-500/50',
    D: 'shadow-blue-500/50',
    C: 'shadow-green-500/50',
    A: 'shadow-red-500/50',
  }

  const glowClass = positionGlowColors[player.position] || 'shadow-primary-500/50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={`relative transition-all duration-700 ease-out ${
          stage === 'hidden' ? 'scale-0 opacity-0' :
          stage === 'appearing' ? 'scale-75 opacity-100' :
          stage === 'flipping' ? 'scale-100 opacity-100' :
          'scale-100 opacity-100'
        }`}
        style={{
          perspective: '1000px',
        }}
      >
        {/* Card container */}
        <div
          className={`relative w-72 h-96 transition-transform duration-500 ${
            stage === 'flipping' || stage === 'revealed' ? 'rotate-y-0' : 'rotate-y-180'
          }`}
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Card back (visible initially) */}
          <div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-surface-100 to-surface-300 border-2 border-surface-50/30 flex items-center justify-center transition-opacity duration-300 ${
              stage === 'revealed' ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center animate-pulse">
              <span className="text-5xl">⚽</span>
            </div>
          </div>

          {/* Card front (revealed) */}
          <div
            className={`absolute inset-0 rounded-2xl overflow-hidden ${glowClass} shadow-2xl transition-all duration-500 ${
              stage === 'revealed' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {/* Card background gradient based on position */}
            <div className={`absolute inset-0 ${
              player.position === 'P' ? 'bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700' :
              player.position === 'D' ? 'bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700' :
              player.position === 'C' ? 'bg-gradient-to-br from-green-600 via-green-500 to-green-700' :
              'bg-gradient-to-br from-red-600 via-red-500 to-red-700'
            }`} />

            {/* Card pattern overlay */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col">
              {/* Top section with position */}
              <div className="p-4 flex justify-between items-start">
                <PositionBadge position={player.position} size="lg" showIcon />
                <div className="text-right">
                  <p className="text-xs text-white/70 uppercase tracking-wider">Quotazione</p>
                  <p className="text-2xl font-bold text-white stat-number">{player.quotation || '-'}</p>
                </div>
              </div>

              {/* Team logo */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-xl shadow-lg flex items-center justify-center p-3">
                  <img
                    src={getTeamLogo(player.team)}
                    alt={player.team}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Player info */}
              <div className="p-4 bg-black/30 backdrop-blur-sm">
                <h3 className="text-2xl font-bold text-white text-center mb-1">{player.name}</h3>
                <p className="text-center text-white/70 text-sm mb-3">{player.team}</p>

                {/* Price and winner */}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-white/60 uppercase">Prezzo</p>
                    <p className="text-2xl font-bold text-white stat-number">{price}</p>
                  </div>
                  {winner && (
                    <div className="text-right">
                      <p className="text-xs text-white/60 uppercase">Acquistato da</p>
                      <p className="text-lg font-semibold text-white">{winner}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Close hint */}
        {stage === 'revealed' && (
          <p className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-gray-400 text-sm animate-pulse">
            Tocca per chiudere
          </p>
        )}
      </div>
    </div>
  )
}

export default PlayerRevealCard
