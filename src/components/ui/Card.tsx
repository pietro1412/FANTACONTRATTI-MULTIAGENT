import { forwardRef, type ReactNode, type HTMLAttributes } from 'react'

type CardVariant = 'default' | 'dark' | 'glow' | 'elevated' | 'outlined' | 'glass' | 'interactive'
type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  variant?: CardVariant
  hoverable?: boolean
  noPadding?: boolean
  padding?: CardPadding
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = '',
      variant = 'default',
      hoverable = false,
      noPadding = false,
      padding,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      rounded-xl transition-all duration-300 ease-out
    `.replace(/\s+/g, ' ').trim()

    const variants: Record<CardVariant, string> = {
      default: `
        bg-surface-200 border border-surface-50/20 shadow-card
      `.replace(/\s+/g, ' ').trim(),
      dark: `
        bg-surface-300 border border-surface-50/10 shadow-card
      `.replace(/\s+/g, ' ').trim(),
      glow: `
        bg-surface-200 border border-primary-500/30
        hover:border-primary-400/50 hover:shadow-glow
        shadow-[0_0_15px_rgba(49,151,149,0.15)]
      `.replace(/\s+/g, ' ').trim(),
      elevated: `
        bg-gradient-to-b from-surface-100 to-surface-200
        border border-surface-50/30
        shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset]
        hover:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset]
        hover:-translate-y-1
      `.replace(/\s+/g, ' ').trim(),
      outlined: `
        bg-transparent border-2 border-surface-50/40
        hover:border-surface-50/60
      `.replace(/\s+/g, ' ').trim(),
      glass: `
        bg-surface-200/30 backdrop-blur-xl border border-white/10
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]
      `.replace(/\s+/g, ' ').trim(),
      interactive: `
        bg-surface-200 border border-surface-50/20 shadow-card
        cursor-pointer select-none
        hover:bg-surface-100 hover:border-surface-50/40
        hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]
        hover:-translate-y-0.5
        active:translate-y-0 active:shadow-card
      `.replace(/\s+/g, ' ').trim(),
    }

    const paddingSizes: Record<CardPadding, string> = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    }

    const hoverStyles = hoverable
      ? 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer'
      : ''

    // Determine padding: explicit padding prop > noPadding flag > default 'lg'
    const getPaddingStyles = () => {
      if (padding !== undefined) {
        return paddingSizes[padding]
      }
      return noPadding ? '' : paddingSizes.lg
    }

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${getPaddingStyles()} ${className}`}
        role={variant === 'interactive' ? 'button' : undefined}
        tabIndex={variant === 'interactive' ? 0 : undefined}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  noBorder?: boolean
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', noBorder = false, ...props }, ref) => {
    const borderStyles = noBorder ? '' : 'pb-4 border-b border-surface-50/20'

    return (
      <div ref={ref} className={`mb-4 ${borderStyles} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', as: Tag = 'h3', ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={`text-xl font-bold text-white tracking-tight ${className}`}
        {...props}
      >
        {children}
      </Tag>
    )
  }
)

CardTitle.displayName = 'CardTitle'

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
  className?: string
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <p ref={ref} className={`text-sm text-gray-400 mt-1 ${className}`} {...props}>
        {children}
      </p>
    )
  }
)

CardDescription.displayName = 'CardDescription'

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    )
  }
)

CardContent.displayName = 'CardContent'

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 pt-4 border-t border-surface-50/20 flex items-center justify-end gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardFooter.displayName = 'CardFooter'

// Default export for backward compatibility
export default Card
