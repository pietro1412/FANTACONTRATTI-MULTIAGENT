/**
 * Sound system for auction events
 * Uses Web Audio API with preloaded audio for low latency
 */

type SoundType = 'bid' | 'outbid' | 'warning' | 'win' | 'lose' | 'notification'

// Sound file paths (to be added to public/sounds/)
const SOUND_PATHS: Record<SoundType, string> = {
  bid: '/sounds/bid.mp3',
  outbid: '/sounds/outbid.mp3',
  warning: '/sounds/warning.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  notification: '/sounds/notification.mp3',
}

// Preloaded audio elements cache
const audioCache: Map<SoundType, HTMLAudioElement> = new Map()

// User preference key in localStorage
const SOUNDS_ENABLED_KEY = 'fantacontratti-sounds-enabled'
const SOUNDS_VOLUME_KEY = 'fantacontratti-sounds-volume'

/**
 * Initialize and preload sounds
 */
export function preloadSounds(): void {
  Object.entries(SOUND_PATHS).forEach(([type, path]) => {
    const audio = new Audio(path)
    audio.preload = 'auto'
    audioCache.set(type as SoundType, audio)
  })
}

/**
 * Check if sounds are enabled by user preference
 */
export function areSoundsEnabled(): boolean {
  const stored = localStorage.getItem(SOUNDS_ENABLED_KEY)
  return stored === null ? true : stored === 'true'
}

/**
 * Enable or disable sounds
 */
export function setSoundsEnabled(enabled: boolean): void {
  localStorage.setItem(SOUNDS_ENABLED_KEY, String(enabled))
}

/**
 * Get current volume (0-1)
 */
export function getSoundsVolume(): number {
  const stored = localStorage.getItem(SOUNDS_VOLUME_KEY)
  return stored ? parseFloat(stored) : 0.5
}

/**
 * Set volume (0-1)
 */
export function setSoundsVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  localStorage.setItem(SOUNDS_VOLUME_KEY, String(clamped))
}

/**
 * Play a sound effect
 */
export function playSound(type: SoundType): void {
  if (!areSoundsEnabled()) return

  try {
    // Try to use cached audio
    let audio = audioCache.get(type)

    if (!audio) {
      // Create new audio element if not cached
      audio = new Audio(SOUND_PATHS[type])
      audioCache.set(type, audio)
    }

    // Clone the audio to allow multiple simultaneous plays
    const clone = audio.cloneNode() as HTMLAudioElement
    clone.volume = getSoundsVolume()

    clone.play().catch(() => {
      // Silently fail - user interaction may be required first
    })
  } catch {
    // Sound failed to play, ignore
  }
}

// Convenience functions for common sounds
export const sounds = {
  bid: () => playSound('bid'),
  outbid: () => playSound('outbid'),
  warning: () => playSound('warning'),
  win: () => playSound('win'),
  lose: () => playSound('lose'),
  notification: () => playSound('notification'),
}

export default sounds
