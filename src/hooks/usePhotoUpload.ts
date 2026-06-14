import { useCallback, useRef, useState, type ChangeEvent } from 'react'

/** Max upload size for profile/league photos (base64). */
export const PHOTO_MAX_BYTES = 500 * 1024

export interface UsePhotoUploadResult {
  /** Ref to attach to a hidden <input type="file" />. */
  fileInputRef: React.RefObject<HTMLInputElement | null>
  /** Opens the native file picker. */
  openPicker: () => void
  /**
   * onChange handler for the hidden file input. Validates type + size,
   * converts to base64 and invokes the callback. Returns an Italian error
   * message string on validation failure (the caller decides how to surface it).
   */
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  /** True while a file is being read to base64. */
  isReading: boolean
}

export interface UsePhotoUploadOptions {
  /** Called with the base64 data URL once a valid file has been read. */
  onPhotoReady: (base64: string) => void | Promise<void>
  /** Called with an Italian error message when validation fails. */
  onError: (message: string) => void
  /** Max size in bytes (default 500KB). */
  maxBytes?: number
}

/**
 * Shared photo upload hook: file picker + type/size validation + base64 conversion.
 * Reused by Profile (and adoptable by CreateLeague for league logos).
 * Behaviour mirrors the previous inline Profile logic exactly.
 */
export function usePhotoUpload({ onPhotoReady, onError, maxBytes = PHOTO_MAX_BYTES }: UsePhotoUploadOptions): UsePhotoUploadResult {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isReading, setIsReading] = useState(false)

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        onError('Seleziona un file immagine valido')
        return
      }

      if (file.size > maxBytes) {
        onError("L'immagine deve essere inferiore a 500KB")
        return
      }

      setIsReading(true)
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setIsReading(false)
        void onPhotoReady(base64)
      }
      reader.onerror = () => {
        setIsReading(false)
        onError("Errore nella lettura dell'immagine")
      }
      reader.readAsDataURL(file)
    },
    [maxBytes, onError, onPhotoReady]
  )

  return { fileInputRef, openPicker, handleFileChange, isReading }
}
