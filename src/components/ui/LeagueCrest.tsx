import { memo } from 'react'

// ---- Identità lega: monogramma + colore deterministico dal nome ----
// Fonte unica condivisa da Dashboard, Hub Lega (LeagueDetail) e Navigation.
const IDENTITY_GRADIENTS = [
  'from-primary-500 to-indigo-600',
  'from-secondary-500 to-emerald-700',
  'from-accent-500 to-amber-700',
  'from-rose-500 to-red-700',
  'from-violet-500 to-purple-700',
  'from-cyan-500 to-blue-700',
]

export interface LeagueIdentity {
  initials: string
  gradient: string
}

export function getLeagueIdentity(name: string): LeagueIdentity {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  const second = words[1] ?? ''
  const initials = (words.length >= 2 ? first.charAt(0) + second.charAt(0) : name.slice(0, 2)).toUpperCase()
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const gradient = IDENTITY_GRADIENTS[hash % IDENTITY_GRADIENTS.length] ?? 'from-primary-500 to-indigo-600'
  return { initials, gradient }
}

type CrestSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<CrestSize, string> = {
  sm: 'w-9 h-9 text-xs rounded-lg',
  md: 'w-11 h-11 text-sm rounded-xl',
  lg: 'w-12 h-12 sm:w-16 sm:h-16 text-2xl sm:text-3xl rounded-xl',
}

export interface LeagueCrestProps {
  /** Nome della lega: serve sia per il monogramma sia per il gradient deterministico. */
  name: string
  /** Logo caricato (se presente vince sul monogramma). */
  imageUrl?: string | null
  size?: CrestSize
  className?: string
}

/** Crest della lega: logo caricato o, in fallback, monogramma + gradient deterministico dal nome. */
export const LeagueCrest = memo(function LeagueCrest({ name, imageUrl, size = 'md', className = '' }: LeagueCrestProps) {
  const dim = SIZE_CLASSES[size]

  if (imageUrl) {
    return (
      <div className={`${dim} overflow-hidden flex-shrink-0 shadow-lg ${className}`}>
        <img src={imageUrl} alt={`Logo ${name}`} className="w-full h-full object-cover" />
      </div>
    )
  }

  const { initials, gradient } = getLeagueIdentity(name)
  return (
    <div
      className={`${dim} bg-gradient-to-br ${gradient} flex items-center justify-center font-display font-bold text-white flex-shrink-0 shadow-lg ${className}`}
    >
      {initials}
    </div>
  )
})
