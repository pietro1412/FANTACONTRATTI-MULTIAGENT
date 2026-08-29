// Re-export dalla fonte condivisa (src/utils/time-remaining.ts) per retrocompatibilità.
export { getTimeRemaining } from '@/utils/time-remaining'
export type { TimeRemaining } from '@/utils/time-remaining'

// Re-export dalla fonte condivisa (src/utils/stat-format.ts): stessa scala colori
// età usata ovunque nella piattaforma (canonica sulla modale statistiche giocatore).
export { getAgeColor } from '@/utils/stat-format'

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
