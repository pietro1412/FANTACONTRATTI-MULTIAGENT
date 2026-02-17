import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../components/ui/Input'

describe('Input', () => {
  describe('rendering', () => {
    it('renders correctly', () => {
      render(<Input data-testid="input" />)
      expect(screen.getByTestId('input')).toBeInTheDocument()
    })

    it('renders as an input element', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input.tagName).toBe('INPUT')
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      render(<Input ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })
  })

  describe('label', () => {
    it('renders label when provided', () => {
      render(<Input label="Email" />)
      expect(screen.getByText('Email')).toBeInTheDocument()
    })

    it('associates label with input', () => {
      render(<Input label="Username" name="username" />)
      const input = screen.getByLabelText('Username')
      expect(input).toBeInTheDocument()
    })

    it('uses id prop for label association when provided', () => {
      render(<Input label="Custom" id="custom-id" />)
      const input = screen.getByLabelText('Custom')
      expect(input).toHaveAttribute('id', 'custom-id')
    })
  })

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('px-4')
      expect(input.className).toContain('py-3')
      expect(input.className).toContain('text-base')
    })

    it('renders small size correctly', () => {
      render(<Input data-testid="input" inputSize="sm" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('px-3')
      expect(input.className).toContain('py-2')
      expect(input.className).toContain('text-sm')
    })

    it('renders large size correctly', () => {
      render(<Input data-testid="input" inputSize="lg" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('px-5')
      expect(input.className).toContain('py-4')
      expect(input.className).toContain('text-lg')
    })

    it('adjusts label size based on inputSize', () => {
      render(<Input label="Small Label" inputSize="sm" />)
      const label = screen.getByText('Small Label')
      expect(label.className).toContain('text-xs')

      render(<Input label="Large Label" inputSize="lg" />)
      const lgLabel = screen.getByText('Large Label')
      expect(lgLabel.className).toContain('text-base')
    })
  })

  describe('states', () => {
    it('renders default state by default', () => {
      render(<Input data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('border-surface-50/30')
    })

    it('renders error state correctly', () => {
      render(<Input data-testid="input" error="Error message" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('border-danger-500')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('renders success state correctly', () => {
      render(<Input data-testid="input" success="Success message" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('border-secondary-500')
    })

    it('shows success check icon in success state', () => {
      render(<Input data-testid="input" success="Valid" />)
      const container = screen.getByTestId('input').parentElement
      const svg = container?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('explicit state prop takes precedence', () => {
      render(<Input data-testid="input" error="Error" state="success" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('border-secondary-500')
      expect(input.className).not.toContain('border-danger-500')
    })
  })

  describe('icons', () => {
    it('renders left icon when provided', () => {
      render(
        <Input
          data-testid="input"
          leftIcon={<span data-testid="left-icon">L</span>}
        />
      )
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders right icon when provided', () => {
      render(
        <Input
          data-testid="input"
          rightIcon={<span data-testid="right-icon">R</span>}
        />
      )
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('adds left padding when left icon is present', () => {
      render(
        <Input
          data-testid="input"
          leftIcon={<span>L</span>}
        />
      )
      const input = screen.getByTestId('input')
      expect(input.className).toContain('pl-11')
    })

    it('adds right padding when right icon is present', () => {
      render(
        <Input
          data-testid="input"
          rightIcon={<span>R</span>}
        />
      )
      const input = screen.getByTestId('input')
      expect(input.className).toContain('pr-16')
    })

    it('uses custom right icon over success icon', () => {
      render(
        <Input
          data-testid="input"
          success="Valid"
          rightIcon={<span data-testid="custom-icon">X</span>}
        />
      )
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('character counter', () => {
    it('shows character counter when showCharCount and maxLength are provided', () => {
      render(<Input showCharCount maxLength={100} defaultValue="Hello" />)
      expect(screen.getByText('5/100')).toBeInTheDocument()
    })

    it('updates counter on input change', () => {
      render(<Input showCharCount maxLength={100} />)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Testing' } })
      expect(screen.getByText('7/100')).toBeInTheDocument()
    })

    it('shows red counter when at maxLength', () => {
      render(<Input showCharCount maxLength={5} defaultValue="Hello" />)
      const counter = screen.getByText('5/5')
      expect(counter.className).toContain('text-danger-400')
    })

    it('hides success icon when character counter is shown', () => {
      render(
        <Input
          data-testid="input"
          success="Valid"
          showCharCount
          maxLength={100}
        />
      )
      screen.getByTestId('input').parentElement
      // Should show character counter, not success icon
      expect(screen.getByText(/\/100/)).toBeInTheDocument()
    })
  })

  describe('messages', () => {
    it('renders error message', () => {
      render(<Input error="This field is required" />)
      expect(screen.getByText('This field is required')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('renders success message', () => {
      render(<Input success="Looks good!" />)
      expect(screen.getByText('Looks good!')).toBeInTheDocument()
    })

    it('renders helper text', () => {
      render(<Input helperText="Enter your email address" />)
      expect(screen.getByText('Enter your email address')).toBeInTheDocument()
    })

    it('error message takes precedence over success and helper', () => {
      render(
        <Input
          error="Error"
          success="Success"
          helperText="Helper"
        />
      )
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.queryByText('Success')).not.toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })

    it('success message takes precedence over helper', () => {
      render(
        <Input
          success="Success"
          helperText="Helper"
        />
      )
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.queryByText('Helper')).not.toBeInTheDocument()
    })

    it('applies correct styling to messages', () => {
      const { rerender } = render(<Input error="Error" />)
      expect(screen.getByText('Error').className).toContain('text-danger-400')

      rerender(<Input success="Success" />)
      expect(screen.getByText('Success').className).toContain('text-secondary-400')

      rerender(<Input helperText="Helper" />)
      expect(screen.getByText('Helper').className).toContain('text-gray-500')
    })

    it('associates message with input via aria-describedby', () => {
      render(<Input name="test" error="Error message" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby')
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('works as controlled input', () => {
      const onChange = vi.fn()
      render(<Input value="test" onChange={onChange} />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('test')

      fireEvent.change(input, { target: { value: 'new value' } })
      expect(onChange).toHaveBeenCalled()
    })

    it('works as uncontrolled input', () => {
      render(<Input defaultValue="initial" />)
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('initial')

      fireEvent.change(input, { target: { value: 'changed' } })
      expect(input).toHaveValue('changed')
    })

    it('tracks character count in uncontrolled mode', () => {
      render(<Input showCharCount maxLength={100} />)
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'Hello World' } })
      expect(screen.getByText('11/100')).toBeInTheDocument()
    })
  })

  describe('custom className', () => {
    it('applies custom className to input', () => {
      render(<Input data-testid="input" className="custom-class" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('custom-class')
    })
  })

  describe('HTML attributes', () => {
    it('passes through additional HTML attributes', () => {
      render(
        <Input
          data-testid="input"
          placeholder="Enter text"
          disabled
          type="email"
        />
      )
      const input = screen.getByTestId('input')
      expect(input).toHaveAttribute('placeholder', 'Enter text')
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('type', 'email')
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Input.displayName).toBe('Input')
    })
  })
})
