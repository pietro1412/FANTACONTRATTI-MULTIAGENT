import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

type ConfirmVariant = 'danger' | 'warning' | 'default'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

const VARIANT_BUTTON: Record<ConfirmVariant, 'danger' | 'primary' | 'secondary'> = {
  danger: 'danger',
  warning: 'primary',
  default: 'primary',
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setState({ options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state?.resolve(true)
    setState(null)
  }, [state])

  const handleCancel = useCallback(() => {
    state?.resolve(false)
    setState(null)
  }, [state])

  // Focus trap + keyboard handling
  useEffect(() => {
    if (!state) return

    // Focus confirm button on open
    setTimeout(() => cancelBtnRef.current?.focus(), 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
        return
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        )
        if (!focusable || focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [state, handleCancel])

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {state &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            onClick={handleCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" aria-hidden="true" />

            {/* Dialog */}
            <div
              ref={dialogRef}
              className="relative bg-surface-200 border border-surface-50/20 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] max-w-sm w-full p-6 animate-modal-in"
              onClick={e => { e.stopPropagation(); }}
            >
              {state.options.variant === 'danger' && (
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-400" size={24} aria-hidden="true" />
                </div>
              )}

              <h2
                id="confirm-dialog-title"
                className="text-lg font-bold text-white text-center mb-2"
              >
                {state.options.title}
              </h2>
              <p
                id="confirm-dialog-message"
                className="text-sm text-gray-400 text-center mb-6"
              >
                {state.options.message}
              </p>

              <div className="flex gap-3">
                <Button
                  ref={cancelBtnRef}
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={handleCancel}
                >
                  {state.options.cancelLabel || 'Annulla'}
                </Button>
                <Button
                  ref={confirmBtnRef}
                  variant={VARIANT_BUTTON[state.options.variant || 'default']}
                  size="sm"
                  fullWidth
                  onClick={handleConfirm}
                >
                  {state.options.confirmLabel || 'Conferma'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider')
  }
  return ctx
}
