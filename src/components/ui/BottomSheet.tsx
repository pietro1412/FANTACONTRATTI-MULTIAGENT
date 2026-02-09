import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  maxHeight?: string // e.g. '80vh', '500px'
  showHandle?: boolean
  closeOnBackdrop?: boolean
  className?: string
}

/**
 * Mobile-native bottom sheet component
 * Features:
 * - Slide up animation from bottom
 * - Drag to dismiss
 * - Backdrop blur
 * - Safe area support for notched devices
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = '85vh',
  showHandle = true,
  closeOnBackdrop = true,
  className = '',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const startY = useRef(0)

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Touch handlers for drag to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      startY.current = touch.clientY
    }
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    if (!touch) return
    const currentY = touch.clientY
    const diff = currentY - startY.current
    // Only allow dragging down
    if (diff > 0) {
      setDragOffset(diff)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    // If dragged more than 100px, close
    if (dragOffset > 100) {
      onClose()
    }
    setDragOffset(0)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-surface-200 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${className}`}
        style={{
          maxHeight,
          transform: `translateY(${dragOffset}px)`,
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        {/* Handle */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-500 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="px-4 pb-3 border-b border-surface-50/20">
            <div className="flex items-center justify-between">
              <h2
                id="bottom-sheet-title"
                className="text-lg font-bold text-white"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-100 transition-colors"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default BottomSheet
