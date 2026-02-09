import { useRef, useCallback } from 'react'

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number // minimum horizontal distance (default: 50)
  maxVertical?: number // max vertical distance to count as horizontal swipe (default: 80)
}

interface UseSwipeGestureReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchEnd: (e: React.TouchEvent) => void
  }
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVertical = 80,
}: UseSwipeGestureOptions): UseSwipeGestureReturn {
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      startX.current = touch.clientX
      startY.current = touch.clientY
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0]
    if (!touch) return

    const diffX = touch.clientX - startX.current
    const diffY = Math.abs(touch.clientY - startY.current)

    // Ignore if vertical movement exceeds max (user is scrolling)
    if (diffY > maxVertical) return

    if (diffX < -threshold && onSwipeLeft) {
      onSwipeLeft()
    } else if (diffX > threshold && onSwipeRight) {
      onSwipeRight()
    }
  }, [onSwipeLeft, onSwipeRight, threshold, maxVertical])

  return {
    handlers: { onTouchStart, onTouchEnd },
  }
}
