import type { ManagersStatusData, ManagerData, FirstMarketStatus } from '../../types/auctionroom.types'

interface ManagersTableProps {
  managersStatus: ManagersStatusData | null
  firstMarketStatus: FirstMarketStatus | null
  onSelectManager: (m: ManagerData) => void
  getBudgetPercentage: (current: number, initial?: number) => number
}

export function ManagersTable({
  managersStatus,
  firstMarketStatus,
  onSelectManager,
  getBudgetPercentage,
}: ManagersTableProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      <div className="p-2 border-b border-surface-50/20 bg-surface-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>&#x1F454;</span>
            <h3 className="font-bold text-white text-sm">Direttori Generali</h3>
          </div>
          {managersStatus?.allConnected === false && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <span className="connection-dot connection-dot-offline"></span>
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Tabella Manager */}
      <div className="overflow-x-auto">
        {!managersStatus && (
          <div className="p-3 text-center">
            <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto"></div>
          </div>
        )}
        {managersStatus?.managers && (
          <table className="w-full text-xs">
            {/* Header */}
            <thead className="bg-surface-300/50">
              <tr>
                <th className="px-2 py-1.5 text-left text-gray-400 font-medium">#</th>
                <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Manager</th>
                <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Bilancio (Budget - Ingaggi)">Disp.</th>
                <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Costo Acquisti">Acquisti</th>
                <th className="px-2 py-1.5 text-center text-gray-400 font-medium" title="Monte Ingaggi">Ingaggi</th>
                <th className="px-2 py-1.5 text-center text-yellow-400 font-medium" title="Portieri">P</th>
                <th className="px-2 py-1.5 text-center text-green-400 font-medium" title="Difensori">D</th>
                <th className="px-2 py-1.5 text-center text-blue-400 font-medium" title="Centrocampisti">C</th>
                <th className="px-2 py-1.5 text-center text-red-400 font-medium" title="Attaccanti">A</th>
              </tr>
            </thead>
            {/* Body */}
            <tbody className="divide-y divide-surface-50/10">
              {(() => {
                const sortedManagers = [...managersStatus.managers].sort((a, b) => {
                  if (!firstMarketStatus?.turnOrder) return 0
                  const aIndex = firstMarketStatus.turnOrder.indexOf(a.id)
                  const bIndex = firstMarketStatus.turnOrder.indexOf(b.id)
                  return aIndex - bIndex
                })
                return sortedManagers.map(m => {
                  const turnIndex = firstMarketStatus?.turnOrder?.indexOf(m.id) ?? -1
                  const isCurrent = m.isCurrentTurn
                  const isMe = m.id === managersStatus.myId
                  // Calcola budget speso sommando i prezzi di acquisizione
                  const budgetSpent = m.roster.reduce((sum, r) => sum + (r.acquisitionPrice || 0), 0)
                  // Monte ingaggi: somma salary di tutti i contratti attivi
                  const monteIngaggi = m.roster.reduce((sum, r) => sum + (r.contract?.salary || 0), 0)
                  // Bilancio reale = budget - monte ingaggi
                  const bilancio = m.currentBudget - monteIngaggi
                  const budgetPercent = getBudgetPercentage(bilancio)

                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectManager(m)}
                      className={`cursor-pointer hover:bg-surface-300/50 transition-colors ${
                        isCurrent ? 'bg-accent-500/10' : ''
                      } ${isMe && !isCurrent ? 'bg-primary-500/5' : ''}`}
                    >
                      {/* Turno + Connessione */}
                      <td className="px-2 py-2">
                        <div className="relative inline-flex">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCurrent
                              ? 'bg-accent-500 text-dark-900'
                              : 'bg-surface-300 text-gray-400'
                          }`}>
                            {turnIndex >= 0 ? turnIndex + 1 : '-'}
                          </span>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-200 ${
                              m.isConnected === true ? 'bg-green-500' : m.isConnected === false ? 'bg-red-500' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Nome Manager */}
                      <td className="px-2 py-2">
                        <div className={`truncate max-w-[80px] font-medium ${
                          isMe ? 'text-primary-400' : isCurrent ? 'text-accent-400' : 'text-gray-200'
                        }`}>
                          {m.username}
                          {isMe && <span className="text-primary-300 ml-0.5">&bull;</span>}
                        </div>
                      </td>

                      {/* Bilancio (Budget - Monte Ingaggi) */}
                      <td className="px-2 py-2 text-center">
                        <span className={`font-mono font-bold ${
                          budgetPercent <= 20 ? 'text-red-400' : budgetPercent <= 40 ? 'text-amber-400' : 'text-green-400'
                        }`}>
                          {bilancio}
                        </span>
                      </td>

                      {/* Costo Acquisti */}
                      <td className="px-2 py-2 text-center">
                        <span className="font-mono text-gray-400">
                          {budgetSpent}
                        </span>
                      </td>

                      {/* Monte Ingaggi */}
                      <td className="px-2 py-2 text-center">
                        <span className="font-mono text-gray-400">
                          {monteIngaggi}
                        </span>
                      </td>

                      {/* Slot Portieri */}
                      <td className="px-2 py-2 text-center">
                        <span className={`font-mono ${
                          m.slotsByPosition.P.filled >= m.slotsByPosition.P.total ? 'text-yellow-400' : 'text-gray-500'
                        }`}>
                          {m.slotsByPosition.P.filled}/{m.slotsByPosition.P.total}
                        </span>
                      </td>

                      {/* Slot Difensori */}
                      <td className="px-2 py-2 text-center">
                        <span className={`font-mono ${
                          m.slotsByPosition.D.filled >= m.slotsByPosition.D.total ? 'text-green-400' : 'text-gray-500'
                        }`}>
                          {m.slotsByPosition.D.filled}/{m.slotsByPosition.D.total}
                        </span>
                      </td>

                      {/* Slot Centrocampisti */}
                      <td className="px-2 py-2 text-center">
                        <span className={`font-mono ${
                          m.slotsByPosition.C.filled >= m.slotsByPosition.C.total ? 'text-blue-400' : 'text-gray-500'
                        }`}>
                          {m.slotsByPosition.C.filled}/{m.slotsByPosition.C.total}
                        </span>
                      </td>

                      {/* Slot Attaccanti */}
                      <td className="px-2 py-2 text-center">
                        <span className={`font-mono ${
                          m.slotsByPosition.A.filled >= m.slotsByPosition.A.total ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          {m.slotsByPosition.A.filled}/{m.slotsByPosition.A.total}
                        </span>
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
