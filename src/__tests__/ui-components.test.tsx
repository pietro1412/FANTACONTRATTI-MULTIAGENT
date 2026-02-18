import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/Card'
import { Input } from '../components/ui/Input'

// ============================================================================
// BUTTON COMPONENT TESTS
// ============================================================================
describe('Button', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('renders with default props', () => {
      render(<Button>Default Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('renders with custom className', () => {
      render(<Button className="custom-class">Button</Button>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('forwards ref correctly', () => {
      const ref = createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Button</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('has displayName set', () => {
      expect(Button.displayName).toBe('Button')
    })
  })

  describe('Variants', () => {
    const variants = ['primary', 'secondary', 'danger', 'ghost', 'outline', 'accent'] as const

    variants.forEach((variant) => {
      it(`renders ${variant} variant correctly`, () => {
        render(<Button variant={variant}>{variant} Button</Button>)
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
        // Each variant should have the focus-visible:ring class
        expect(button.className).toContain('focus-visible:ring')
      })
    })
  })

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const

    sizes.forEach((size) => {
      it(`renders ${size} size correctly`, () => {
        render(<Button size={size}>{size} Button</Button>)
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
      })
    })

    it('applies sm size classes', () => {
      render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button').className).toContain('px-4')
      expect(screen.getByRole('button').className).toContain('py-2')
      expect(screen.getByRole('button').className).toContain('text-sm')
    })

    it('applies md size classes', () => {
      render(<Button size="md">Medium</Button>)
      expect(screen.getByRole('button').className).toContain('px-5')
      expect(screen.getByRole('button').className).toContain('text-base')
    })

    it('applies lg size classes', () => {
      render(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button').className).toContain('px-6')
      expect(screen.getByRole('button').className).toContain('py-3')
      expect(screen.getByRole('button').className).toContain('text-lg')
    })

    it('applies xl size classes', () => {
      render(<Button size="xl">Extra Large</Button>)
      expect(screen.getByRole('button').className).toContain('px-8')
      expect(screen.getByRole('button').className).toContain('py-4')
      expect(screen.getByRole('button').className).toContain('text-xl')
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Submit</Button>)
      // The spinner SVG should be present
      expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
    })

    it('shows default loading text when isLoading is true', () => {
      render(<Button isLoading>Submit</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Caricamento...')
    })

    it('shows custom loading text when provided', () => {
      render(<Button isLoading loadingText="Please wait...">Submit</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Please wait...')
    })

    it('disables button when loading', () => {
      render(<Button isLoading>Submit</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('sets aria-busy to true when loading', () => {
      render(<Button isLoading>Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    })

    it('sets aria-disabled to true when loading', () => {
      render(<Button isLoading>Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
    })

    it('spinner has correct size class for each size', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const
      const expectedHeights = ['h-4', 'h-5', 'h-6', 'h-7']

      sizes.forEach((size, index) => {
        const { unmount } = render(<Button isLoading size={size}>Button</Button>)
        const svg = screen.getByRole('button').querySelector('svg')
        expect(svg?.classList.contains(expectedHeights[index])).toBe(true)
        unmount()
      })
    })
  })

  describe('Disabled State', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Submit</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('sets aria-disabled to true when disabled', () => {
      render(<Button disabled>Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
    })

    it('has disabled styling classes', () => {
      render(<Button disabled>Submit</Button>)
      expect(screen.getByRole('button').className).toContain('disabled:opacity-50')
      expect(screen.getByRole('button').className).toContain('disabled:cursor-not-allowed')
    })
  })

  describe('Icons', () => {
    it('renders left icon when provided', () => {
      render(
        <Button leftIcon={<span data-testid="left-icon">L</span>}>
          Button
        </Button>
      )
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders right icon when provided', () => {
      render(
        <Button rightIcon={<span data-testid="right-icon">R</span>}>
          Button
        </Button>
      )
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('renders both icons when provided', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">L</span>}
          rightIcon={<span data-testid="right-icon">R</span>}
        >
          Button
        </Button>
      )
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('does not render icons when loading', () => {
      render(
        <Button
          isLoading
          leftIcon={<span data-testid="left-icon">L</span>}
          rightIcon={<span data-testid="right-icon">R</span>}
        >
          Button
        </Button>
      )
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
    })
  })

  describe('Full Width', () => {
    it('applies w-full class when fullWidth is true', () => {
      render(<Button fullWidth>Button</Button>)
      expect(screen.getByRole('button').className).toContain('w-full')
    })

    it('does not apply w-full class by default', () => {
      render(<Button>Button</Button>)
      expect(screen.getByRole('button').className).not.toContain('w-full')
    })
  })

  describe('Event Handlers', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      await userEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Click me</Button>)
      await userEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn()
      render(<Button isLoading onClick={handleClick}>Click me</Button>)
      await userEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('handles onFocus event', () => {
      const handleFocus = vi.fn()
      render(<Button onFocus={handleFocus}>Focus me</Button>)
      fireEvent.focus(screen.getByRole('button'))
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('handles onBlur event', () => {
      const handleBlur = vi.fn()
      render(<Button onBlur={handleBlur}>Blur me</Button>)
      const button = screen.getByRole('button')
      fireEvent.focus(button)
      fireEvent.blur(button)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('is focusable', () => {
      render(<Button>Focusable</Button>)
      const button = screen.getByRole('button')
      button.focus()
      expect(document.activeElement).toBe(button)
    })

    it('has focus-visible ring styles', () => {
      render(<Button>Button</Button>)
      expect(screen.getByRole('button').className).toContain('focus-visible:ring-2')
    })

    it('supports type attribute', () => {
      render(<Button type="submit">Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close dialog')
    })
  })

  describe('HTML attributes', () => {
    it('passes through native button attributes', () => {
      render(
        <Button
          type="submit"
          name="submitBtn"
          form="myForm"
          data-testid="custom-button"
        >
          Submit
        </Button>
      )
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('name', 'submitBtn')
      expect(button).toHaveAttribute('form', 'myForm')
      expect(button).toHaveAttribute('data-testid', 'custom-button')
    })
  })
})

// ============================================================================
// CARD COMPONENT TESTS
// ============================================================================
describe('Card', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    it('renders with default props', () => {
      render(<Card data-testid="card">Default Card</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('p-6')
    })

    it('renders with custom className', () => {
      render(<Card data-testid="card" className="custom-class">Card</Card>)
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })

    it('forwards ref correctly', () => {
      const ref = createRef<HTMLDivElement>()
      render(<Card ref={ref}>Card</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('has displayName set', () => {
      expect(Card.displayName).toBe('Card')
    })
  })

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Card variant="default" data-testid="card">Default</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-surface-200')
    })

    it('renders dark variant', () => {
      render(<Card variant="dark" data-testid="card">Dark</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-surface-300')
    })

    it('renders glow variant', () => {
      render(<Card variant="glow" data-testid="card">Glow</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('border-primary-500/30')
    })

    it('renders elevated variant', () => {
      render(<Card variant="elevated" data-testid="card">Elevated</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('bg-gradient-to-b')
    })
  })

  describe('Hoverable', () => {
    it('applies hover styles when hoverable is true', () => {
      render(<Card hoverable data-testid="card">Hoverable Card</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('hover:shadow-card-hover')
      expect(card.className).toContain('hover:-translate-y-1')
      expect(card.className).toContain('cursor-pointer')
    })

    it('does not apply hover styles by default', () => {
      render(<Card data-testid="card">Non-hoverable Card</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).not.toContain('hover:-translate-y-1')
      expect(card.className).not.toContain('cursor-pointer')
    })
  })

  describe('No Padding', () => {
    it('removes padding when noPadding is true', () => {
      render(<Card noPadding data-testid="card">No Padding Card</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).not.toContain('p-6')
    })

    it('applies padding by default', () => {
      render(<Card data-testid="card">Padded Card</Card>)
      const card = screen.getByTestId('card')
      expect(card.className).toContain('p-6')
    })
  })

  describe('HTML attributes', () => {
    it('passes through HTML attributes', () => {
      render(
        <Card data-testid="card" role="article" aria-label="Test card">
          Card
        </Card>
      )
      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('data-testid', 'card')
      expect(card).toHaveAttribute('aria-label', 'Test card')
    })

    it('handles onClick event', async () => {
      const handleClick = vi.fn()
      render(<Card data-testid="card" onClick={handleClick}>Clickable Card</Card>)
      await userEvent.click(screen.getByTestId('card'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})

describe('CardHeader', () => {
  it('renders children correctly', () => {
    render(<CardHeader>Header Content</CardHeader>)
    expect(screen.getByText('Header Content')).toBeInTheDocument()
  })

  it('applies border by default', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header.className).toContain('border-b')
    expect(header.className).toContain('pb-4')
  })

  it('removes border when noBorder is true', () => {
    render(<CardHeader noBorder data-testid="header">Header</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header.className).not.toContain('border-b')
    expect(header.className).not.toContain('pb-4')
  })

  it('applies custom className', () => {
    render(<CardHeader data-testid="header" className="custom-header">Header</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header).toHaveClass('custom-header')
  })

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardHeader ref={ref}>Header</CardHeader>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has displayName set', () => {
    expect(CardHeader.displayName).toBe('CardHeader')
  })
})

describe('CardTitle', () => {
  it('renders children correctly', () => {
    render(<CardTitle>Title Content</CardTitle>)
    expect(screen.getByText('Title Content')).toBeInTheDocument()
  })

  it('renders as h3 by default', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('renders as custom heading level', () => {
    render(<CardTitle as="h1">Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders as h2', () => {
    render(<CardTitle as="h2">Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('applies default styles', () => {
    render(<CardTitle>Title</CardTitle>)
    const title = screen.getByText('Title')
    expect(title.className).toContain('text-xl')
    expect(title.className).toContain('font-bold')
    expect(title.className).toContain('text-white')
  })

  it('applies custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>)
    expect(screen.getByText('Title')).toHaveClass('custom-title')
  })

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(<CardTitle ref={ref}>Title</CardTitle>)
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
  })

  it('has displayName set', () => {
    expect(CardTitle.displayName).toBe('CardTitle')
  })
})

describe('CardDescription', () => {
  it('renders children correctly', () => {
    render(<CardDescription>Description content</CardDescription>)
    expect(screen.getByText('Description content')).toBeInTheDocument()
  })

  it('applies default styles', () => {
    render(<CardDescription>Description</CardDescription>)
    const description = screen.getByText('Description')
    expect(description.className).toContain('text-sm')
    expect(description.className).toContain('text-gray-400')
  })

  it('applies custom className', () => {
    render(<CardDescription className="custom-desc">Description</CardDescription>)
    expect(screen.getByText('Description')).toHaveClass('custom-desc')
  })

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLParagraphElement>()
    render(<CardDescription ref={ref}>Description</CardDescription>)
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement)
  })

  it('has displayName set', () => {
    expect(CardDescription.displayName).toBe('CardDescription')
  })
})

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(<CardContent>Content here</CardContent>)
    expect(screen.getByText('Content here')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<CardContent data-testid="content" className="custom-content">Content</CardContent>)
    expect(screen.getByTestId('content')).toHaveClass('custom-content')
  })

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardContent ref={ref}>Content</CardContent>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has displayName set', () => {
    expect(CardContent.displayName).toBe('CardContent')
  })
})

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('applies default styles', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer.className).toContain('mt-4')
    expect(footer.className).toContain('pt-4')
    expect(footer.className).toContain('border-t')
    expect(footer.className).toContain('flex')
  })

  it('applies custom className', () => {
    render(<CardFooter data-testid="footer" className="custom-footer">Footer</CardFooter>)
    expect(screen.getByTestId('footer')).toHaveClass('custom-footer')
  })

  it('forwards ref correctly', () => {
    const ref = createRef<HTMLDivElement>()
    render(<CardFooter ref={ref}>Footer</CardFooter>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has displayName set', () => {
    expect(CardFooter.displayName).toBe('CardFooter')
  })
})

describe('Card Composition', () => {
  it('renders full card structure correctly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description here</CardDescription>
        </CardHeader>
        <CardContent>Main content area</CardContent>
        <CardFooter>
          <Button>Action</Button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card description here')).toBeInTheDocument()
    expect(screen.getByText('Main content area')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})

// ============================================================================
// INPUT COMPONENT TESTS
// ============================================================================
describe('Input', () => {
  describe('Rendering', () => {
    it('renders input element', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('renders with default props', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      expect(input).not.toBeDisabled()
    })

    it('renders with custom className', () => {
      render(<Input className="custom-class" />)
      expect(screen.getByRole('textbox')).toHaveClass('custom-class')
    })

    it('forwards ref correctly', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('has displayName set', () => {
      expect(Input.displayName).toBe('Input')
    })
  })

  describe('Label', () => {
    it('renders label when provided', () => {
      render(<Input label="Email" />)
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('associates label with input', () => {
      render(<Input label="Email" id="email-input" />)
      const input = screen.getByRole('textbox')
      const label = screen.getByText('Email')
      expect(label).toHaveAttribute('for', 'email-input')
      expect(input).toHaveAttribute('id', 'email-input')
    })

    it('generates id when not provided', () => {
      render(<Input label="Email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id')
    })

    it('uses name as id when id is not provided', () => {
      render(<Input label="Email" name="email" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id', 'email')
    })

    it('does not render label when not provided', () => {
      render(<Input />)
      expect(screen.queryByRole('label')).not.toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message when error prop is provided', () => {
      render(<Input error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
    })

    it('sets aria-invalid to true when error is present', () => {
      render(<Input error="Error" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('applies error styling', () => {
      render(<Input error="Error" />)
      expect(screen.getByRole('textbox').className).toContain('border-danger-500')
    })

    it('applies shake animation class on error', () => {
      render(<Input error="Error" />)
      expect(screen.getByRole('textbox').className).toContain('animate-shake')
    })

    it('error message has alert role', () => {
      render(<Input error="Error message" id="test-input" />)
      expect(screen.getByRole('alert')).toHaveTextContent('Error message')
    })

    it('error message is linked via aria-describedby', () => {
      render(<Input error="Error message" id="test-input" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'test-input-message')
    })
  })

  describe('Success State', () => {
    it('displays success message when success prop is provided', () => {
      render(<Input success="Looks good!" />)
      expect(screen.getByText('Looks good!')).toBeInTheDocument()
    })

    it('applies success styling', () => {
      render(<Input success="Success" />)
      expect(screen.getByRole('textbox').className).toContain('border-secondary-500')
    })

    it('success message has correct styling', () => {
      render(<Input success="Success message" id="test-input" />)
      const message = screen.getByText('Success message')
      expect(message.className).toContain('text-secondary-400')
    })

    it('does not have shake animation on success', () => {
      render(<Input success="Success" />)
      expect(screen.getByRole('textbox').className).not.toContain('animate-shake')
    })
  })

  describe('Helper Text', () => {
    it('displays helper text when provided', () => {
      render(<Input helperText="Enter your email address" />)
      expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    })

    it('error takes precedence over helper text', () => {
      render(<Input error="Error" helperText="Helper" />)
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })

    it('error takes precedence over success', () => {
      render(<Input error="Error" success="Success" />)
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.queryByText('Success')).not.toBeInTheDocument()
    })

    it('success takes precedence over helper text', () => {
      render(<Input success="Success" helperText="Helper" />)
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })
  })

  describe('Explicit State', () => {
    it('respects explicit error state', () => {
      render(<Input state="error" />)
      expect(screen.getByRole('textbox').className).toContain('border-danger-500')
    })

    it('respects explicit success state', () => {
      render(<Input state="success" />)
      expect(screen.getByRole('textbox').className).toContain('border-secondary-500')
    })

    it('respects explicit default state', () => {
      render(<Input state="default" />)
      expect(screen.getByRole('textbox').className).toContain('border-surface-50/30')
    })

    it('explicit state overrides error prop styling', () => {
      render(<Input state="success" error="Error" />)
      expect(screen.getByRole('textbox').className).toContain('border-secondary-500')
      expect(screen.getByRole('textbox').className).not.toContain('border-danger-500')
    })
  })

  describe('Icons', () => {
    it('renders left icon when provided', () => {
      render(<Input leftIcon={<span data-testid="left-icon">L</span>} />)
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders right icon when provided', () => {
      render(<Input rightIcon={<span data-testid="right-icon">R</span>} />)
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('applies left padding when left icon is present', () => {
      render(<Input leftIcon={<span>L</span>} />)
      expect(screen.getByRole('textbox').className).toContain('pl-11')
    })

    it('applies right padding when right icon is present', () => {
      render(<Input rightIcon={<span>R</span>} />)
      expect(screen.getByRole('textbox').className).toContain('pr-16')
    })

    it('right icon is hidden when showCharCount is active', () => {
      render(
        <Input
          rightIcon={<span data-testid="right-icon">R</span>}
          showCharCount
          maxLength={100}
        />
      )
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
    })
  })

  describe('Character Counter', () => {
    it('shows character counter when showCharCount and maxLength are set', () => {
      render(<Input showCharCount maxLength={100} />)
      expect(screen.getByText('0/100')).toBeInTheDocument()
    })

    it('updates counter as user types', async () => {
      render(<Input showCharCount maxLength={100} />)
      const input = screen.getByRole('textbox')
      await userEvent.type(input, 'Hello')
      expect(screen.getByText('5/100')).toBeInTheDocument()
    })

    it('does not show counter when showCharCount is false', () => {
      render(<Input maxLength={100} />)
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument()
    })

    it('does not show counter when maxLength is not set', () => {
      render(<Input showCharCount />)
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
    })

    it('counter has danger color when at max length', async () => {
      render(<Input showCharCount maxLength={5} />)
      const input = screen.getByRole('textbox')
      await userEvent.type(input, '12345')
      expect(screen.getByText('5/5').className).toContain('text-danger-400')
    })

    it('counter has aria-live for accessibility', () => {
      render(<Input showCharCount maxLength={100} />)
      const counter = screen.getByText('0/100')
      expect(counter).toHaveAttribute('aria-live', 'polite')
    })

    it('works with controlled input', () => {
      const { rerender } = render(
        <Input showCharCount maxLength={100} value="test" onChange={() => {}} />
      )
      expect(screen.getByText('4/100')).toBeInTheDocument()

      rerender(
        <Input showCharCount maxLength={100} value="test value" onChange={() => {}} />
      )
      expect(screen.getByText('10/100')).toBeInTheDocument()
    })
  })

  describe('Event Handlers', () => {
    it('calls onChange when input value changes', async () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      await userEvent.type(screen.getByRole('textbox'), 'a')
      expect(handleChange).toHaveBeenCalled()
    })

    it('handles onFocus event', () => {
      const handleFocus = vi.fn()
      render(<Input onFocus={handleFocus} />)
      fireEvent.focus(screen.getByRole('textbox'))
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('handles onBlur event', () => {
      const handleBlur = vi.fn()
      render(<Input onBlur={handleBlur} />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('handles onKeyDown event', () => {
      const handleKeyDown = vi.fn()
      render(<Input onKeyDown={handleKeyDown} />)
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
    })
  })

  describe('Controlled vs Uncontrolled', () => {
    it('works as controlled input', () => {
      const handleChange = vi.fn()
      render(<Input value="controlled" onChange={handleChange} />)
      expect(screen.getByRole('textbox')).toHaveValue('controlled')
    })

    it('works as uncontrolled input', async () => {
      render(<Input defaultValue="initial" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('initial')
      await userEvent.clear(input)
      await userEvent.type(input, 'new value')
      expect(input).toHaveValue('new value')
    })

    it('tracks internal value for char count in uncontrolled mode', async () => {
      render(<Input showCharCount maxLength={100} />)
      await userEvent.type(screen.getByRole('textbox'), 'Hello World')
      expect(screen.getByText('11/100')).toBeInTheDocument()
    })

    it('does not update internal state when controlled input changes', () => {
      const handleChange = vi.fn()
      render(<Input value="controlled" onChange={handleChange} showCharCount maxLength={100} />)
      const input = screen.getByRole('textbox')
      // When input is controlled, the value prop controls what is shown
      expect(screen.getByText('10/100')).toBeInTheDocument()
      // Simulate typing - this should call onChange but not change internal state
      fireEvent.change(input, { target: { value: 'new value test' } })
      expect(handleChange).toHaveBeenCalled()
      // The char count should still reflect the controlled value since component re-render would update it
      expect(input).toHaveValue('controlled')
    })
  })

  describe('Accessibility', () => {
    it('is focusable', () => {
      render(<Input />)
      const input = screen.getByRole('textbox')
      input.focus()
      expect(document.activeElement).toBe(input)
    })

    it('has focus ring styles', () => {
      render(<Input />)
      expect(screen.getByRole('textbox').className).toContain('focus:ring-2')
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Search" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search')
    })

    it('links message to input via aria-describedby', () => {
      render(<Input id="my-input" helperText="Help text" />)
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'my-input-message')
    })

    it('does not set aria-describedby when no message', () => {
      render(<Input />)
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby')
    })
  })

  describe('HTML attributes', () => {
    it('passes through native input attributes', () => {
      render(
        <Input
          type="email"
          name="email"
          placeholder="Enter email"
          autoComplete="email"
          required
          disabled
          readOnly
          data-testid="custom-input"
        />
      )
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('name', 'email')
      expect(input).toHaveAttribute('placeholder', 'Enter email')
      expect(input).toHaveAttribute('autocomplete', 'email')
      expect(input).toBeRequired()
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('readonly')
      expect(input).toHaveAttribute('data-testid', 'custom-input')
    })

    it('supports maxLength attribute', async () => {
      render(<Input maxLength={5} />)
      const input = screen.getByRole('textbox')
      await userEvent.type(input, '123456789')
      expect(input).toHaveValue('12345')
    })

    it('supports min and max for number inputs', () => {
      render(<Input type="number" min={0} max={100} />)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('max', '100')
    })
  })
})
