import { Modal, ModalHeader, ModalBody } from '../ui/Modal'
import { getPlayerPhotoUrl } from '../../utils/player-images'
import { POSITION_COLORS } from '../../types/rubata.types'
import type { BoardPlayer } from '../../types/rubata.types'

interface PlayerCompareModalProps {
  isOpen: boolean
  onClose: () => void
  players: BoardPlayer[]
}

function CompareStatRow({ label, values, format, higherIsBetter = true }: {
  label: string
  values: (number | null | undefined)[]
  format?: (v: number) => string
  higherIsBetter?: boolean
}) {
  const numericVals = values.filter((v): v is number => v != null)
  const bestVal = numericVals.length > 0
    ? (higherIsBetter ? Math.max(...numericVals) : Math.min(...numericVals))
    : null

  return (
    <div
      className="grid gap-1.5 md:gap-2 py-1.5 border-b border-surface-50/10 last:border-0 items-center"
      style={{ gridTemplateColumns: `80px repeat(${values.length}, 1fr)` }}
    >
      <span className="text-gray-400 text-[11px] md:text-xs">{label}</span>
      {values.map((v, i) => {
        const isBest = v != null && bestVal != null && v === bestVal && numericVals.filter(x => x === bestVal).length === 1
        return (
          <span
            key={i}
            className={`text-center text-sm font-medium ${
              isBest ? 'text-secondary-400 font-bold' : v != null ? 'text-white' : 'text-gray-500'
            }`}
          >
            {v != null ? (format ? format(v) : String(v)) : '-'}
          </span>
        )
      })}
    </div>
  )
}

export function PlayerCompareModal({ isOpen, onClose, players }: PlayerCompareModalProps) {
  if (players.length < 2) return null

  const colTemplate = `80px repeat(${players.length}, 1fr)`

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader>
        <span className="text-lg font-bold flex items-center gap-2">
          <span>⚖️</span> Confronto Giocatori
        </span>
      </ModalHeader>
      <ModalBody className="max-h-[70vh]">
        {/* Player headers */}
        <div className="grid gap-2 mb-4 pb-3 border-b border-surface-50/20" style={{ gridTemplateColumns: colTemplate }}>
          <div />
          {players.map(p => (
            <div key={p.playerId} className="text-center">
              {p.playerApiFootballId ? (
                <img
                  src={getPlayerPhotoUrl(p.playerApiFootballId)}
                  alt={p.playerName}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover bg-surface-300 mx-auto mb-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-1 ${POSITION_COLORS[p.playerPosition] ?? ''}`}>
                  {p.playerPosition}
                </div>
              )}
              <p className="text-xs md:text-sm font-bold text-white truncate">{p.playerName}</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className={`text-[10px] font-bold px-1 rounded ${POSITION_COLORS[p.playerPosition] ?? ''}`}>
                  {p.playerPosition}
                </span>
                <span className="text-[10px] text-gray-500 truncate">{p.playerTeam}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Contract section */}
        <div className="mb-4">
          <h4 className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">Contratto</h4>
          <CompareStatRow label="Ingaggio" values={players.map(p => p.contractSalary)} format={v => `${v}M`} higherIsBetter={false} />
          <CompareStatRow label="Durata" values={players.map(p => p.contractDuration)} format={v => `${v}s`} />
          <CompareStatRow label="Clausola" values={players.map(p => p.contractClause)} format={v => `${v}M`} higherIsBetter={false} />
          <CompareStatRow label="Prezzo Rubata" values={players.map(p => p.rubataPrice)} format={v => `${v}M`} higherIsBetter={false} />
          <CompareStatRow label="Età" values={players.map(p => p.playerAge)} higherIsBetter={false} />
          {players.some(p => p.playerQuotation) && (
            <CompareStatRow label="Quotazione" values={players.map(p => p.playerQuotation)} format={v => `${v}M`} />
          )}
        </div>

        {/* Season stats section */}
        {players.some(p => p.playerComputedStats) && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-2">Statistiche Stagione</h4>
            <CompareStatRow label="Presenze" values={players.map(p => p.playerComputedStats?.appearances)} />
            <CompareStatRow
              label="Rating Medio"
              values={players.map(p => p.playerComputedStats?.avgRating)}
              format={v => v.toFixed(2)}
            />
            <CompareStatRow label="Gol" values={players.map(p => p.playerComputedStats?.totalGoals)} />
            <CompareStatRow label="Assist" values={players.map(p => p.playerComputedStats?.totalAssists)} />
            <CompareStatRow label="Minuti" values={players.map(p => p.playerComputedStats?.totalMinutes)} />
            <CompareStatRow label="Titolarità" values={players.map(p => p.playerComputedStats?.startingXI)} />
            {players.some(p => p.playerComputedStats && p.playerComputedStats.appearances > 0) && (
              <CompareStatRow
                label="Min/Partita"
                values={players.map(p => {
                  const s = p.playerComputedStats
                  if (!s || s.appearances === 0) return null
                  return Math.round(s.totalMinutes / s.appearances)
                })}
              />
            )}
            {players.some(p => p.playerComputedStats && p.playerComputedStats.totalGoals > 0) && (
              <CompareStatRow
                label="Min/Gol"
                values={players.map(p => {
                  const s = p.playerComputedStats
                  if (!s || s.totalGoals === 0 || s.totalMinutes === 0) return null
                  return Math.round(s.totalMinutes / s.totalGoals)
                })}
                higherIsBetter={false}
              />
            )}
          </div>
        )}

        {/* No stats message */}
        {!players.some(p => p.playerComputedStats) && (
          <div className="text-center py-4 text-gray-500 text-sm">
            Nessuna statistica stagionale disponibile per questi giocatori
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}
