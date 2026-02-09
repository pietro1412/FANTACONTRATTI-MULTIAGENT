import type { ReactNode } from 'react'

interface StickyActionBarProps {
  children: ReactNode
  className?: string
}

/**
 * Sticky action bar fixed at the bottom of the screen.
 * On mobile (<md), sits above the BottomNavBar (bottom-14).
 * On desktop (md+), sits at bottom-0.
 * Includes safe-area-inset-bottom for notched devices.
 */
export function StickyActionBar({ children, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`fixed left-0 right-0 bottom-14 md:bottom-0 z-40 bg-gradient-to-r from-surface-200 via-surface-200 to-surface-200 border-t-2 border-primary-500/50 shadow-lg shadow-black/30 ${className}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {children}
    </div>
  )
}

export default StickyActionBar
