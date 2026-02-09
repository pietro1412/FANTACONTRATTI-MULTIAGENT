/**
 * AuctionTimer.tsx - Componente Timer Asta con Progress Bar
 *
 * NOTA PER ROLLBACK:
 * Se questo componente non piace, per tornare alla versione precedente:
 * 1. In AuctionRoom.tsx, rimuovere l'import di AuctionTimer
 * 2. Ripristinare il vecchio blocco timer (cercando "OLD_TIMER_START" nei commenti)
 * 3. Questo file può essere eliminato
 *
 * Creato il: 24/01/2026
 * Versione precedente: inline in AuctionRoom.tsx linee ~1510-1525
 */

import { useMemo } from 'react'

interface AuctionTimerProps {
  /** Secondi rimanenti (null se timer non attivo) */
  timeLeft: number | null
  /** Durata totale del timer in secondi */
  totalSeconds: number
  /** Se true, mostra versione compatta per mobile sticky */
  compact?: boolean
  /** Classe CSS aggiuntiva */
  className?: string
}

/**
 * Calcola il colore della progress bar in base alla percentuale rimanente
 * Verde (>50%) → Giallo (20-50%) → Rosso (<20%)
 */
function getTimerColor(percentage: number): {
  primary: string
  secondary: string
  glow: string
  text: string
  bg: string
} {
  if (percentage > 50) {
    return {
      primary: '#22c55e',      // green-500
      secondary: '#16a34a',    // green-600
      glow: 'rgba(34, 197, 94, 0.5)',
      text: 'text-green-400',
      bg: 'bg-green-500/20'
    }
  } else if (percentage > 20) {
    return {
      primary: '#eab308',      // yellow-500
      secondary: '#ca8a04',    // yellow-600
      glow: 'rgba(234, 179, 8, 0.5)',
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/20'
    }
  } else {
    return {
      primary: '#ef4444',      // red-500
      secondary: '#dc2626',    // red-600
      glow: 'rgba(239, 68, 68, 0.6)',
      text: 'text-red-400',
      bg: 'bg-red-500/20'
    }
  }
}

/**
 * AuctionTimer - Timer dell'asta con progress bar circolare animata
 *
 * Features:
 * - Progress bar circolare che si svuota man mano
 * - Cambio colore automatico: verde → giallo → rosso
 * - Effetto glow pulsante negli ultimi secondi
 * - Versione compatta per barra sticky mobile
 */
export function AuctionTimer({
  timeLeft,
  totalSeconds,
  compact = false,
  className = ''
}: AuctionTimerProps) {

  // Calcola la percentuale rimanente
  const percentage = useMemo(() => {
    if (timeLeft === null || totalSeconds <= 0) return 100
    return Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100))
  }, [timeLeft, totalSeconds])

  // Ottieni i colori basati sulla percentuale
  const colors = useMemo(() => getTimerColor(percentage), [percentage])

  // Parametri del cerchio SVG
  const size = compact ? 48 : 120
  const strokeWidth = compact ? 4 : 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - percentage / 100)

  // Se non c'è timer attivo, mostra placeholder
  if (timeLeft === null) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">--</span>
      </div>
    )
  }

  // === VERSIONE COMPATTA (per sticky mobile) ===
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} role="timer" aria-live="polite" aria-label={`${timeLeft} secondi rimanenti`}>
        {/* Mini cerchio progress */}
        <div className="relative">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Track di sfondo */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={strokeWidth}
            />
            {/* Progress animato */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.primary}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease',
                filter: timeLeft <= 5 ? `drop-shadow(0 0 6px ${colors.glow})` : 'none'
              }}
            />
          </svg>
          {/* Numero al centro */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono font-bold text-lg ${colors.text}`}>
              {timeLeft}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // === VERSIONE FULL (per desktop e sezione principale) ===
  const statusLabel = timeLeft <= 5 ? 'Ultimi secondi' : timeLeft <= 10 ? 'Affrettati' : 'Tempo OK'

  return (
    <div className={`relative ${className}`} role="timer" aria-live="assertive" aria-label={`Timer asta: ${timeLeft} secondi rimanenti. ${statusLabel}`}>
      {/* Container principale con effetto glow */}
      <div
        className={`
          relative p-6 rounded-2xl border-2 transition-all duration-300
          ${timeLeft <= 5
            ? 'border-red-500/50 bg-gradient-to-br from-red-950/40 to-surface-300'
            : timeLeft <= 10
              ? 'border-yellow-500/30 bg-gradient-to-br from-yellow-950/30 to-surface-300'
              : 'border-green-500/20 bg-gradient-to-br from-green-950/20 to-surface-300'
          }
        `}
        style={{
          boxShadow: timeLeft <= 5
            ? `0 0 30px ${colors.glow}, inset 0 0 30px rgba(239, 68, 68, 0.1)`
            : timeLeft <= 10
              ? `0 0 20px ${colors.glow}`
              : 'none'
        }}
      >
        {/* Label "ASTA IN CORSO" */}
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className={`
            px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider
            ${timeLeft <= 5
              ? 'bg-red-500 text-white animate-pulse'
              : timeLeft <= 10
                ? 'bg-yellow-500 text-black'
                : 'bg-green-500 text-white'
            }
          `}>
            {timeLeft <= 5 ? '⚠️ ULTIMI SECONDI!' : timeLeft <= 10 ? 'AFFRETTATI!' : 'ASTA IN CORSO'}
          </span>
        </div>

        {/* Cerchio Timer Principale */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            {/* SVG Progress Circle */}
            <svg
              width={size}
              height={size}
              className="transform -rotate-90"
              style={{
                filter: timeLeft <= 5 ? `drop-shadow(0 0 15px ${colors.glow})` : 'none'
              }}
            >
              {/* Track di sfondo */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={strokeWidth}
              />
              {/* Progress animato */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`url(#timerGradient-${timeLeft})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 0.5s ease-out',
                }}
                className={timeLeft <= 5 ? 'animate-pulse' : ''}
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id={`timerGradient-${timeLeft}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={colors.primary} />
                  <stop offset="100%" stopColor={colors.secondary} />
                </linearGradient>
              </defs>
            </svg>

            {/* Contenuto centrale del cerchio */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Numero grande */}
              <span
                className={`font-mono font-black text-5xl ${colors.text}`}
                style={{
                  textShadow: timeLeft <= 5 ? `0 0 20px ${colors.glow}` : 'none'
                }}
              >
                {timeLeft}
              </span>
              {/* Label secondi */}
              <span className="text-gray-400 text-xs uppercase tracking-wider mt-1">
                secondi
              </span>
            </div>
          </div>

          {/* Barra progress lineare sotto il cerchio */}
          <div className="w-full mt-4">
            <div className="h-2 bg-surface-400/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${colors.secondary}, ${colors.primary})`,
                  boxShadow: timeLeft <= 10 ? `0 0 10px ${colors.glow}` : 'none'
                }}
              />
            </div>
          </div>

          {/* Icona martelletto animata negli ultimi secondi */}
          {timeLeft <= 10 && timeLeft > 0 && (
            <div className={`mt-3 ${timeLeft <= 5 ? 'animate-bounce' : 'animate-pulse'}`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`w-8 h-8 ${colors.text}`}
              >
                <path d="M15.75 8.25a.75.75 0 01.75.75c0 1.12-.492 2.126-1.27 2.812l-.97.873.97.873A3.99 3.99 0 0116.5 16.5a.75.75 0 01-1.5 0 2.5 2.5 0 00-.794-1.836l-1.706-1.533-1.706 1.533A2.5 2.5 0 0010 16.5a.75.75 0 01-1.5 0c0-1.12.492-2.126 1.27-2.812l.97-.873-.97-.873A3.99 3.99 0 018.5 9a.75.75 0 011.5 0c0 .702.29 1.336.757 1.79l1.743 1.566 1.743-1.566A2.5 2.5 0 0015 9a.75.75 0 01.75-.75z"/>
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z" clipRule="evenodd"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Effetto particelle/scintille negli ultimi 5 secondi */}
      {timeLeft <= 5 && timeLeft > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="absolute top-0 left-1/4 w-1 h-1 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0s' }} />
          <div className="absolute top-1/4 right-0 w-1 h-1 bg-orange-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
          <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
          <div className="absolute top-1/2 left-0 w-1 h-1 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
        </div>
      )}
    </div>
  )
}

export default AuctionTimer
