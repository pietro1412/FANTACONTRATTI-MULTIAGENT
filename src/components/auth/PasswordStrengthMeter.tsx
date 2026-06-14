import { getPasswordStrength, PASSWORD_REQUIREMENTS_HINT, type PasswordStrength } from '@/utils/password-policy'

interface PasswordStrengthMeterProps {
  password: string
}

type StrengthToken = PasswordStrength['token']

// Semantic token → bg/text classes (NO raw bg-red/yellow/green/blue-500).
const tokenBg: Record<StrengthToken, string> = {
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  accent: 'bg-accent-500',
  secondary: 'bg-secondary-500',
}
const tokenText: Record<StrengthToken, string> = {
  danger: 'text-danger-400',
  warning: 'text-warning-400',
  accent: 'text-accent-400',
  secondary: 'text-secondary-400',
}

/**
 * Strength meter (4 segments + label) driven by the shared password policy.
 * Renders nothing for an empty password.
 */
export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null
  const strength = getPasswordStrength(password)

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.score ? tokenBg[strength.token] : 'bg-surface-50/20'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center mt-1.5 gap-2">
        <span className="text-[10.5px] text-gray-500">{PASSWORD_REQUIREMENTS_HINT}</span>
        <span className={`micro-label ${tokenText[strength.token]}`}>{strength.label}</span>
      </div>
    </div>
  )
}
