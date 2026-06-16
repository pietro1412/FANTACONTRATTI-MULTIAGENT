import type { NavigateFn } from '@/components/league/attention'
import { getQuickAccessTiles } from '@/lib/navItems'

interface QuickAccessTilesProps {
  leagueId: string
  onNavigate: NavigateFn
  /** Numero offerte di scambio ricevute (badge contestuale su "Scambi"). */
  tradeOffers?: number
}

// Le tessere derivano dalla sorgente di navigazione unica (src/lib/navItems.ts):
// nessuna lista hardcoded divergente da header/bottom-nav (Assioma 4).
const TILES = getQuickAccessTiles()

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
            onClick={() => { onNavigate(tile.key, { leagueId }) }}
            className="flex flex-col gap-2 text-left bg-surface-200 border border-surface-50/20 rounded-xl p-4 min-h-[44px] hover:border-accent-500/40 hover:bg-surface-100 transition-colors group"
          >
            <span className="w-9 h-9 rounded-lg bg-surface-300 border border-surface-50/20 flex items-center justify-center text-base flex-shrink-0">
              {tile.tile?.emoji}
            </span>
            <span className="font-display text-sm font-bold text-white group-hover:text-accent-300 transition-colors">
              {tile.label}
            </span>
            {tile.key === 'trades' && tradeOffers > 0 ? (
              <span className="self-start micro-label text-accent-400 bg-accent-500/10 border border-accent-500/30 rounded-full px-2 py-0.5">
                {tradeOffers} {tradeOffers === 1 ? 'offerta' : 'offerte'}
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">{tile.tile?.sub}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
