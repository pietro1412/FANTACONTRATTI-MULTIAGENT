import { type ReactNode } from 'react'

type TabAccent = 'primary' | 'accent' | 'secondary' | 'gray'

export interface TabItem {
  id: string
  label: string
  /** Shorter label shown on mobile (< sm). Falls back to `label`. */
  mobileLabel?: string
  icon?: ReactNode
  /** Numeric badge (e.g. count); hidden when 0/undefined. */
  badge?: number
  /** Active-state accent color. Defaults to 'primary'. */
  accent?: TabAccent
}

interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  /** aria-label for the tablist. */
  ariaLabel?: string
}

const activeText: Record<TabAccent, string> = {
  primary: 'border-primary-500 text-primary-400',
  accent: 'border-accent-500 text-accent-400',
  secondary: 'border-secondary-500 text-secondary-400',
  gray: 'border-gray-400 text-gray-300',
}

const activeBadge: Record<TabAccent, string> = {
  primary: 'bg-primary-500/20 text-primary-400',
  accent: 'bg-accent-500/20 text-accent-400',
  secondary: 'bg-secondary-500/20 text-secondary-400',
  gray: 'bg-gray-500/20 text-gray-300',
}

/**
 * Underline tab bar. Controlled component: pass `value` + `onChange`.
 * Mirrors the existing project tab styling (border-b-2 underline, optional
 * icon + numeric badge, per-tab accent color, responsive label).
 */
export function Tabs({ tabs, value, onChange, className = '', ariaLabel }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 border-b border-surface-50/20 ${className}`}
    >
      {tabs.map((tab) => {
        const accent = tab.accent ?? 'primary'
        const isActive = value === tab.id
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => { onChange(tab.id); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm md:text-base font-semibold border-b-2 transition-colors ${
              isActive ? activeText[accent] : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.mobileLabel ? (
              <>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.mobileLabel}</span>
              </>
            ) : (
              <span>{tab.label}</span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? activeBadge[accent] : 'bg-surface-300 text-gray-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
