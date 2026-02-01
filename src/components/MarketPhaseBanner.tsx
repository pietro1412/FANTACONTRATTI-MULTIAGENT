import { useState, useEffect } from 'react'

// Display phase type
export type DisplayPhase = 'scouting' | 'open_window' | 'clause_meeting'

interface MarketPhaseBannerProps {
  phase: DisplayPhase
  phaseLabel?: string
  marketPhase?: string | null
  nextClauseDay?: string
  daysRemaining?: number
  isActive?: boolean
  compact?: boolean
}

// Phase configuration
const PHASE_CONFIG: Record<DisplayPhase, {
  bgColor: string
  borderColor: string
  textColor: string
  icon: string
  glowColor: string
}> = {
  scouting: {
    bgColor: 'bg-gray-800/80',
    borderColor: 'border-gray-600',
    textColor: 'text-gray-300',
    icon: '🔍',
    glowColor: '',
  },
  open_window: {
    bgColor: 'bg-yellow-900/50',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    icon: '📋',
    glowColor: 'shadow-yellow-500/20',
  },
  clause_meeting: {
    bgColor: 'bg-green-900/50',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-400',
    icon: '🎯',
    glowColor: 'shadow-green-500/30',
  },
}

// Phase labels
const PHASE_LABELS: Record<DisplayPhase, string> = {
  scouting: 'Mercato Chiuso',
  open_window: 'Sessione Aperta',
  clause_meeting: 'Clause Day',
}

// Market phase readable names
const MARKET_PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta Libera',
  OFFERTE_PRE_RINNOVO: 'Offerte Pre-Rinnovo',
  PREMI: 'Assegnazione Premi',
  CONTRATTI: 'Rinnovo Contratti',
  CALCOLO_INDENNIZZI: 'Calcolo Indennizzi',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Asta Svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Offerte Post-Asta',
}

export function formatCountdown(targetDate: string): string {
  const now = new Date()
  const target = new Date(targetDate)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) return 'In corso'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}g ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function MarketPhaseBanner({
  phase,
  phaseLabel,
  marketPhase,
  nextClauseDay,
  daysRemaining,
  isActive,
  compact = false,
}: MarketPhaseBannerProps) {
  const [countdown, setCountdown] = useState('')
  const config = PHASE_CONFIG[phase]
  const label = phaseLabel || PHASE_LABELS[phase]

  // Update countdown every minute
  useEffect(() => {
    if (!nextClauseDay) return

    const updateCountdown = () => {
      setCountdown(formatCountdown(nextClauseDay))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [nextClauseDay])

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} border ${config.borderColor}`}>
        <span>{config.icon}</span>
        <span className={`text-sm font-medium ${config.textColor}`}>{label}</span>
        {marketPhase && (
          <span className="text-xs text-gray-400">
            ({MARKET_PHASE_LABELS[marketPhase] || marketPhase})
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`sticky top-0 z-40 px-4 py-3 ${config.bgColor} border-b ${config.borderColor} backdrop-blur-sm shadow-lg ${config.glowColor}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Phase Info */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <div className={`font-semibold ${config.textColor}`}>
              {label}
              {phase === 'clause_meeting' && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-500 text-white animate-pulse">
                  LIVE
                </span>
              )}
            </div>
            {marketPhase && (
              <div className="text-xs text-gray-400">
                Fase: {MARKET_PHASE_LABELS[marketPhase] || marketPhase}
              </div>
            )}
          </div>
        </div>

        {/* Center: Status */}
        <div className="hidden sm:flex items-center gap-4">
          {!isActive && phase === 'scouting' && (
            <div className="text-sm text-gray-400">
              Nessuna sessione attiva - Tempo di preparazione
            </div>
          )}
          {isActive && phase === 'open_window' && (
            <div className="text-sm text-yellow-300">
              Sessione in corso - Prepara le tue strategie
            </div>
          )}
          {isActive && phase === 'clause_meeting' && (
            <div className="text-sm text-green-300 font-medium">
              Clause Day in corso - Esegui le tue clausole!
            </div>
          )}
        </div>

        {/* Right: Countdown to next Clause Day */}
        {phase !== 'clause_meeting' && nextClauseDay && (
          <div className="text-right">
            <div className="text-xs text-gray-400">Prossimo Clause Day</div>
            <div className={`text-lg font-bold ${config.textColor}`}>
              {countdown || `${daysRemaining}g`}
            </div>
          </div>
        )}

        {/* Right: During Clause Day */}
        {phase === 'clause_meeting' && (
          <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1.5 rounded-lg border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-green-400">
              Clausole attive
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default MarketPhaseBanner
