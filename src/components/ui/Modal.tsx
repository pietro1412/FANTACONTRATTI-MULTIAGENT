import {
  forwardRef,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: ModalSize
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  className?: string
}

interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      children,
      size = 'md',
      closeOnBackdrop = true,
      closeOnEscape = true,
      showCloseButton = true,
      className = '',
      ...props
    },
    ref
  ) => {
    // Swipe-to-dismiss state (mobile)
    const [dragOffset, setDragOffset] = useState(0)
    const [isDraggingState, setIsDraggingState] = useState(false)
    const isDragging = useRef(false)
    const startY = useRef(0)

    const containerRef = useRef<HTMLDivElement>(null)

    // Handle keyboard: escape + focus trap (Tab cycling)
    const handleKeyDown = useCallback(
      (event: KeyboardEvent) => {
        if (event.key === 'Escape' && closeOnEscape) {
          onClose()
          return
        }
        if (event.key === 'Tab') {
          const container = containerRef.current
          if (!container) return
          const focusable = container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          if (focusable.length === 0) return
          const first = focusable[0]!
          const last = focusable[focusable.length - 1]!
          if (event.shiftKey) {
            if (document.activeElement === first) {
              event.preventDefault()
              last.focus()
            }
          } else {
            if (document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
        }
      },
      [closeOnEscape, onClose]
    )

    // Handle backdrop click
    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && closeOnBackdrop) {
        onClose()
      }
    }

    // Touch handlers for swipe-to-dismiss
    const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        startY.current = touch.clientY
        isDragging.current = true
        setIsDraggingState(true)
      }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging.current) return
      const touch = e.touches[0]
      if (!touch) return
      const diff = touch.clientY - startY.current
      if (diff > 0) {
        setDragOffset(diff)
      }
    }

    const handleTouchEnd = () => {
      isDragging.current = false
      setIsDraggingState(false)
      if (dragOffset > 100) {
        onClose()
      }
      setDragOffset(0)
    }

    // Add/remove event listeners, manage body scroll, and set initial focus
    useEffect(() => {
      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'hidden'
        // Focus first focusable element after render
        setTimeout(() => {
          const container = containerRef.current
          if (!container) return
          const firstFocusable = container.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          firstFocusable?.focus()
        }, 50)
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }, [isOpen, handleKeyDown])

    // Size styles for the modal container
    const sizeStyles: Record<ModalSize, string> = {
      sm: 'max-w-sm w-full',
      md: 'max-w-md w-full',
      lg: 'max-w-lg w-full',
      xl: 'max-w-xl w-full',
      full: 'max-w-[calc(100vw-2rem)] w-full max-h-[calc(100vh-2rem)]',
    }

    // Animation classes using custom Tailwind animations
    const backdropAnimation = 'animate-backdrop-in'
    const modalAnimation = 'animate-modal-in'

    if (!isOpen) return null

    const modalContent = (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropAnimation}`}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop with blur */}
        <div
          className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal container */}
        <div
          ref={(node) => {
            // Assign to both the forwarded ref and our internal ref
            containerRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          className={`
            relative ${sizeStyles[size]}
            bg-surface-200 border border-surface-50/20
            rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]
            ${modalAnimation}
            ${className}
          `.replace(/\s+/g, ' ').trim()}
          style={dragOffset > 0 ? {
            transform: `translateY(${dragOffset}px)`,
            opacity: Math.max(0.5, 1 - dragOffset / 300),
            transition: isDraggingState ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
          } : undefined}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          {...props}
        >
          {/* Swipe handle (mobile only) */}
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-gray-500 rounded-full" />
          </div>

          {/* Close button */}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="
                absolute top-4 right-4 z-10
                w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center
                rounded-lg text-gray-400
                hover:text-white hover:bg-surface-100
                transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
              "
              aria-label="Chiudi modale"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}

          {children}
        </div>
      </div>
    )

    // Render portal to body
    return createPortal(modalContent, document.body)
  }
)

Modal.displayName = 'Modal'

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-4 border-b border-surface-50/20
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      >
        <h2 className="text-xl font-bold text-white tracking-tight pr-8">
          {children}
        </h2>
      </div>
    )
  }
)

ModalHeader.displayName = 'ModalHeader'

export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-4 overflow-y-auto
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ModalBody.displayName = 'ModalBody'

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-4 border-t border-surface-50/20
          flex items-center justify-end gap-3
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ModalFooter.displayName = 'ModalFooter'

export default Modal
