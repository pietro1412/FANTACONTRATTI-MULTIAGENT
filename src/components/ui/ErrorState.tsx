import { Button } from './Button'

interface ErrorStateProps {
  icon?: string
  title?: string
  /** Error message to display. */
  message?: string
  /** When provided, shows a "Riprova" button that calls this handler. */
  onRetry?: () => void
  retryLabel?: string
  /** Optional extra action rendered next to the retry button. */
  action?: React.ReactNode
  compact?: boolean
  /** Whether the retry action is in progress (disables the button). */
  isRetrying?: boolean
}

/**
 * Section/page-level error state with an optional retry action.
 * Counterpart to EmptyState, for failed loads instead of empty results.
 */
export function ErrorState({
  icon = '⚠️',
  title = 'Qualcosa è andato storto',
  message,
  onRetry,
  retryLabel = 'Riprova',
  action,
  compact = false,
  isRetrying = false,
}: ErrorStateProps) {
  return (
    <div
      className={`bg-surface-200 rounded-xl border border-danger-500/30 text-center ${compact ? 'p-6' : 'p-12'}`}
      role="alert"
    >
      <div className={`${compact ? 'text-3xl' : 'text-4xl'} mb-3`} aria-hidden="true">{icon}</div>
      <p className={`${compact ? 'text-sm' : 'text-base'} text-gray-200 font-semibold`}>{title}</p>
      {message && (
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">{message}</p>
      )}
      {(onRetry || action) && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {onRetry && (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'md'}
              onClick={onRetry}
              disabled={isRetrying}
              isLoading={isRetrying}
              loadingText="Riprovo..."
            >
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

export default ErrorState
