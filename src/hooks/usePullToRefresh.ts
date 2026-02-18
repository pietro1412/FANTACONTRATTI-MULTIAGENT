import { useRef, useState, useCallback, useEffect } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number // px to pull before triggering (default: 80)
  maxPull?: number   // max pull distance (default: 120)
}

interface UsePullToRefreshReturn {
  pullOffset: number
  isRefreshing: boolean
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullOffset, setPullOffset] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return
    // Only start pull if page is scrolled to top
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    if (scrollTop > 0) return
    const touch = e.touches[0]
    if (touch) {
      startY.current = touch.clientY
      isPulling.current = true
    }
  }, [isRefreshing])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return
    const touch = e.touches[0]
    if (!touch) return
    const diff = touch.clientY - startY.current
    if (diff > 0) {
      // Apply resistance (diminishing returns)
      const dampened = Math.min(maxPull, diff * 0.5)
      setPullOffset(dampened)
    } else {
      isPulling.current = false
      setPullOffset(0)
    }
  }, [isRefreshing, maxPull])

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullOffset >= threshold) {
      setIsRefreshing(true)
      setPullOffset(threshold * 0.5) // Snap to spinner position
      void onRefresh().finally(() => {
        setIsRefreshing(false)
        setPullOffset(0)
      })
    } else {
      setPullOffset(0)
    }
  }, [pullOffset, threshold, onRefresh])

  // Reset on unmount
  useEffect(() => {
    return () => {
      setPullOffset(0)
      setIsRefreshing(false)
    }
  }, [])

  return {
    pullOffset,
    isRefreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  }
}
