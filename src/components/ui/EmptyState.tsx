interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}

export function EmptyState({ icon = '📭', title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`bg-surface-200 rounded-xl border border-surface-50/20 text-center ${compact ? 'p-6' : 'p-12'}`}>
      <div className={`${compact ? 'text-3xl' : 'text-4xl'} mb-3 opacity-50`}>{icon}</div>
      <p className={`${compact ? 'text-sm' : 'text-base'} text-gray-400 font-medium`}>{title}</p>
      {description && (
        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
