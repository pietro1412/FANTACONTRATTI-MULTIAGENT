import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../components/ui/Badge'

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>)
      expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    it('renders as a span element', () => {
      render(<Badge data-testid="badge">Content</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.tagName).toBe('SPAN')
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      render(<Badge ref={ref}>Test</Badge>)
      expect(ref.current).toBeInstanceOf(HTMLSpanElement)
    })
  })

  describe('variants', () => {
    it('renders default variant by default', () => {
      render(<Badge data-testid="badge">Default</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-surface-200')
      expect(badge.className).toContain('text-gray-300')
    })

    it('renders success variant correctly', () => {
      render(<Badge data-testid="badge" variant="success">Success</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-secondary-500/20')
      expect(badge.className).toContain('text-secondary-400')
    })

    it('renders warning variant correctly', () => {
      render(<Badge data-testid="badge" variant="warning">Warning</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-accent-500/20')
      expect(badge.className).toContain('text-accent-400')
    })

    it('renders danger variant correctly', () => {
      render(<Badge data-testid="badge" variant="danger">Danger</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-danger-500/20')
      expect(badge.className).toContain('text-danger-400')
    })

    it('renders info variant correctly', () => {
      render(<Badge data-testid="badge" variant="info">Info</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-primary-500/20')
      expect(badge.className).toContain('text-primary-400')
    })
  })

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(<Badge data-testid="badge">Medium</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('px-2.5')
      expect(badge.className).toContain('py-1')
      expect(badge.className).toContain('text-sm')
    })

    it('renders small size correctly', () => {
      render(<Badge data-testid="badge" size="sm">Small</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('px-2')
      expect(badge.className).toContain('py-0.5')
      expect(badge.className).toContain('text-xs')
    })
  })

  describe('pill option', () => {
    it('renders with rounded-md by default', () => {
      render(<Badge data-testid="badge">Default</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('rounded-md')
    })

    it('renders with rounded-full when pill is true', () => {
      render(<Badge data-testid="badge" pill>Pill</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('rounded-full')
    })
  })

  describe('dot indicator', () => {
    it('does not render dot by default', () => {
      render(<Badge data-testid="badge">No Dot</Badge>)
      const badge = screen.getByTestId('badge')
      const dot = badge.querySelector('[aria-hidden="true"]')
      expect(dot).toBeNull()
    })

    it('renders dot when dot prop is true', () => {
      render(<Badge data-testid="badge" dot>With Dot</Badge>)
      const badge = screen.getByTestId('badge')
      const dot = badge.querySelector('[aria-hidden="true"]')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveClass('rounded-full', 'animate-pulse')
    })

    it('renders correct dot color for each variant', () => {
      const variants = [
        { variant: 'default' as const, color: 'bg-gray-400' },
        { variant: 'success' as const, color: 'bg-secondary-400' },
        { variant: 'warning' as const, color: 'bg-accent-400' },
        { variant: 'danger' as const, color: 'bg-danger-400' },
        { variant: 'info' as const, color: 'bg-primary-400' },
      ]

      variants.forEach(({ variant, color }) => {
        const { container } = render(<Badge variant={variant} dot>Test</Badge>)
        const dot = container.querySelector('[aria-hidden="true"]')
        expect(dot).toHaveClass(color)
      })
    })

    it('renders correct dot size based on badge size', () => {
      const { container: smContainer } = render(<Badge size="sm" dot>Small</Badge>)
      const smDot = smContainer.querySelector('[aria-hidden="true"]')
      expect(smDot).toHaveClass('w-1.5', 'h-1.5')

      const { container: mdContainer } = render(<Badge size="md" dot>Medium</Badge>)
      const mdDot = mdContainer.querySelector('[aria-hidden="true"]')
      expect(mdDot).toHaveClass('w-2', 'h-2')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<Badge data-testid="badge" className="custom-class">Custom</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('custom-class')
    })
  })

  describe('HTML attributes', () => {
    it('passes through additional HTML attributes', () => {
      render(
        <Badge
          data-testid="badge"
          id="my-badge"
          title="Badge Title"
        >
          Content
        </Badge>
      )
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveAttribute('id', 'my-badge')
      expect(badge).toHaveAttribute('title', 'Badge Title')
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Badge.displayName).toBe('Badge')
    })
  })
})
