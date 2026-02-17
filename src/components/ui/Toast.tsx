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
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration: number
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
}

const VARIANT_ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={18} aria-hidden="true" />,
  error: <AlertCircle size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 5000,
  error: 8000,
  warning: 6000,
  info: 5000,
}

let toastCounter = 0

function ToastMessage({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => { onDismiss(item.id); }, item.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [item.id, item.duration, onDismiss])

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg max-w-sm w-full animate-slide-in-up ${VARIANT_STYLES[item.variant]}`}
    >
      <span className="flex-shrink-0">{VARIANT_ICONS[item.variant]}</span>
      <p className="flex-1 text-sm font-medium">{item.message}</p>
      <button
        type="button"
        onClick={() => { onDismiss(item.id); }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Chiudi notifica"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((variant: ToastVariant, message: string) => {
    const id = `toast-${++toastCounter}`
    const duration = DEFAULT_DURATIONS[variant]
    setToasts(prev => {
      const next = [...prev, { id, variant, message, duration }]
      // Keep only MAX_TOASTS (FIFO)
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next
    })
  }, [])

  const toast = {
    success: useCallback((msg: string) => { addToast('success', msg); }, [addToast]),
    error: useCallback((msg: string) => { addToast('error', msg); }, [addToast]),
    warning: useCallback((msg: string) => { addToast('warning', msg); }, [addToast]),
    info: useCallback((msg: string) => { addToast('info', msg); }, [addToast]),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div
          className="fixed z-[100] bottom-20 sm:bottom-auto sm:top-4 left-1/2 sm:left-auto sm:right-4 -translate-x-1/2 sm:translate-x-0 flex flex-col gap-2 pointer-events-none"
          aria-label="Notifiche"
        >
          {toasts.map(item => (
            <div key={item.id} className="pointer-events-auto">
              <ToastMessage item={item} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
