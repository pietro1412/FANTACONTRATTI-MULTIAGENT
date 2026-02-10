import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface Member {
  id: string
  role: string
  status: string
  currentBudget: number
  teamName?: string
  user: { id: string; username: string; email: string }
}

interface PrizeHistoryItem {
  id: string
  teamName: string
  username: string
  adminUsername: string
  amount: number
  reason: string | null
  createdAt: string
}

export interface AdminPrizesTabProps {
  activeMembers: Member[]
  selectedPrizeMemberId: string
  setSelectedPrizeMemberId: (id: string) => void
  prizeAmount: string
  setPrizeAmount: (amount: string) => void
  prizeReason: string
  setPrizeReason: (reason: string) => void
  prizeHistory: PrizeHistoryItem[]
  isLoadingPrizes: boolean
  isSubmitting: boolean
  handleAssignPrize: () => void
}

export function AdminPrizesTab({
  activeMembers,
  selectedPrizeMemberId,
  setSelectedPrizeMemberId,
  prizeAmount,
  setPrizeAmount,
  prizeReason,
  setPrizeReason,
  prizeHistory,
  isLoadingPrizes,
  isSubmitting,
  handleAssignPrize,
}: AdminPrizesTabProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      <div className="p-5 border-b border-surface-50/20">
        <h3 className="text-xl font-bold text-white">Assegna Premi</h3>
        <p className="text-sm text-gray-400 mt-1">
          Incrementa il budget dei Direttori Generali come premio per i risultati del semestre
        </p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form per assegnare premio */}
          <div className="bg-surface-300 rounded-lg p-5">
            <h4 className="font-semibold text-white mb-4">Nuovo Premio</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Direttore Generale</label>
                <select
                  value={selectedPrizeMemberId}
                  onChange={(e) => setSelectedPrizeMemberId(e.target.value)}
                  className="w-full bg-surface-200 border border-surface-50/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-500/50"
                >
                  <option value="">Seleziona Direttore Generale...</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.teamName} ({m.user.username}) - {m.currentBudget}M
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Importo (M)</label>
                <Input
                  type="number"
                  value={prizeAmount}
                  onChange={(e) => setPrizeAmount(e.target.value)}
                  placeholder="es. 50"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Motivazione (opzionale)</label>
                <Input
                  type="text"
                  value={prizeReason}
                  onChange={(e) => setPrizeReason(e.target.value)}
                  placeholder="es. 1° classificato, miglior attacco..."
                />
              </div>
              <Button
                onClick={handleAssignPrize}
                disabled={isSubmitting || !selectedPrizeMemberId || !prizeAmount}
                className="w-full"
              >
                {isSubmitting ? 'Assegnando...' : 'Assegna Premio'}
              </Button>
            </div>
          </div>

          {/* Riepilogo budget attuali */}
          <div className="bg-surface-300 rounded-lg p-5">
            <h4 className="font-semibold text-white mb-4">Budget Attuali</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeMembers
                .sort((a, b) => b.currentBudget - a.currentBudget)
                .map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-surface-200 rounded-lg"
                  >
                    <div>
                      <span className="text-white font-medium">{m.teamName}</span>
                      <span className="text-gray-500 text-sm ml-2">({m.user.username})</span>
                    </div>
                    <span className={`font-bold ${m.currentBudget < 0 ? 'text-danger-400' : 'text-secondary-400'}`}>
                      {m.currentBudget}M
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Storico premi */}
        <div className="mt-6">
          <h4 className="font-semibold text-white mb-4">Storico Premi</h4>
          {isLoadingPrizes ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto"></div>
            </div>
          ) : prizeHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nessun premio assegnato
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">DG</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Importo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Motivazione</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Assegnato da</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50/10">
                  {prizeHistory.map(prize => (
                    <tr key={prize.id} className="hover:bg-surface-300/50">
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(prize.createdAt).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{prize.teamName}</span>
                        <span className="text-gray-500 text-sm ml-2">({prize.username})</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-secondary-400 font-bold">+{prize.amount}M</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {prize.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {prize.adminUsername}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
