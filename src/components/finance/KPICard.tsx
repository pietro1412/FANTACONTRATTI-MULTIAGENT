import { InfoTooltip } from '@/components/ui/InfoTooltip'

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
  return (
    <div className={`bg-surface-300/50 rounded-lg p-3 md:p-4 border ${VARIANT_STYLES[variant]}`}>
      <div className="flex items-center gap-1 mb-1">
        <div className="micro-label">{title}</div>
        {description && <InfoTooltip content={description} label={title} />}
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

// Section title with descriptive subtitle (replaces uniform micro-uppercase titles)
export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-[17px] font-bold leading-snug text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
  )
}

// Reusable info tooltip for section headers
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">
        {title}
      </div>
      {description && <InfoTooltip content={description} label={title} />}
    </div>
  )
}
