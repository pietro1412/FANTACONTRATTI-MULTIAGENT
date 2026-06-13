import type { NavigateFn } from '@/components/league/attention'

interface QuickAccessTilesProps {
  leagueId: string
  onNavigate: NavigateFn
  /** Numero offerte di scambio ricevute (badge contestuale su "Scambi"). */
  tradeOffers?: number
}

interface Tile {
  key: string
  page: string
  emoji: string
  label: string
  sub: string
}

// Le chiavi di navigazione corrispondono a quelle gestite in App.tsx / Navigation.tsx.
const TILES: Tile[] = [
  { key: 'players', page: 'rose', emoji: '👥', label: 'Rose & Giocatori', sub: 'La tua rosa e quelle avversarie' },
  { key: 'finance', page: 'financials', emoji: '💰', label: 'Finanze', sub: 'Bilanci, ingaggi, storia' },
  { key: 'trades', page: 'trades', emoji: '🤝', label: 'Scambi', sub: 'Offerte e controfferte' },
  { key: 'contracts', page: 'contracts', emoji: '📋', label: 'Contratti', sub: 'Rinnovi e consolidamento' },
  { key: 'strategies', page: 'strategie-rubata', emoji: '🎯', label: 'Strategie Rubata', sub: 'Watchlist e priorità' },
  { key: 'history', page: 'movements', emoji: '📜', label: 'Storico', sub: 'Movimenti e stagioni' },
  { key: 'prophecies', page: 'prophecies', emoji: '🔮', label: 'Profezie', sub: 'Pronostici di lega' },
  { key: 'stats', page: 'playerStats', emoji: '📊', label: 'Statistiche', sub: 'Giocatori e rendimento' },
]

export function QuickAccessTiles({ leagueId, onNavigate, tradeOffers = 0 }: QuickAccessTilesProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="micro-label text-gray-400">Accessi rapidi</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => { onNavigate(tile.page, { leagueId }) }}
            className="flex flex-col gap-2 text-left bg-surface-200 border border-surface-50/20 rounded-xl p-4 min-h-[44px] hover:border-accent-500/40 hover:bg-surface-100 transition-colors group"
          >
            <span className="w-9 h-9 rounded-lg bg-surface-300 border border-surface-50/20 flex items-center justify-center text-base flex-shrink-0">
              {tile.emoji}
            </span>
            <span className="font-display text-sm font-bold text-white group-hover:text-accent-300 transition-colors">
              {tile.label}
            </span>
            {tile.key === 'trades' && tradeOffers > 0 ? (
              <span className="self-start micro-label text-accent-400 bg-accent-500/10 border border-accent-500/30 rounded-full px-2 py-0.5">
                {tradeOffers} {tradeOffers === 1 ? 'offerta' : 'offerte'}
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">{tile.sub}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
