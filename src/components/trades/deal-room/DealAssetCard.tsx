import { getPlayerPhotoUrl } from '@/utils/player-images'
import { ContractInline } from '@/components/ui/ContractInline'
import { POSITION_GRADIENTS } from '../../ui/PositionBadge'
import { getAgeColor } from '../utils'
import { NOT_DISPONIBILE } from '@/utils/stat-format'
import type { RosterEntry } from '../types'

interface DealAssetCardProps {
  entry: RosterEntry
  isSelected: boolean
  onToggle: () => void
  side: 'mine' | 'partner'
  onViewStats?: (entry: RosterEntry) => void
}

const SIDE_STYLES = {
  mine: {
    selected: 'bg-danger-500/15 border-l-2 border-danger-500',
    check: 'text-danger-400',
  },
  partner: {
    selected: 'bg-primary-500/15 border-l-2 border-primary-500',
    check: 'text-primary-400',
  },
}

export function DealAssetCard({ entry, isSelected, onToggle, side, onViewStats }: DealAssetCardProps) {
  const p = entry.player
  const gradient = POSITION_GRADIENTS[p.position] || 'from-gray-500 to-gray-600'
  const styles = SIDE_STYLES[side]

  return (
    <div
      onClick={onToggle}
      className={`px-3 py-3 cursor-pointer hover:bg-surface-100 transition-colors flex items-center justify-between border-b border-surface-50/40 ${
        isSelected ? styles.selected : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Always-visible checkbox */}
        <div className="flex-shrink-0">
          {isSelected ? (
            <svg className={`w-4 h-4 ${styles.check}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-surface-50" />
          )}
        </div>

        {/* Player photo with position badge */}
        <div className="relative flex-shrink-0">
          {p.apiFootballId ? (
            <img
              src={getPlayerPhotoUrl(p.apiFootballId)}
              alt={p.name}
              className="w-10 h-10 rounded-full object-cover bg-surface-300 border-2 border-surface-50/20"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} items-center justify-center text-xs font-bold text-white ${p.apiFootballId ? 'hidden' : 'flex'}`}
          >
            {p.position}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-[9px] border border-surface-200`}
          >
            {p.position}
          </span>
        </div>

        {/* Name + team/age */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewStats?.(entry) }}
            className="text-white text-sm font-semibold block truncate hover:text-primary-400 transition-colors text-left"
          >
            {p.name}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="truncate">{p.team}</span>
            <span className={p.age != null ? getAgeColor(p.age) : 'text-gray-500'}>
              · {p.age != null ? `${p.age}a` : NOT_DISPONIBILE}
            </span>
          </div>
        </div>
      </div>

      {/* Contract info: ingaggio + durata with labels (Axiom 9) */}
      <div className="flex-shrink-0 ml-2">
        {p.contract ? (
          <ContractInline salary={p.contract.salary} duration={p.contract.duration} variant="compact" className="justify-end text-xs" />
        ) : (
          <span className="text-gray-500 text-sm">-</span>
        )}
      </div>
    </div>
  )
}
