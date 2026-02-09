import { type ReactNode } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const { pullOffset, isRefreshing, handlers } = usePullToRefresh({ onRefresh })

  return (
    <div
      className={`relative ${className}`}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      {/* Pull indicator */}
      {(pullOffset > 0 || isRefreshing) && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none md:hidden"
          style={{ top: -4, height: pullOffset || 40 }}
        >
          <div className={`flex flex-col items-center gap-1 transition-opacity ${pullOffset > 10 || isRefreshing ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
              style={!isRefreshing ? { transform: `rotate(${pullOffset * 3}deg)` } : undefined}
            />
            <span className="text-xs text-gray-400">
              {isRefreshing ? 'Aggiornamento...' : pullOffset >= 40 ? 'Rilascia' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div style={pullOffset > 0 || isRefreshing ? {
        transform: `translateY(${pullOffset}px)`,
        transition: isRefreshing ? 'none' : 'transform 0.2s ease',
      } : undefined}>
        {children}
      </div>
    </div>
  )
}

export default PullToRefresh
