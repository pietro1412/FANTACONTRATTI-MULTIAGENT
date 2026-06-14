import type { ReactNode } from 'react'

type SuccessTone = 'secondary' | 'danger'

interface AuthSuccessCardProps {
  /** Icon node (emoji or svg) shown inside the circle. */
  icon: ReactNode
  title: string
  /** Body message (string or rich node). */
  message: ReactNode
  /** Optional action row (link/button) shown below a divider. */
  action?: ReactNode
  /** Color tone of the icon circle. Default secondary (success). */
  tone?: SuccessTone
}

const toneStyles: Record<SuccessTone, string> = {
  secondary: 'bg-secondary-500/12 border-secondary-500/40 text-secondary-400',
  danger: 'bg-danger-500/12 border-danger-500/40 text-danger-400',
}

/**
 * Shared centered "outcome" card: circle + icon + title + message + optional action.
 * Used for ForgotPassword (email sent), ResetPassword success/invalid-token.
 */
export function AuthSuccessCard({ icon, title, message, action, tone = 'secondary' }: AuthSuccessCardProps) {
  return (
    <div className="text-center">
      <div
        className={`w-16 h-16 rounded-full border flex items-center justify-center text-3xl mx-auto mb-4 ${toneStyles[tone]}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h1 className="font-display text-xl font-bold text-white">{title}</h1>
      <div className="text-sm text-gray-400 mt-2 leading-relaxed">{message}</div>
      {action && (
        <>
          <div className="h-px bg-surface-50/20 my-4" />
          <div className="flex flex-col items-center gap-2">{action}</div>
        </>
      )}
    </div>
  )
}
