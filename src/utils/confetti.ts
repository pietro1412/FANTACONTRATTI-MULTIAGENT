// @ts-expect-error no types available for canvas-confetti
import confetti from 'canvas-confetti'

/**
 * Celebration confetti for winning auctions
 * Uses team colors: gold, green, blue
 */
export function celebrateWin(): void {
  // Fire confetti from left
  confetti({
    particleCount: 80,
    spread: 55,
    origin: { x: 0.1, y: 0.6 },
    colors: ['#f59e0b', '#22c55e', '#3b82f6', '#fbbf24'],
  })

  // Fire confetti from right
  confetti({
    particleCount: 80,
    spread: 55,
    origin: { x: 0.9, y: 0.6 },
    colors: ['#f59e0b', '#22c55e', '#3b82f6', '#fbbf24'],
  })
}

/**
 * Big celebration for important wins (expensive players, etc)
 */
export function celebrateBigWin(): void {
  const duration = 3000
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#f59e0b', '#22c55e', '#3b82f6'],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#f59e0b', '#22c55e', '#3b82f6'],
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}

/**
 * Gold shower for trophy wins
 */
export function celebrateTrophy(): void {
  confetti({
    particleCount: 150,
    spread: 180,
    origin: { y: 0.3 },
    colors: ['#fbbf24', '#f59e0b', '#d97706', '#b45309'],
    shapes: ['circle', 'square'],
    gravity: 0.8,
    scalar: 1.2,
  })
}

/**
 * Subtle celebration for smaller wins
 */
export function celebrateSmall(): void {
  confetti({
    particleCount: 30,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#22c55e', '#4ade80'],
  })
}

export default {
  win: celebrateWin,
  bigWin: celebrateBigWin,
  trophy: celebrateTrophy,
  small: celebrateSmall,
}
