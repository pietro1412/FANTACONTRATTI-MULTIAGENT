export function getTimeRemaining(expiresAt: string | undefined): { text: string; isUrgent: boolean; isExpired: boolean } {
  if (!expiresAt) return { text: 'Nessuna scadenza', isUrgent: false, isExpired: false }

  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { text: 'Scaduta', isUrgent: true, isExpired: true }
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { text: `${days}g ${hours % 24}h`, isUrgent: false, isExpired: false }
  } else if (hours >= 1) {
    return { text: `${hours}h ${minutes}m`, isUrgent: hours < 6, isExpired: false }
  } else {
    return { text: `${minutes}m`, isUrgent: true, isExpired: false }
  }
}

/** Badge ruolo stile cockpit (token semantici: P oro, D blu, C verde, A rosso). */
export function getRoleStyle(position: string) {
  switch (position) {
    case 'P': return { bg: 'bg-accent-500/[0.14]', text: 'text-accent-400', border: 'border-accent-500/40', label: 'POR' }
    case 'D': return { bg: 'bg-primary-500/[0.14]', text: 'text-primary-400', border: 'border-primary-500/40', label: 'DIF' }
    case 'C': return { bg: 'bg-secondary-500/[0.14]', text: 'text-secondary-400', border: 'border-secondary-500/40', label: 'CEN' }
    case 'A': return { bg: 'bg-danger-500/[0.14]', text: 'text-danger-400', border: 'border-danger-500/40', label: 'ATT' }
    default: return { bg: 'bg-surface-100', text: 'text-gray-400', border: 'border-surface-50', label: position }
  }
}

export function getAgeColor(age: number | null | undefined): string {
  if (age === null || age === undefined) return 'text-gray-500'
  if (age < 20) return 'text-secondary-400 font-bold'
  if (age < 25) return 'text-secondary-400'
  if (age < 30) return 'text-warning-400'
  if (age < 35) return 'text-accent-400'
  return 'text-danger-400'
}
