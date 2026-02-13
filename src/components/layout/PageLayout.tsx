import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

interface PageLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  icon?: string
  backLabel?: string
  onBack?: () => void
  rightContent?: ReactNode
}

export function PageLayout({
  children,
  title,
  subtitle,
  icon = '📋',
  backLabel = 'Indietro',
  onBack,
  rightContent,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {onBack && (
            <button
              onClick={onBack}
              className="text-primary-400 hover:text-primary-300 text-base mb-3 flex items-center gap-2 transition-colors"
            >
              <span>←</span> {backLabel}
            </button>
          )}
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-3xl">{icon}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
              </div>
            </div>
            {rightContent}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}

// Loading state component
export function PageLoading({ message = 'Caricamento...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-lg text-gray-400">{message}</p>
      </div>
    </div>
  )
}

// Error state component
export function PageError({ message = 'Si è verificato un errore', onBack }: { message?: string; onBack?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-xl text-danger-400 mb-4">{message}</p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Torna indietro
          </Button>
        )}
      </div>
    </div>
  )
}

// Section card component
export function SectionCard({
  children,
  title,
  icon,
  headerRight,
  className = '',
  variant = 'default',
}: {
  children: ReactNode
  title?: string
  icon?: string
  headerRight?: ReactNode
  className?: string
  variant?: 'default' | 'amber' | 'blue' | 'emerald' | 'red' | 'primary'
}) {
  const variants = {
    default: 'border-surface-50/20',
    amber: 'border-amber-500/30',
    blue: 'border-blue-500/30',
    emerald: 'border-emerald-500/30',
    red: 'border-red-500/30',
    primary: 'border-primary-500/30',
  }

  return (
    <div className={`bg-surface-200 rounded-xl border ${variants[variant]} overflow-hidden ${className}`}>
      {title && (
        <div className="p-5 border-b border-surface-50/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <span className="text-xl">{icon}</span>}
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          {headerRight}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

// Stat box component
export function StatBox({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number
  variant?: 'default' | 'accent' | 'primary' | 'success'
}) {
  const valueColors = {
    default: 'text-white',
    accent: 'text-accent-400',
    primary: 'text-primary-400',
    success: 'text-secondary-400',
  }

  return (
    <div className="bg-surface-300 rounded-lg p-4 text-center border border-surface-50/20">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColors[variant]}`}>{value}</p>
    </div>
  )
}
