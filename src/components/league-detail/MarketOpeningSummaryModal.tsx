import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export interface MarketOpeningSummary {
  contractsDecremented: number
  playersReleased: string[]
  ritiratiAutoReleased?: { released: number; players: string[] }
}

interface MarketOpeningSummaryModalProps {
  summary: MarketOpeningSummary
  onClose: () => void
}

function PlayerNameList({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return (
    <div className="mt-2 max-h-32 overflow-y-auto rounded-md bg-surface-200/60 p-2 text-xs text-gray-300">
      {names.map((name, i) => (
        <span key={`${name}-${i}`} className="inline-block mr-2 mb-1 rounded bg-surface-100/40 px-1.5 py-0.5">
          {name}
        </span>
      ))}
    </div>
  )
}

export function MarketOpeningSummaryModal({ summary, onClose }: MarketOpeningSummaryModalProps) {
  const expiredCount = summary.playersReleased.length
  const ritiratiCount = summary.ritiratiAutoReleased?.released ?? 0

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <div className="p-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">{'🔄'}</span>
          </div>
          <h3 className="text-2xl font-bold text-white">Mercato Ricorrente Avviato</h3>
          <p className="text-primary-400 font-medium mt-1">Eventi di apertura</p>
        </div>

        <div className="space-y-3">
          {/* Decremento durata */}
          <div className="bg-surface-300 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-medium">Contratti decrementati</p>
              <p className="text-sm text-gray-400">Durata −1 semestre, clausola ricalcolata</p>
            </div>
            <span className="text-3xl font-bold text-primary-400">{summary.contractsDecremented}</span>
          </div>

          {/* Svincoli per scadenza */}
          <div className="bg-surface-300 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Svincolati per scadenza</p>
                <p className="text-sm text-gray-400">Contratti arrivati a 0 semestri (gratuito)</p>
              </div>
              <span className="text-3xl font-bold text-yellow-400">{expiredCount}</span>
            </div>
            <PlayerNameList names={summary.playersReleased} />
          </div>

          {/* Svincoli ritirati */}
          {ritiratiCount > 0 && (
            <div className="bg-surface-300 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">Ritirati svincolati</p>
                  <p className="text-sm text-gray-400">Giocatori ritirati rimossi automaticamente</p>
                </div>
                <span className="text-3xl font-bold text-red-400">{ritiratiCount}</span>
              </div>
              <PlayerNameList names={summary.ritiratiAutoReleased?.players ?? []} />
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 mt-6 text-center">
          Il mercato è ora nella fase Scambi e Offerte Pre-Rinnovo.
        </p>

        <div className="mt-6">
          <Button size="lg" variant="primary" className="w-full" onClick={onClose}>
            Ho capito
          </Button>
        </div>
      </div>
    </Modal>
  )
}
