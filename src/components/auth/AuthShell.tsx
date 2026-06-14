import type { ReactNode } from 'react'

type BrandVariant = 'pitch' | 'gold'

interface AuthShellProps {
  /** Card content (form, success card, etc.). */
  children: ReactNode
  /** Brand logo emoji. Default ⚽ (Register uses 🏆). */
  logo?: string
  /** Logo gradient variant: green pitch (default) or gold (Register). */
  brandVariant?: BrandVariant
  /** Optional extra node rendered above the card (e.g. invite banner). */
  beforeCard?: ReactNode
  /** Optional extra node rendered below the card, inside the centered column (e.g. rules link). */
  afterCard?: ReactNode
}

const logoStyles: Record<BrandVariant, string> = {
  pitch: 'bg-gradient-to-br from-secondary-700 to-secondary-500 border-secondary-500/50 shadow-glow',
  gold: 'bg-gradient-to-br from-accent-600 to-accent-500 border-accent-500/50 shadow-glow-gold',
}

/**
 * Shared wrapper for the public auth pages (Login / Register / ForgotPassword / ResetPassword).
 * Single scaffold: pitch-overlay background, brand logo, card surface, footer with dynamic year.
 */
export function AuthShell({
  children,
  logo = '⚽',
  brandVariant = 'pitch',
  beforeCard,
  afterCard,
}: AuthShellProps) {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="absolute inset-0 pitch-overlay opacity-30" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2.5 mb-6">
          <div
            className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${logoStyles[brandVariant]}`}
            aria-hidden="true"
          >
            {logo}
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            FantaContratti
          </span>
        </div>

        {beforeCard}

        {/* Card */}
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6 sm:p-7 shadow-2xl">
          {children}
        </div>

        {afterCard}

        {/* Footer with dynamic year */}
        <p className="text-center text-xs text-gray-500 mt-5">
          <span className="font-mono tracking-wide">© {year} FantaContratti</span>
        </p>
      </div>
    </div>
  )
}
