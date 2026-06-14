// Formattazione condivisa del tempo rimanente a una scadenza (inviti, scambi, ...).
// Fonte unica: prima duplicata in trades/utils.ts, InviteDetail e PendingInvites.

export interface TimeRemaining {
  text: string
  isUrgent: boolean
  isExpired: boolean
}

/** Tempo rimanente in forma compatta ("5g 2h", "3h 10m", "12m", "Scaduta"). */
export function getTimeRemaining(expiresAt: string | undefined): TimeRemaining {
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
