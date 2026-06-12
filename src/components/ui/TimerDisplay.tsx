import { memo } from 'react'

export interface TimerDisplayProps {
  /** Secondi rimanenti (null = timer non attivo) */
  seconds: number | null
  /** Durata totale: se presente, l'anello mostra l'avanzamento (solo variant ring) */
  totalSeconds?: number
  /** Dimensione del numerone in px — P1: 40 (asta) / 44 (rubata) */
  size?: 40 | 44
  /** ring = numerone dentro anello sottile (arena) · flat = pillola piatta (testata) */
  variant?: 'ring' | 'flat'
  /** Sotto questa soglia il timer passa al rosso (default 10s) */
  criticalThreshold?: number
  className?: string
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * P1 — Timer condiviso asta/rubata: numerone Oswald oro tabulare (`.timer-sport`)
 * dentro un anello sottile SVG (o pillola piatta), rosso sotto soglia critica.
 * Stessa veste nelle due sale; cambia solo posizione e dimensione.
 */
export const TimerDisplay = memo(function TimerDisplay({
  seconds,
  totalSeconds,
  size = 44,
  variant = 'ring',
  criticalThreshold = 10,
  className = '',
}: TimerDisplayProps) {
  if (seconds === null) return null

  const critical = seconds < criticalThreshold
  const display = formatTimer(seconds)
  const numberClass = `timer-sport leading-none tabular-nums ${
    critical ? 'text-danger-400' : 'text-accent-400'
  }`
  const aria = {
    role: 'timer' as const,
    'aria-live': critical ? ('assertive' as const) : ('off' as const),
    'aria-label': `${seconds} secondi rimanenti`,
  }

  if (variant === 'flat') {
    return (
      <span
        {...aria}
        className={`inline-flex items-center rounded-[10px] border px-3.5 py-0.5 ${
          critical
            ? 'border-danger-500/50 bg-danger-500/[0.06]'
            : 'border-accent-500/45 bg-accent-500/[0.06]'
        } ${className}`}
      >
        <span className={numberClass} style={{ fontSize: size }}>{display}</span>
      </span>
    )
  }

  // Ring: diametro proporzionato al numerone (mockup: 44px → 92px)
  const diameter = size === 44 ? 92 : 84
  const radius = (diameter - 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalSeconds && totalSeconds > 0
    ? Math.max(0, Math.min(1, seconds / totalSeconds))
    : 1

  return (
    <span
      {...aria}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 ${
        critical
          ? 'bg-danger-500/[0.06] shadow-[0_0_0_4px_rgba(239,68,68,0.09),0_0_18px_rgba(239,68,68,0.25)]'
          : 'bg-accent-500/5 shadow-[0_0_0_4px_rgba(245,158,11,0.07)]'
      } ${className}`}
      style={{ width: diameter, height: diameter }}
    >
      <svg
        width={diameter}
        height={diameter}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={critical ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}
          strokeWidth={2}
        />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={critical ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.45)'}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease' }}
        />
      </svg>
      <span className={numberClass} style={{ fontSize: size }}>{display}</span>
    </span>
  )
})
