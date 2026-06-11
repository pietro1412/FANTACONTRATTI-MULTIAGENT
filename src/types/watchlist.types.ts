// Watchlist categories (#219) — single source of truth shared between
// StrategieRubata (editing) and Rubata (display). Colors use Stadium Nights tokens.
export const WATCHLIST_CATEGORIES = {
  DA_RUBARE: { label: 'Da Rubare', color: 'bg-danger-500/20 text-danger-400 border-danger-500/30', icon: 'T' },
  SOTTO_OSSERVAZIONE: { label: 'Osservazione', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30', icon: 'O' },
  POTENZIALE_ACQUISTO: { label: 'Pot. Acquisto', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30', icon: 'A' },
  SCAMBIO: { label: 'Scambio', color: 'bg-primary-500/20 text-primary-400 border-primary-500/30', icon: 'S' },
  DA_VENDERE: { label: 'Da Vendere', color: 'bg-passion-500/20 text-passion-400 border-passion-500/30', icon: 'V' },
} as const

export type WatchlistCategoryId = keyof typeof WATCHLIST_CATEGORIES

export function getWatchlistCategory(categoryId: string | null | undefined) {
  if (!categoryId) return null
  return (WATCHLIST_CATEGORIES as Record<string, { label: string; color: string; icon: string }>)[categoryId] ?? null
}
