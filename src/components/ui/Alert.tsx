import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant: AlertVariant
  children: ReactNode
  onClose?: () => void
  className?: string
}

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
}

const VARIANT_ICONS: Record<AlertVariant, ReactNode> = {
  error: <AlertCircle size={18} aria-hidden="true" />,
  success: <CheckCircle size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant, children, onClose, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={variant === 'error' ? 'alert' : 'status'}
        className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${VARIANT_STYLES[variant]} ${className}`}
        {...props}
      >
        <span className="flex-shrink-0 mt-0.5">{VARIANT_ICONS[variant]}</span>
        <div className="flex-1 text-sm">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Chiudi"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }
)

Alert.displayName = 'Alert'

export default Alert
