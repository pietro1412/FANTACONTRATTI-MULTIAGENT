import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/Card'

describe('Card', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card Content</Card>)
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('renders as a div element', () => {
      render(<Card data-testid="card">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.tagName).toBe('DIV')
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      render(<Card ref={ref}>Content</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('variants', () => {
    it('renders default variant by default', () => {
      render(<Card data-testid="card">Default</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-surface-200')
      expect(card.className).toContain('shadow-card')
    })

    it('renders dark variant correctly', () => {
      render(<Card data-testid="card" variant="dark">Dark</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-surface-300')
    })

    it('renders glow variant correctly', () => {
      render(<Card data-testid="card" variant="glow">Glow</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('border-primary-500/30')
      expect(card.className).toContain('hover:shadow-glow')
    })

    it('renders elevated variant correctly', () => {
      render(<Card data-testid="card" variant="elevated">Elevated</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-gradient-to-b')
      expect(card.className).toContain('hover:-translate-y-1')
    })

    it('renders outlined variant correctly', () => {
      render(<Card data-testid="card" variant="outlined">Outlined</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-transparent')
      expect(card.className).toContain('border-2')
    })

    it('renders glass variant correctly', () => {
      render(<Card data-testid="card" variant="glass">Glass</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('backdrop-blur-xl')
    })

    it('renders interactive variant correctly', () => {
      render(<Card data-testid="card" variant="interactive">Interactive</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('cursor-pointer')
      expect(card.className).toContain('select-none')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('padding', () => {
    it('applies large padding by default', () => {
      render(<Card data-testid="card">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('p-6')
    })

    it('removes padding with noPadding prop', () => {
      render(<Card data-testid="card" noPadding>Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).not.toContain('p-6')
      expect(card.className).not.toContain('p-4')
      expect(card.className).not.toContain('p-3')
    })

    it('applies explicit padding sizes correctly', () => {
      const sizes = [
        { size: 'none' as const, expected: '' },
        { size: 'sm' as const, expected: 'p-3' },
        { size: 'md' as const, expected: 'p-4' },
        { size: 'lg' as const, expected: 'p-6' },
        { size: 'xl' as const, expected: 'p-8' },
      ]

      sizes.forEach(({ size, expected }) => {
        const { container } = render(<Card padding={size}>Content</Card>)
        const card = container.firstChild as HTMLElement
        if (expected) {
          expect(card.className).toContain(expected)
        }
      })
    })

    it('explicit padding prop takes precedence over noPadding', () => {
      render(<Card data-testid="card" noPadding padding="md">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('p-4')
    })
  })

  describe('hoverable', () => {
    it('does not apply hover styles by default', () => {
      render(<Card data-testid="card">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).not.toContain('hover:shadow-card-hover')
    })

    it('applies hover styles when hoverable is true', () => {
      render(<Card data-testid="card" hoverable>Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('hover:shadow-card-hover')
      expect(card.className).toContain('hover:-translate-y-1')
      expect(card.className).toContain('cursor-pointer')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<Card data-testid="card" className="custom-class">Content</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('custom-class')
    })
  })

  describe('HTML attributes', () => {
    it('passes through additional HTML attributes', () => {
      render(
        <Card
          data-testid="card"
          id="my-card"
          title="Card Title"
        >
          Content
        </Card>
      )
      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('id', 'my-card')
      expect(card).toHaveAttribute('title', 'Card Title')
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Card.displayName).toBe('Card')
    })
  })
})

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader>Header Content</CardHeader>)
    expect(screen.getByText('Header Content')).toBeInTheDocument()
  })

  it('applies border by default', () => {
    render(<CardHeader data-testid="header">Content</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header.className).toContain('border-b')
  })

  it('removes border when noBorder is true', () => {
    render(<CardHeader data-testid="header" noBorder>Content</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header.className).not.toContain('border-b')
  })

  it('applies custom className', () => {
    render(<CardHeader className="custom-header">Content</CardHeader>)
    const header = screen.getByText('Content')
    expect(header.className).toContain('custom-header')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<CardHeader ref={ref}>Content</CardHeader>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(CardHeader.displayName).toBe('CardHeader')
  })
})

describe('CardTitle', () => {
  it('renders children correctly', () => {
    render(<CardTitle>Title Text</CardTitle>)
    expect(screen.getByText('Title Text')).toBeInTheDocument()
  })

  it('renders as h3 by default', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('renders as specified heading level', () => {
    render(<CardTitle as="h1">H1 Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()

    render(<CardTitle as="h2">H2 Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()

    render(<CardTitle as="h4">H4 Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument()
  })

  it('applies text styles', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)
    const title = screen.getByTestId('title')
    expect(title.className).toContain('text-xl')
    expect(title.className).toContain('font-bold')
    expect(title.className).toContain('text-white')
  })

  it('applies custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>)
    const title = screen.getByText('Title')
    expect(title.className).toContain('custom-title')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<CardTitle ref={ref}>Title</CardTitle>)
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
  })

  it('has correct displayName', () => {
    expect(CardTitle.displayName).toBe('CardTitle')
  })
})

describe('CardDescription', () => {
  it('renders children correctly', () => {
    render(<CardDescription>Description text</CardDescription>)
    expect(screen.getByText('Description text')).toBeInTheDocument()
  })

  it('renders as a paragraph', () => {
    render(<CardDescription>Description</CardDescription>)
    expect(screen.getByText('Description').tagName).toBe('P')
  })

  it('applies text styles', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>)
    const desc = screen.getByTestId('desc')
    expect(desc.className).toContain('text-sm')
    expect(desc.className).toContain('text-gray-400')
  })

  it('applies custom className', () => {
    render(<CardDescription className="custom-desc">Description</CardDescription>)
    const desc = screen.getByText('Description')
    expect(desc.className).toContain('custom-desc')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<CardDescription ref={ref}>Description</CardDescription>)
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement)
  })

  it('has correct displayName', () => {
    expect(CardDescription.displayName).toBe('CardDescription')
  })
})

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content text</CardContent>)
    expect(screen.getByText('Content text')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<CardContent className="custom-content">Content</CardContent>)
    const content = screen.getByText('Content')
    expect(content.className).toContain('custom-content')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<CardContent ref={ref}>Content</CardContent>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(CardContent.displayName).toBe('CardContent')
  })
})

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(
      <CardFooter>
        <button>Action 1</button>
        <button>Action 2</button>
      </CardFooter>
    )
    expect(screen.getByText('Action 1')).toBeInTheDocument()
    expect(screen.getByText('Action 2')).toBeInTheDocument()
  })

  it('applies border and flex styles', () => {
    render(<CardFooter data-testid="footer">Content</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer.className).toContain('border-t')
    expect(footer.className).toContain('flex')
    expect(footer.className).toContain('items-center')
    expect(footer.className).toContain('justify-end')
    expect(footer.className).toContain('gap-3')
  })

  it('applies custom className', () => {
    render(<CardFooter className="custom-footer">Content</CardFooter>)
    const footer = screen.getByText('Content')
    expect(footer.className).toContain('custom-footer')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<CardFooter ref={ref}>Content</CardFooter>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(CardFooter.displayName).toBe('CardFooter')
  })
})

describe('Card composition', () => {
  it('renders full card with all subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>Main content area</CardContent>
        <CardFooter>
          <button>Cancel</button>
          <button>Save</button>
        </CardFooter>
      </Card>
    )
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card description text')).toBeInTheDocument()
    expect(screen.getByText('Main content area')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })
})
