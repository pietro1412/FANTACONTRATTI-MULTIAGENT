import { memo } from 'react'

export interface CircularTimerProps {
  seconds: number
  totalSeconds: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { px: 32, stroke: 3, fontSize: 'text-xs' },
  md: { px: 48, stroke: 4, fontSize: 'text-sm' },
  lg: { px: 64, stroke: 5, fontSize: 'text-lg' },
} as const

export const CircularTimer = memo(function CircularTimer({
  seconds,
  totalSeconds,
  size = 'md',
  className = '',
}: CircularTimerProps) {
  const { px, stroke, fontSize } = SIZES[size]
  const radius = (px - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalSeconds > 0 ? Math.max(0, seconds / totalSeconds) : 0
  const dashOffset = circumference * (1 - progress)

  const color =
    seconds > 10 ? 'text-secondary-400 stroke-secondary-400' :
    seconds > 5 ? 'text-warning-400 stroke-warning-400' :
    'text-danger-400 stroke-danger-400'

  return (
    <div
      className={`relative inline-flex items-center justify-center ${seconds <= 5 ? 'animate-pulse' : ''} ${className}`}
      style={{ width: px, height: px }}
      role="timer"
      aria-label={`${seconds} secondi rimanenti`}
      aria-live={seconds <= 10 ? 'assertive' : 'off'}
    >
      <svg width={px} height={px} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-50/20"
        />
        {/* Progress circle */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      {/* Center text */}
      <span className={`absolute font-mono font-bold tabular-nums ${fontSize} ${color.split(' ')[0]}`}>
        {seconds}
      </span>
    </div>
  )
})
