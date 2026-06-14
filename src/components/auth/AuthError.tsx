interface AuthErrorProps {
  /** Error message. When falsy the banner renders nothing. */
  message?: string
}

/** Single error-banner pattern for the auth pages (token-only styling). */
export function AuthError({ message }: AuthErrorProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="bg-danger-500/12 border border-danger-500/40 text-danger-400 rounded-lg px-3 py-2.5 text-sm flex items-center gap-2"
    >
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  )
}
