import { useState } from 'react'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  description?: string
  progress?: number // 0-100
  progressColor?: string
  trend?: { value: number; label: string }
  icon?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const VARIANT_STYLES = {
  default: 'border-surface-50/10',
  success: 'border-green-500/20',
  warning: 'border-amber-500/20',
  danger: 'border-danger-500/20',
}

const VALUE_STYLES = {
  default: 'text-white',
  success: 'text-green-400',
  warning: 'text-amber-400',
  danger: 'text-danger-400',
}

export function KPICard({ title, value, subtitle, description, progress, progressColor, trend, variant = 'default' }: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className={`bg-surface-300/50 rounded-lg p-3 md:p-4 border ${VARIANT_STYLES[variant]}`}>
      <div className="flex items-center gap-1 mb-1">
        <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">{title}</div>
        {description && (
          <div className="relative">
            <button
              className="text-gray-500 hover:text-gray-300 transition-colors"
              onMouseEnter={() => { setShowTooltip(true); }}
              onMouseLeave={() => { setShowTooltip(false); }}
              onClick={() => { setShowTooltip(prev => !prev); }}
              aria-label={`Info: ${title}`}
            >
              <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 md:w-64 p-2.5 bg-surface-100 border border-surface-50/30 rounded-lg shadow-xl text-[10px] md:text-xs text-gray-300 leading-relaxed">
                {description}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="w-2 h-2 bg-surface-100 border-r border-b border-surface-50/30 transform rotate-45" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`text-lg md:text-2xl font-bold ${VALUE_STYLES[variant]}`}>{value}</div>
      {subtitle && (
        <div className="text-[10px] md:text-xs text-gray-500 mt-0.5">{subtitle}</div>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-surface-100/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor || 'bg-primary-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {trend && (
        <div className={`text-[10px] md:text-xs mt-1 flex items-center gap-1 ${trend.value > 0 ? 'text-green-400' : trend.value < 0 ? 'text-danger-400' : 'text-gray-500'}`}>
          <span>{trend.value > 0 ? '\u25B2' : trend.value < 0 ? '\u25BC' : '\u2501'}</span>
          <span>{trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}</span>
        </div>
      )}
    </div>
  )
}

// Reusable info tooltip for section headers
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex items-center gap-1.5 mb-3">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">
        {title}
      </div>
      {description && (
        <div className="relative">
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors"
            onMouseEnter={() => { setShowTooltip(true); }}
            onMouseLeave={() => { setShowTooltip(false); }}
            onClick={() => { setShowTooltip(prev => !prev); }}
            aria-label={`Info: ${title}`}
          >
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
          {showTooltip && (
            <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 md:w-72 p-2.5 bg-surface-100 border border-surface-50/30 rounded-lg shadow-xl text-[10px] md:text-xs text-gray-300 leading-relaxed">
              {description}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                <div className="w-2 h-2 bg-surface-100 border-r border-b border-surface-50/30 transform rotate-45" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
