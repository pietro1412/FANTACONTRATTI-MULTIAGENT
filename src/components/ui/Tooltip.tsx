import { useState, useRef, useEffect, type ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  /** Position relative to children */
  position?: 'top' | 'bottom'
}

/**
 * Tooltip component:
 * - Desktop: shows on hover
 * - Mobile: shows on tap (toggle)
 */
export function Tooltip({ content, children, className = '', position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click (for mobile tap-to-toggle)
  useEffect(() => {
    if (!visible) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => { document.removeEventListener('mousedown', handleClick); }
  }, [visible])

  const positionClasses = position === 'top'
    ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
    : 'top-full mt-2 left-1/2 -translate-x-1/2'

  return (
    <div
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => { setVisible(true); }}
      onMouseLeave={() => { setVisible(false); }}
      onClick={(e) => {
        e.stopPropagation()
        setVisible((v) => !v)
      }}
    >
      {children}
      {visible && (
        <div className={`absolute z-50 ${positionClasses} pointer-events-none`}>
          <div className="bg-surface-100 border border-surface-50/30 rounded-lg px-3 py-2 text-xs text-gray-300 shadow-xl shadow-black/40 whitespace-normal max-w-[220px] text-center leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}

export default Tooltip
