import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal'

describe('Modal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure body overflow is reset
    document.body.style.overflow = ''
  })

  afterEach(() => {
    // Clean up any portaled content
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={mockOnClose}>
          <div>Modal Content</div>
        </Modal>
      )
      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
    })

    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Modal Content</div>
        </Modal>
      )
      expect(screen.getByText('Modal Content')).toBeInTheDocument()
    })

    it('renders children correctly', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Child 1</div>
          <div>Child 2</div>
        </Modal>
      )
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })

    it('renders with correct ARIA attributes', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })
  })

  describe('sizes', () => {
    const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-[calc(100vw-2rem)]',
    }

    Object.entries(sizeClasses).forEach(([size, expectedClass]) => {
      it(`renders ${size} size correctly`, () => {
        render(
          <Modal
            isOpen={true}
            onClose={mockOnClose}
            size={size as 'sm' | 'md' | 'lg' | 'xl' | 'full'}
          >
            <div data-testid="modal-container">Content</div>
          </Modal>
        )
        const modalContainer = document.querySelector('.relative.max-w')?.parentElement?.querySelector('.relative')
        // Check the modal container has the size class
        const dialog = screen.getByRole('dialog')
        expect(dialog.innerHTML).toContain(expectedClass)
      })
    })

    it('renders medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.innerHTML).toContain('max-w-md')
    })
  })

  describe('close button', () => {
    it('renders close button by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      const closeButton = screen.getByRole('button', { name: /chiudi/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      const closeButton = screen.getByRole('button', { name: /chiudi/i })
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} showCloseButton={false}>
          <div>Content</div>
        </Modal>
      )
      expect(screen.queryByRole('button', { name: /chiudi/i })).not.toBeInTheDocument()
    })
  })

  describe('backdrop click', () => {
    it('calls onClose when backdrop is clicked by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when modal content is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div data-testid="content">Content</div>
        </Modal>
      )
      const content = screen.getByTestId('content')
      fireEvent.click(content)
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('does not call onClose when closeOnBackdrop is false', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnBackdrop={false}>
          <div>Content</div>
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('escape key', () => {
    it('calls onClose when Escape key is pressed by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose when closeOnEscape is false', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      )
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('does not call onClose for non-Escape keys', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      fireEvent.keyDown(document, { key: 'Enter' })
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('body scroll lock', () => {
    it('locks body scroll when modal opens', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('unlocks body scroll when modal closes', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <Modal isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      )
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} className="custom-modal">
          <div>Content</div>
        </Modal>
      )
      const dialog = screen.getByRole('dialog')
      expect(dialog.innerHTML).toContain('custom-modal')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to the modal container', () => {
      const ref = { current: null }
      render(
        <Modal isOpen={true} onClose={mockOnClose} ref={ref}>
          <div>Content</div>
        </Modal>
      )
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('displayName', () => {
    it('has correct displayName', () => {
      expect(Modal.displayName).toBe('Modal')
    })
  })
})

describe('ModalHeader', () => {
  it('renders children as heading', () => {
    render(<ModalHeader>Header Title</ModalHeader>)
    expect(screen.getByText('Header Title')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('applies border styles', () => {
    render(<ModalHeader data-testid="header">Title</ModalHeader>)
    const header = screen.getByTestId('header')
    expect(header.className).toContain('border-b')
  })

  it('applies custom className', () => {
    render(<ModalHeader className="custom-header">Title</ModalHeader>)
    const header = screen.getByText('Title').parentElement
    expect(header?.className).toContain('custom-header')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<ModalHeader ref={ref}>Title</ModalHeader>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(ModalHeader.displayName).toBe('ModalHeader')
  })
})

describe('ModalBody', () => {
  it('renders children correctly', () => {
    render(<ModalBody>Body content</ModalBody>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('has overflow-y-auto class for scrolling', () => {
    render(<ModalBody data-testid="body">Content</ModalBody>)
    const body = screen.getByTestId('body')
    expect(body.className).toContain('overflow-y-auto')
  })

  it('applies custom className', () => {
    render(<ModalBody className="custom-body">Content</ModalBody>)
    const body = screen.getByText('Content')
    expect(body.className).toContain('custom-body')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<ModalBody ref={ref}>Content</ModalBody>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(ModalBody.displayName).toBe('ModalBody')
  })
})

describe('ModalFooter', () => {
  it('renders children correctly', () => {
    render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Save</button>
      </ModalFooter>
    )
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('applies border-top styles', () => {
    render(<ModalFooter data-testid="footer">Content</ModalFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer.className).toContain('border-t')
  })

  it('has flex layout for buttons', () => {
    render(<ModalFooter data-testid="footer">Content</ModalFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer.className).toContain('flex')
    expect(footer.className).toContain('items-center')
    expect(footer.className).toContain('justify-end')
    expect(footer.className).toContain('gap-3')
  })

  it('applies custom className', () => {
    render(<ModalFooter className="custom-footer">Content</ModalFooter>)
    const footer = screen.getByText('Content')
    expect(footer.className).toContain('custom-footer')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<ModalFooter ref={ref}>Content</ModalFooter>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('has correct displayName', () => {
    expect(ModalFooter.displayName).toBe('ModalFooter')
  })
})

describe('Modal composition', () => {
  it('renders full modal with all subcomponents', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <ModalHeader>Modal Title</ModalHeader>
        <ModalBody>Modal body content</ModalBody>
        <ModalFooter>
          <button>Close</button>
        </ModalFooter>
      </Modal>
    )
    expect(screen.getByText('Modal Title')).toBeInTheDocument()
    expect(screen.getByText('Modal body content')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })
})
