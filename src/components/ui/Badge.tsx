import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  pill?: boolean
  dot?: boolean
  className?: string
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      pill = false,
      dot = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-semibold
      transition-all duration-200 ease-out
    `.replace(/\s+/g, ' ').trim()

    const variants: Record<BadgeVariant, string> = {
      default: `
        bg-surface-200 text-gray-300 border border-surface-50/30
      `.replace(/\s+/g, ' ').trim(),
      success: `
        bg-secondary-500/20 text-secondary-400 border border-secondary-500/30
      `.replace(/\s+/g, ' ').trim(),
      warning: `
        bg-accent-500/20 text-accent-400 border border-accent-500/30
      `.replace(/\s+/g, ' ').trim(),
      danger: `
        bg-danger-500/20 text-danger-400 border border-danger-500/30
      `.replace(/\s+/g, ' ').trim(),
      info: `
        bg-primary-500/20 text-primary-400 border border-primary-500/30
      `.replace(/\s+/g, ' ').trim(),
    }

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-xs gap-1',
      md: 'px-2.5 py-1 text-sm gap-1.5',
    }

    const dotColors: Record<BadgeVariant, string> = {
      default: 'bg-gray-400',
      success: 'bg-secondary-400',
      warning: 'bg-accent-400',
      danger: 'bg-danger-400',
      info: 'bg-primary-400',
    }

    const dotSizes: Record<BadgeSize, string> = {
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2',
    }

    const borderRadius = pill ? 'rounded-full' : 'rounded-md'

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${borderRadius} ${className}`}
        {...props}
      >
        {dot && (
          <span
            className={`${dotSizes[size]} ${dotColors[variant]} rounded-full animate-pulse`}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export default Badge
