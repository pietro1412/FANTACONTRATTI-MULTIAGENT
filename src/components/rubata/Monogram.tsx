import { memo } from 'react'

export interface MonogramProps {
  name: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
} as const

/** Monogramma circolare con le iniziali di un manager (stile mockup v2). */
export const Monogram = memo(function Monogram({ name, size = 'sm', className = '' }: MonogramProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-surface-100 border border-surface-50/40 font-display font-bold text-gray-200 flex-shrink-0 ${SIZES[size]} ${className}`}
    >
      {initials}
    </span>
  )
})
