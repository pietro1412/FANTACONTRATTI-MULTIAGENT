/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API where available
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'bid' | 'outbid' | 'win'

// Vibration patterns in milliseconds
const PATTERNS: Record<HapticPattern, number | number[]> = {
  // Basic patterns
  light: 10,
  medium: 50,
  heavy: 100,

  // Semantic patterns
  success: [50, 50, 100],      // Short-short-long
  warning: [100, 50, 100],     // Long-short-long
  error: [50, 50, 50, 50, 50], // Rapid pulses

  // Auction-specific patterns
  bid: 50,                     // Bid sent
  outbid: [50, 30, 50],        // Someone outbid you
  win: [100, 50, 100, 50, 200] // You won the auction!
}

/**
 * Trigger haptic feedback on supported devices
 * @param pattern - The haptic pattern to use
 * @returns true if vibration was triggered, false if not supported
 */
export function vibrate(pattern: HapticPattern | number | number[] = 'medium'): boolean {
  // Check for Vibration API support
  if (!('vibrate' in navigator)) {
    return false
  }

  try {
    // Get the pattern
    const vibrationPattern = typeof pattern === 'string'
      ? PATTERNS[pattern]
      : pattern

    // Trigger vibration
    navigator.vibrate(vibrationPattern)
    return true
  } catch {
    return false
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelVibration(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(0)
  }
}

/**
 * Check if haptic feedback is available on this device
 */
export function isHapticAvailable(): boolean {
  return 'vibrate' in navigator
}

// Pre-built haptic feedback functions for common actions
export const haptic = {
  light: () => vibrate('light'),
  medium: () => vibrate('medium'),
  heavy: () => vibrate('heavy'),
  success: () => vibrate('success'),
  warning: () => vibrate('warning'),
  error: () => vibrate('error'),
  bid: () => vibrate('bid'),
  outbid: () => vibrate('outbid'),
  win: () => vibrate('win'),
}

export default haptic
