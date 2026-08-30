/**
 * Sound system for auction events
 * Uses Web Audio API with preloaded audio for low latency
 */

type SoundType = 'bid' | 'outbid' | 'warning' | 'notification' | 'timerStart' | 'timerExpired' | 'saleComplete'

// Sound file paths (to be added to public/sounds/)
const SOUND_PATHS: Record<SoundType, string> = {
  bid: '/sounds/bid.mp3',
  outbid: '/sounds/outbid.mp3',
  warning: '/sounds/warning.mp3',
  notification: '/sounds/notification.mp3',
  timerStart: '/sounds/timer-start.mp3',
  timerExpired: '/sounds/timer-expired.mp3',
  saleComplete: '/sounds/sale-complete.mp3',
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
 * Play a sound effect. Riusa un solo elemento audio per tipo: se lo stesso
 * suono è già in riproduzione (es. warning ritriggerato ogni secondo negli
 * ultimi secondi) lo riavvia da capo invece di sovrapporre un nuovo clone,
 * altrimenti i cloni si accumulano e restano udibili ben oltre il trigger.
 */
export function playSound(type: SoundType): void {
  if (!areSoundsEnabled()) return

  try {
    let audio = audioCache.get(type)

    if (!audio) {
      audio = new Audio(SOUND_PATHS[type])
      audioCache.set(type, audio)
    }

    audio.pause()
    audio.currentTime = 0
    audio.volume = getSoundsVolume()

    audio.play().catch(() => {
      // Silently fail - user interaction may be required first
    })
  } catch {
    // Sound failed to play, ignore
  }
}

// Convenience functions for common sounds
export const sounds = {
  bid: () => { playSound('bid'); },
  outbid: () => { playSound('outbid'); },
  warning: () => { playSound('warning'); },
  notification: () => { playSound('notification'); },
  timerStart: () => { playSound('timerStart'); },
  timerExpired: () => { playSound('timerExpired'); },
  saleComplete: () => { playSound('saleComplete'); },
}

export default sounds
