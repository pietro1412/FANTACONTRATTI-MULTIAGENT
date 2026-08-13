import { getAccessToken } from '@/services/api'

// Fire-and-forget: never crash the app from the reporter itself.
function report(
  severity: 'ERROR' | 'CRITICAL',
  message: string,
  metadata: Record<string, unknown>
): void {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  fetch(`${apiUrl}/api/logs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      severity,
      category: 'ERROR',
      message: message.slice(0, 2000),
      metadata: {
        version: __APP_VERSION__,
        commit: __GIT_COMMIT__,
        branch: __GIT_BRANCH__,
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...metadata,
      },
    }),
  }).catch(() => {
    // Swallow — logging must never break the app
  })
}

let installed = false

// Registers global handlers for uncaught errors and unhandled promise rejections.
// Errors land in AppLog (source FRONTEND) with session context, so superadmin can
// correlate them with user feedback (Livello 2 evidenze beta).
export function installFrontendErrorReporter(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    const error = event.error
    if (error instanceof Error) {
      report('ERROR', `window.onerror: ${error.message}`, {
        stack: error.stack?.slice(0, 4000),
      })
    } else if (event.message) {
      report('ERROR', `window.onerror: ${event.message}`, {
        filename: event.filename,
        lineNo: event.lineno,
        colNo: event.colno,
      })
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    report('ERROR', `unhandledrejection: ${message}`, {
      stack: stack?.slice(0, 4000),
      raw: String(reason).slice(0, 2000),
    })
  })
}
