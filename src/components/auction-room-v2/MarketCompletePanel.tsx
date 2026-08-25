interface MarketCompletePanelProps {
  isAdmin: boolean
  leagueId?: string
  onNavigate?: (page: string, params?: Record<string, string>) => void
}

/** Mostrato quando tutti i manager hanno riempito tutti gli slot del Primo
 * Mercato: l'asta (nomine/offerte) non ha più nulla da fare, ma la fase resta
 * formalmente aperta finché l'admin non la chiude da Admin → Fasi & Stato
 * (Bibbia PRIMO-MERCATO.md §5.4/§7 — è un'azione admin esplicita, non automatica). */
export function MarketCompletePanel({ isAdmin, leagueId, onNavigate }: MarketCompletePanelProps) {
  return (
    <div className="text-center space-y-4 py-6">
      <div className="w-14 h-14 mx-auto rounded-full bg-secondary-500/20 flex items-center justify-center">
        <span className="text-2xl">🏁</span>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-1">Primo Mercato completato</h3>
        <p className="text-sm text-gray-400 max-w-sm mx-auto">
          Tutti i manager hanno riempito tutti gli slot della rosa. Non ci sono più giocatori da nominare.
        </p>
      </div>

      {isAdmin ? (
        <div className="space-y-2">
          <p className="text-sms text-warning-400">
            Per procedere devi chiudere ufficialmente il Primo Mercato da Admin → Fasi &amp; Stato.
          </p>
          <button
            type="button"
            onClick={() => { onNavigate?.('admin', { leagueId: leagueId ?? '', tab: 'phases' }); }}
            className="px-4 py-2 text-sm font-semibold bg-secondary-500 hover:bg-secondary-600 text-dark-300 rounded-lg transition-colors"
          >
            Vai a Fasi &amp; Stato →
          </button>
        </div>
      ) : (
        <p className="text-sms text-gray-500">In attesa che l&apos;admin concluda ufficialmente il Primo Mercato.</p>
      )}
    </div>
  )
}
