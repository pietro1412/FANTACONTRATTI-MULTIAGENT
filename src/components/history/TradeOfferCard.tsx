interface TradeOfferCardProps {
  trade: {
    id: string
    status: string
    sender: { userId: string; username: string; teamName: string | null }
    receiver: { userId: string; username: string; teamName: string | null }
    offeredBudget: number
    requestedBudget: number
    message: string | null
    offeredPlayers: Array<{
      id: string
      name: string
      position: string
      team: string
      contract: { salary: number; duration: number; rescissionClause: number | null } | null
    }>
    requestedPlayers: Array<{
      id: string
      name: string
      position: string
      team: string
      contract: { salary: number; duration: number; rescissionClause: number | null } | null
    }>
    createdAt: string
    respondedAt: string | null
  }
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In attesa' },
  ACCEPTED: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Accettato' },
  REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rifiutato' },
  COUNTERED: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Controproposta' },
  CANCELLED: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Annullato' },
  EXPIRED: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Scaduto' },
}

const positionColors: Record<string, string> = {
  P: 'bg-amber-500/20 text-amber-400',
  D: 'bg-blue-500/20 text-blue-400',
  C: 'bg-emerald-500/20 text-emerald-400',
  A: 'bg-red-500/20 text-red-400',
}

export function TradeOfferCard({ trade }: TradeOfferCardProps) {
  const status = statusConfig[trade.status] ?? { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In attesa' }

  return (
    <div className={`rounded-lg border ${
      trade.status === 'ACCEPTED' ? 'border-green-500/30 bg-green-500/5' :
      trade.status === 'REJECTED' ? 'border-red-500/30 bg-red-500/5' :
      'border-surface-50/20 bg-surface-300/30'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-surface-50/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              {trade.sender.teamName || trade.sender.username}
            </span>
            <span className="text-gray-500">→</span>
            <span className="font-medium text-white">
              {trade.receiver.teamName || trade.receiver.username}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {new Date(trade.createdAt).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Offered */}
          <div>
            <h5 className="text-sm font-medium text-gray-400 mb-2">
              Offerta di {trade.sender.teamName || trade.sender.username}
            </h5>
            <div className="space-y-2">
              {trade.offeredPlayers.map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
              {trade.offeredPlayers.length === 0 && trade.offeredBudget === 0 && (
                <p className="text-sm text-gray-500 italic">Nessun giocatore</p>
              )}
              {trade.offeredBudget > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary-400 font-medium">+{trade.offeredBudget}M</span>
                  <span className="text-gray-500">budget</span>
                </div>
              )}
            </div>
          </div>

          {/* Requested */}
          <div>
            <h5 className="text-sm font-medium text-gray-400 mb-2">
              Richiesta a {trade.receiver.teamName || trade.receiver.username}
            </h5>
            <div className="space-y-2">
              {trade.requestedPlayers.map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
              {trade.requestedPlayers.length === 0 && trade.requestedBudget === 0 && (
                <p className="text-sm text-gray-500 italic">Nessun giocatore</p>
              )}
              {trade.requestedBudget > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-primary-400 font-medium">+{trade.requestedBudget}M</span>
                  <span className="text-gray-500">budget</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message */}
        {trade.message && (
          <div className="mt-4 pt-3 border-t border-surface-50/10">
            <p className="text-sm text-gray-400 italic">"{trade.message}"</p>
          </div>
        )}

        {/* Response date */}
        {trade.respondedAt && trade.status !== 'PENDING' && (
          <div className="mt-3 text-xs text-gray-500">
            Risposta: {new Date(trade.respondedAt).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerRow({ player }: {
  player: {
    id: string
    name: string
    position: string
    team: string
    contract: { salary: number; duration: number; rescissionClause: number | null } | null
  }
}) {
  return (
    <div className="flex items-center justify-between bg-surface-300/30 rounded px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${positionColors[player.position]}`}>
          {player.position}
        </span>
        <span className="text-sm text-white">{player.name}</span>
        <span className="text-xs text-gray-500">{player.team}</span>
      </div>
      {player.contract && (
        <div className="text-xs text-gray-400">
          {player.contract.salary}M / {player.contract.duration}a
          {player.contract.rescissionClause && (
            <span className="ml-1 text-yellow-500">RC:{player.contract.rescissionClause}M</span>
          )}
        </div>
      )}
    </div>
  )
}
