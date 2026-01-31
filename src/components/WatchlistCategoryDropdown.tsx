/**
 * WatchlistCategoryDropdown - Dropdown to assign players to watchlist categories
 *
 * Features:
 * - Shows current category with icon
 * - Click to open category selection menu
 * - Option to remove from all categories
 * - Calls API to save category assignment
 */

import { useState, useRef, useEffect } from 'react'

// Category type definition (matches api.ts)
export interface WatchlistCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  isSystemDefault: boolean
  sortOrder: number
  entryCount?: number
}

// Entry type definition (matches api.ts)
export interface WatchlistEntry {
  id: string
  playerId: string
  categoryId: string
  category?: {
    id: string
    name: string
    icon: string | null
    color: string | null
  }
  addedAt: string
}

interface WatchlistCategoryDropdownProps {
  playerId: string
  currentCategoryId?: string | null
  categories: WatchlistCategory[]
  onSelect: (categoryId: string | null) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

// Default colors for categories
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

// Get colors for a category
function getCategoryColors(color: string): { bg: string; text: string; border: string } {
  return CATEGORY_COLORS[color as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.blue
}

export function WatchlistCategoryDropdown({
  playerId: _playerId,
  currentCategoryId,
  categories,
  onSelect,
  disabled = false,
  size = 'md',
}: WatchlistCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find current category
  const currentCategory = currentCategoryId
    ? categories.find(c => c.id === currentCategoryId)
    : null

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle category selection
  const handleSelect = (categoryId: string | null) => {
    onSelect(categoryId)
    setIsOpen(false)
  }

  const isSmall = size === 'sm'
  const colors = currentCategory ? getCategoryColors(currentCategory.color || 'blue') : null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 rounded-lg border transition-all
          ${isSmall ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}
          ${currentCategory
            ? `${colors?.bg} ${colors?.text} ${colors?.border}`
            : 'bg-surface-300/50 text-gray-400 border-surface-50/30 hover:border-surface-50/50'
          }
        `}
        title={currentCategory ? currentCategory.name : 'Aggiungi a categoria'}
      >
        {currentCategory ? (
          <>
            <span>{currentCategory.icon || '📋'}</span>
            <span className={`${isSmall ? 'max-w-[50px]' : 'max-w-[80px]'} truncate`}>
              {currentCategory.name}
            </span>
          </>
        ) : (
          <>
            <span className="text-gray-500">+</span>
            <span className={`${isSmall ? 'hidden' : ''}`}>Categoria</span>
          </>
        )}
        <svg
          className={`w-3 h-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 w-48 py-1
            bg-surface-200 border border-surface-50/30 rounded-lg shadow-xl
            ${isSmall ? 'right-0' : 'left-0'}
          `}
        >
          {/* Remove option */}
          {currentCategory && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-surface-100/50 transition-colors"
            >
              <span className="text-gray-500">✕</span>
              <span>Rimuovi categoria</span>
            </button>
          )}

          {categories.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">
              Nessuna categoria disponibile
            </div>
          ) : (
            <>
              {/* Divider if we have the remove option */}
              {currentCategory && categories.length > 0 && (
                <div className="my-1 border-t border-surface-50/20" />
              )}

              {/* Category options */}
              {categories.map(category => {
                const catColors = getCategoryColors(category.color || 'blue')
                const isSelected = category.id === currentCategoryId

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleSelect(category.id)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                      ${isSelected
                        ? `${catColors.bg} ${catColors.text}`
                        : 'text-gray-300 hover:bg-surface-100/50'
                      }
                    `}
                  >
                    <span>{category.icon || '📋'}</span>
                    <span className="flex-1 text-left truncate">{category.name}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-current" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for table cells - just shows icon and color badge
 */
export function WatchlistCategoryBadge({
  category,
  onClick,
  size = 'md',
}: {
  category: WatchlistCategory | null
  onClick?: () => void
  size?: 'sm' | 'md'
}) {
  const isSmall = size === 'sm'

  if (!category) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          ${isSmall ? 'w-6 h-6' : 'w-7 h-7'}
          rounded-full bg-surface-300/30 border border-surface-50/20
          flex items-center justify-center
          text-gray-500 hover:text-gray-300 hover:border-surface-50/40
          transition-colors cursor-pointer
        `}
        title="Aggiungi a categoria"
      >
        <span className={isSmall ? 'text-xs' : 'text-sm'}>+</span>
      </button>
    )
  }

  const colors = getCategoryColors(category.color)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        ${isSmall ? 'w-6 h-6' : 'w-7 h-7'}
        rounded-full ${colors.bg} border ${colors.border}
        flex items-center justify-center
        hover:brightness-110 transition-all cursor-pointer
      `}
      title={category.name}
    >
      <span className={isSmall ? 'text-xs' : 'text-sm'}>{category.icon}</span>
    </button>
  )
}

export default WatchlistCategoryDropdown
