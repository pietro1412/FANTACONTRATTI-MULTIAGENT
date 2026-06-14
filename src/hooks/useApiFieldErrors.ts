import { useCallback, useState } from 'react'

/** Shape of a single validation error returned by the API (ApiResponse.errors[n]). */
export interface ApiFieldError {
  message: string
  path?: string[]
}

/** Minimal slice of ApiResponse this hook consumes. */
interface ApiErrorResult {
  message?: string
  errors?: ApiFieldError[]
}

interface UseApiFieldErrorsResult<TField extends string> {
  /** Per-field error messages keyed by field name. */
  fieldErrors: Partial<Record<TField, string>>
  /** Generic (non-field) error message, when the API gave no field-specific errors. */
  generalError: string
  /**
   * Map an ApiResponse failure into field errors + a general fallback message.
   * Returns true when at least one field-specific error was applied.
   */
  applyApiErrors: (result: ApiErrorResult, fallbackMessage: string) => boolean
  /** Clear a single field error (e.g. when the user edits that field). */
  clearFieldError: (field: TField) => void
  /** Set field errors directly (e.g. client-side validation). */
  setFieldErrors: React.Dispatch<React.SetStateAction<Partial<Record<TField, string>>>>
  /** Reset all errors. */
  resetErrors: () => void
}

/**
 * Extracts the duplicated "result.errors.forEach(e => map[e.path[0]] = e.message)"
 * pattern shared by Login, Register and CreateLeague.
 */
export function useApiFieldErrors<TField extends string>(): UseApiFieldErrorsResult<TField> {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TField, string>>>({})
  const [generalError, setGeneralError] = useState('')

  const applyApiErrors = useCallback((result: ApiErrorResult, fallbackMessage: string): boolean => {
    if (result.errors && result.errors.length > 0) {
      const next: Partial<Record<TField, string>> = {}
      result.errors.forEach(err => {
        const field = err.path?.[0] as TField | undefined
        if (field && !next[field]) {
          next[field] = err.message
        }
      })
      setFieldErrors(next)

      if (Object.keys(next).length === 0) {
        setGeneralError(result.message || fallbackMessage)
        return false
      }
      setGeneralError('')
      return true
    }

    setFieldErrors({})
    setGeneralError(result.message || fallbackMessage)
    return false
  }, [])

  const clearFieldError = useCallback((field: TField) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      return { ...prev, [field]: undefined }
    })
  }, [])

  const resetErrors = useCallback(() => {
    setFieldErrors({})
    setGeneralError('')
  }, [])

  return { fieldErrors, generalError, applyApiErrors, clearFieldError, setFieldErrors, resetErrors }
}
