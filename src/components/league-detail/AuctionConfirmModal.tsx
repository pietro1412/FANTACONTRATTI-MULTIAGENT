import { Button } from '../ui/Button'

interface AuctionConfirmModalProps {
  isRegularMarket: boolean
  activeMembers: number
  isCreating: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AuctionConfirmModal({
  isRegularMarket,
  activeMembers,
  isCreating,
  onConfirm,
  onCancel,
}: AuctionConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-200 rounded-2xl p-8 max-w-md w-full border border-surface-50/20 shadow-2xl">
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-full ${isRegularMarket ? 'bg-gradient-to-br from-primary-500 to-primary-700' : 'bg-gradient-to-br from-secondary-500 to-secondary-700'} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            <span className="text-4xl">{isRegularMarket ? '\uD83D\uDD04' : '\uD83C\uDFC1'}</span>
          </div>
          <h3 className="text-2xl font-bold text-white">
            {isRegularMarket ? 'Avvia Mercato Ricorrente' : "Avvia Sessione d'Asta"}
          </h3>
          <p className={`${isRegularMarket ? 'text-primary-400' : 'text-secondary-400'} font-medium mt-1`}>
            {isRegularMarket ? 'Fase: Mercato Ricorrente' : 'Fase: Primo Mercato'}
          </p>
        </div>

        <div className="bg-surface-300 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400">DG partecipanti</span>
            <span className={`text-3xl font-bold ${isRegularMarket ? 'text-primary-400' : 'text-secondary-400'}`}>{activeMembers}</span>
          </div>
          <div className="text-center pt-3 border-t border-surface-50/20">
            <p className="text-sm text-gray-400">
              {isRegularMarket
                ? 'Il mercato inizier\u00E0 con la fase Scambi e Offerte'
                : `L'asta partir\u00E0 con ${activeMembers} DG`}
            </p>
          </div>
        </div>

        <p className="text-base text-gray-300 mb-6 text-center">
          {isRegularMarket
            ? 'Sei sicuro di voler avviare il mercato ricorrente?'
            : "Sei sicuro di voler avviare la sessione d'asta?"}
        </p>

        <div className="flex gap-4">
          <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={isCreating}>
            Annulla
          </Button>
          <Button
            size="lg"
            variant={isRegularMarket ? 'primary' : 'secondary'}
            className="flex-1"
            onClick={onConfirm}
            disabled={isCreating}
          >
            {isCreating ? 'Creazione...' : isRegularMarket ? 'Avvia Mercato' : 'Avvia Asta'}
          </Button>
        </div>
      </div>
    </div>
  )
}
