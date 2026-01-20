import { useState, useEffect } from 'react'
import { historyApi } from '../../services/api'

interface SessionSummary {
  id: string
  type: string
  season: number
  semester: string
  status: string
  currentPhase: string | null
  createdAt: string
  startsAt: string | null
  endsAt: string | null
  counts: {
    auctions: number
    movements: number
    trades: number
    prizes: number
  }
  prizesFinalized: boolean
  prizesFinalizedAt: string | null
}

interface SessionCardProps {
  leagueId: string
  session: SessionSummary
  isExpanded: boolean
  onToggle: () => void
  formatSessionType: (type: string) => string
  formatSemester: (semester: string) => string
  formatSessionTitle: (type: string, season: number, semester: string) => string
}

type TabType = 'overview' | 'firstMarket' | 'trades' | 'prizes' | 'rubata' | 'svincolati'

export function SessionCard({
  leagueId,
  session,
  isExpanded,
  onToggle,
  formatSessionType,
  formatSemester,
  formatSessionTitle,
}: SessionCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [tabData, setTabData] = useState<Record<TabType, unknown>>({
    overview: null,
    firstMarket: null,
    trades: null,
    prizes: null,
    rubata: null,
    svincolati: null,
  })

  const isPrimoMercato = session.type === 'PRIMO_MERCATO'

  useEffect(() => {
    if (isExpanded && !tabData[activeTab]) {
      loadTabData(activeTab)
    }
  }, [isExpanded, activeTab])

  async function loadTabData(tab: TabType) {
    if (tabData[tab]) return

    setIsLoading(true)
    try {
      let result
      switch (tab) {
        case 'overview':
          result = await historyApi.getSessionDetails(leagueId, session.id)
          break
        case 'firstMarket':
          result = await historyApi.getFirstMarketHistory(leagueId, session.id)
          break
        case 'trades':
          result = await historyApi.getSessionTrades(leagueId, session.id, { status: 'ALL' })
          break
        case 'prizes':
          result = await historyApi.getSessionPrizes(leagueId, session.id)
          break
        case 'rubata':
          result = await historyApi.getSessionRubata(leagueId, session.id)
          break
        case 'svincolati':
          result = await historyApi.getSessionSvincolati(leagueId, session.id)
          break
      }

      if (result?.success && result.data) {
        setTabData(prev => ({ ...prev, [tab]: result.data }))
      }
    } catch (err) {
      console.error('Error loading tab data:', err)
    }
    setIsLoading(false)
  }

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-gray-500/20 text-gray-400',
    ACTIVE: 'bg-green-500/20 text-green-400',
    COMPLETED: 'bg-blue-500/20 text-blue-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-surface-300/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">
            {isPrimoMercato ? '🏆' : '🔄'}
          </div>
          <div className="text-left">
            <h3 className="font-bold text-white text-lg">
              {formatSessionTitle(session.type, session.season, session.semester)}
            </h3>
            <p className="text-sm text-gray-400">
              {session.startsAt && (
                <span>
                  {new Date(session.startsAt).toLocaleDateString('it-IT')}
                </span>
              )}
              {session.currentPhase && (
                <span className="ml-2">
                  • Fase: {session.currentPhase.replace(/_/g, ' ')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Counts */}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-gray-400">
              <span className="font-medium text-white">{session.counts.auctions}</span> aste
            </span>
            <span className="text-gray-400">
              <span className="font-medium text-white">{session.counts.trades}</span> scambi
            </span>
            <span className="text-gray-400">
              <span className="font-medium text-white">{session.counts.movements}</span> movimenti
            </span>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[session.status] || 'bg-gray-500/20 text-gray-400'}`}>
            {session.status}
          </span>

          {/* Expand Icon */}
          <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-surface-50/20">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-surface-50/20">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              label="Riepilogo"
            />
            {isPrimoMercato && (
              <TabButton
                active={activeTab === 'firstMarket'}
                onClick={() => setActiveTab('firstMarket')}
                label="Aste"
              />
            )}
            <TabButton
              active={activeTab === 'trades'}
              onClick={() => setActiveTab('trades')}
              label="Scambi"
              count={session.counts.trades}
            />
            <TabButton
              active={activeTab === 'prizes'}
              onClick={() => setActiveTab('prizes')}
              label="Premi"
              disabled={!session.prizesFinalized}
            />
            {!isPrimoMercato && (
              <>
                <TabButton
                  active={activeTab === 'rubata'}
                  onClick={() => setActiveTab('rubata')}
                  label="Rubata"
                />
                <TabButton
                  active={activeTab === 'svincolati'}
                  onClick={() => setActiveTab('svincolati')}
                  label="Svincolati"
                />
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewTab data={tabData.overview} />}
                {activeTab === 'firstMarket' && <FirstMarketTab data={tabData.firstMarket} />}
                {activeTab === 'trades' && <TradesTab data={tabData.trades} />}
                {activeTab === 'prizes' && <PrizesTab data={tabData.prizes} />}
                {activeTab === 'rubata' && <RubataTab data={tabData.rubata} />}
                {activeTab === 'svincolati' && <SvincolatiTab data={tabData.svincolati} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'text-primary-400 border-b-2 border-primary-400'
          : disabled
          ? 'text-gray-600 cursor-not-allowed'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-xs bg-surface-300 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  )
}

// Tab Content Components

// Label mappings for human-readable names
const auctionTypeLabels: Record<string, string> = {
  FREE_BID: 'Asta Svincolati',
  RUBATA: 'Asta Rubata',
  FIRST_MARKET: 'Primo Mercato',
}

const tradeStatusLabels: Record<string, string> = {
  ACCEPTED: 'Accettati',
  REJECTED: 'Rifiutati',
  PENDING: 'In attesa',
  COUNTERED: 'Contro-offerti',
  CANCELLED: 'Annullati',
  EXPIRED: 'Scaduti',
}

const movementTypeLabels: Record<string, string> = {
  FIRST_MARKET: 'Acquisti Primo Mercato',
  TRADE: 'Scambi',
  RUBATA: 'Rubate',
  SVINCOLATI: 'Svincolati',
  RELEASE: 'Cessioni',
  CONTRACT_RENEW: 'Rinnovi Contratto',
}

function OverviewTab({ data }: { data: unknown }) {
  if (!data) return <div className="text-gray-400">Caricamento...</div>

  const { summary } = data as {
    session: { type: string; season: number; semester: string; status: string }
    summary: {
      auctions: Record<string, number>
      trades: Record<string, number>
      movements: Record<string, number>
      prizesFinalized: boolean
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Auctions Summary */}
      <div className="bg-surface-300/50 rounded-lg p-4">
        <h4 className="font-medium text-white mb-3">Aste</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(summary.auctions).map(([type, count]) => (
            <div key={type} className="flex justify-between">
              <span className="text-gray-400">{auctionTypeLabels[type] || type}</span>
              <span className="text-white font-medium">{count} {count === 1 ? 'asta' : 'aste'}</span>
            </div>
          ))}
          {Object.keys(summary.auctions).length === 0 && (
            <p className="text-gray-500">Nessuna asta</p>
          )}
        </div>
      </div>

      {/* Trades Summary */}
      <div className="bg-surface-300/50 rounded-lg p-4">
        <h4 className="font-medium text-white mb-3">Scambi</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(summary.trades).map(([status, count]) => (
            <div key={status} className="flex justify-between">
              <span className="text-gray-400">{tradeStatusLabels[status] || status}</span>
              <span className={`font-medium ${
                status === 'ACCEPTED' ? 'text-green-400' :
                status === 'REJECTED' ? 'text-red-400' :
                'text-white'
              }`}>{count} {count === 1 ? 'scambio' : 'scambi'}</span>
            </div>
          ))}
          {Object.keys(summary.trades).length === 0 && (
            <p className="text-gray-500">Nessuno scambio</p>
          )}
        </div>
      </div>

      {/* Movements Summary */}
      <div className="bg-surface-300/50 rounded-lg p-4">
        <h4 className="font-medium text-white mb-3">Movimenti</h4>
        <div className="space-y-2 text-sm">
          {Object.entries(summary.movements).map(([type, count]) => (
            <div key={type} className="flex justify-between">
              <span className="text-gray-400">{movementTypeLabels[type] || type}</span>
              <span className="text-white font-medium">{count} {count === 1 ? 'mov.' : 'mov.'}</span>
            </div>
          ))}
          {Object.keys(summary.movements).length === 0 && (
            <p className="text-gray-500">Nessun movimento</p>
          )}
        </div>
      </div>
    </div>
  )
}

function FirstMarketTab({ data }: { data: unknown }) {
  const [expandedAuction, setExpandedAuction] = useState<string | null>(null)

  if (!data) return <div className="text-gray-400">Caricamento...</div>

  const { auctions, stats } = data as {
    auctions: Array<{
      id: string
      player: { id: string; name: string; position: string; team: string }
      basePrice: number
      finalPrice: number
      winner: { memberId: string; username: string; teamName: string | null } | null
      bidCount: number
      prophecies?: Array<{
        content: string
        author: { username: string; teamName: string | null }
      }>
    }>
    members: Array<{
      memberId: string
      username: string
      teamName: string | null
      totalSpent: number
      rosterCount: number
    }>
    stats: { totalAuctions: number; avgPrice: number; maxPrice: number }
  }

  const positionColors: Record<string, string> = {
    P: 'text-amber-400',
    D: 'text-blue-400',
    C: 'text-emerald-400',
    A: 'text-red-400',
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex gap-6 text-sm border-b border-surface-50/20 pb-3">
        <span className="text-gray-400">Totale: <span className="font-bold text-white">{stats.totalAuctions}</span></span>
        <span className="text-gray-400">Media: <span className="font-bold text-primary-400">{stats.avgPrice}M</span></span>
        <span className="text-gray-400">Max: <span className="font-bold text-yellow-400">{stats.maxPrice}M</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-200">
            <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 px-2 w-10">R</th>
              <th className="text-left py-2 px-2">Giocatore</th>
              <th className="text-left py-2 px-2 hidden md:table-cell">Squadra</th>
              <th className="text-right py-2 px-2">Prezzo</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">Bid</th>
              <th className="text-left py-2 px-2">Acquirente</th>
              <th className="text-center py-2 px-2 w-10">🔮</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map(auction => {
              const hasProphecies = auction.prophecies && auction.prophecies.length > 0
              const isExpanded = expandedAuction === auction.id

              return (
                <>
                  <tr
                    key={auction.id}
                    className={`border-b border-surface-50/10 hover:bg-surface-300/20 ${hasProphecies ? 'cursor-pointer' : ''}`}
                    onClick={() => hasProphecies && setExpandedAuction(isExpanded ? null : auction.id)}
                  >
                    <td className={`py-1.5 px-2 font-bold ${positionColors[auction.player.position]}`}>
                      {auction.player.position}
                    </td>
                    <td className="py-1.5 px-2 text-white">{auction.player.name}</td>
                    <td className="py-1.5 px-2 text-gray-500 hidden md:table-cell">{auction.player.team}</td>
                    <td className="py-1.5 px-2 text-right font-medium text-primary-400">{auction.finalPrice}M</td>
                    <td className="py-1.5 px-2 text-center text-gray-500 hidden sm:table-cell">{auction.bidCount}</td>
                    <td className="py-1.5 px-2 text-gray-300">
                      {auction.winner?.teamName || auction.winner?.username || '-'}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {hasProphecies && (
                        <span className="text-purple-400" title={`${auction.prophecies!.length} profezia/e`}>
                          {auction.prophecies!.length}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && hasProphecies && (
                    <tr key={`${auction.id}-prophecies`}>
                      <td colSpan={7} className="bg-purple-500/10 px-4 py-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-purple-400 uppercase mb-2">🔮 Profezie</p>
                          {auction.prophecies!.map((p, idx) => (
                            <div key={idx} className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2">
                              <p className="text-sm text-white italic">"{p.content}"</p>
                              <p className="text-xs text-purple-300 mt-1">
                                — {p.author.teamName || p.author.username}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TradesTab({ data }: { data: unknown }) {
  if (!data) return <div className="text-gray-400">Caricamento...</div>

  const { trades, counts } = data as {
    trades: Array<{
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
    }>
    counts: { total: number; accepted: number; rejected: number; pending: number }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    ACCEPTED: { label: '✓', color: 'text-green-400' },
    REJECTED: { label: '✗', color: 'text-red-400' },
    PENDING: { label: '⏳', color: 'text-yellow-400' },
    COUNTERED: { label: '↩', color: 'text-blue-400' },
    CANCELLED: { label: '—', color: 'text-gray-500' },
    EXPIRED: { label: '⏰', color: 'text-gray-500' },
  }

  const formatPlayers = (players: Array<{ name: string; position: string }>) => {
    if (players.length === 0) return '-'
    return players.map(p => `${p.position} ${p.name}`).join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex gap-6 text-sm border-b border-surface-50/20 pb-3">
        <span className="text-gray-400">Totale: <span className="font-bold text-white">{counts.total}</span></span>
        <span className="text-gray-400">Accettati: <span className="font-bold text-green-400">{counts.accepted}</span></span>
        <span className="text-gray-400">Rifiutati: <span className="font-bold text-red-400">{counts.rejected}</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-200">
            <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
              <th className="text-center py-2 px-2 w-10">St</th>
              <th className="text-left py-2 px-2">Da</th>
              <th className="text-left py-2 px-2">A</th>
              <th className="text-left py-2 px-2">Offre</th>
              <th className="text-left py-2 px-2">Chiede</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">Budget</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => {
              const config = statusConfig[trade.status] || { label: '?', color: 'text-gray-400' }
              return (
                <tr key={trade.id} className="border-b border-surface-50/10 hover:bg-surface-300/20">
                  <td className={`py-2 px-2 text-center font-bold ${config.color}`} title={trade.status}>
                    {config.label}
                  </td>
                  <td className="py-2 px-2 text-white whitespace-nowrap">
                    {trade.sender.teamName || trade.sender.username}
                  </td>
                  <td className="py-2 px-2 text-white whitespace-nowrap">
                    {trade.receiver.teamName || trade.receiver.username}
                  </td>
                  <td className="py-2 px-2 text-gray-300 max-w-[200px] truncate" title={formatPlayers(trade.offeredPlayers)}>
                    {formatPlayers(trade.offeredPlayers)}
                    {trade.offeredBudget > 0 && <span className="text-primary-400 ml-1">+{trade.offeredBudget}M</span>}
                  </td>
                  <td className="py-2 px-2 text-gray-300 max-w-[200px] truncate" title={formatPlayers(trade.requestedPlayers)}>
                    {formatPlayers(trade.requestedPlayers)}
                    {trade.requestedBudget > 0 && <span className="text-primary-400 ml-1">+{trade.requestedBudget}M</span>}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-500 hidden sm:table-cell">
                    {trade.offeredBudget > 0 || trade.requestedBudget > 0
                      ? `${trade.offeredBudget}/${trade.requestedBudget}`
                      : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {trades.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nessuno scambio in questa sessione</p>
        )}
      </div>
    </div>
  )
}

function PrizesTab({ data }: { data: unknown }) {
  if (!data) return <div className="text-gray-400">Premi non ancora finalizzati</div>

  const { config, categories, members, indemnityStats } = data as {
    config: { baseReincrement: number; isFinalized: boolean; finalizedAt: string | null }
    categories: Array<{
      id: string
      name: string
      isSystemPrize: boolean
      prizes: Array<{ memberId: string; teamName: string | null; username: string; amount: number }>
    }>
    members: Array<{
      id: string
      username: string
      teamName: string | null
      totalPrize: number
      totalIndemnity?: number
      indemnityPlayers?: Array<{
        playerId: string
        playerName: string
        position: string
        team: string
        exitReason: string
        indemnityAmount: number
      }>
    }>
    indemnityStats?: {
      totalPlayers: number
      totalAmount: number
      byReason: { RITIRATO: number; RETROCESSO: number; ESTERO: number }
    }
  }

  if (!config.isFinalized) {
    return <div className="text-gray-400">Premi non ancora finalizzati</div>
  }

  const hasIndemnities = indemnityStats && indemnityStats.totalPlayers > 0

  return (
    <div className="space-y-4">
      {/* Base Reincrement */}
      <div className="bg-surface-300/50 rounded-lg p-3">
        <span className="text-gray-400">Re-incremento base:</span>
        <span className="ml-2 font-bold text-primary-400">{config.baseReincrement}M</span>
        {config.finalizedAt && (
          <span className="ml-4 text-sm text-gray-500">
            Finalizzato il {new Date(config.finalizedAt).toLocaleDateString('it-IT')}
          </span>
        )}
      </div>

      {/* Members Totals */}
      <div>
        <h4 className="font-medium text-white mb-3">Premi per Manager</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-50/20">
                <th className="text-left py-2 text-gray-400">Manager</th>
                <th className="text-center py-2 text-gray-400">Base</th>
                {categories.map(cat => (
                  <th key={cat.id} className="text-center py-2 text-gray-400 whitespace-nowrap">
                    {cat.name.length > 12 ? cat.name.substring(0, 12) + '...' : cat.name}
                  </th>
                ))}
                <th className="text-center py-2 text-yellow-400">Totale</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-b border-surface-50/10">
                  <td className="py-2">
                    <div>
                      <p className="font-medium text-white">{member.teamName || 'Team'}</p>
                      <p className="text-xs text-gray-500">{member.username}</p>
                    </div>
                  </td>
                  <td className="text-center py-2 text-gray-300">{config.baseReincrement}M</td>
                  {categories.map(cat => {
                    const prize = cat.prizes.find(p => p.memberId === member.id)
                    return (
                      <td key={cat.id} className="text-center py-2 text-gray-300">
                        {prize?.amount ?? 0}M
                      </td>
                    )
                  })}
                  <td className="text-center py-2 font-bold text-yellow-400">{member.totalPrize}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Indemnities Section */}
      {hasIndemnities && (
        <div className="mt-6 pt-4 border-t border-surface-50/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <span>⚠️</span>
              Indennizzi Giocatori Usciti
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                {indemnityStats.byReason.ESTERO} Estero
              </span>
              <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 font-bold">
                Totale: {indemnityStats.totalAmount}M
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-50/20 text-xs text-gray-400 uppercase">
                  <th className="text-left py-2 px-2">Manager</th>
                  <th className="text-center py-2 px-2 w-10">R</th>
                  <th className="text-left py-2 px-2">Giocatore</th>
                  <th className="text-center py-2 px-2">Motivo</th>
                  <th className="text-right py-2 px-2">Indennizzo</th>
                </tr>
              </thead>
              <tbody>
                {members.filter(m => (m.indemnityPlayers?.length ?? 0) > 0).flatMap(member =>
                  (member.indemnityPlayers ?? []).map((player, idx) => {
                    const posColors: Record<string, string> = {
                      P: 'text-amber-400',
                      D: 'text-blue-400',
                      C: 'text-emerald-400',
                      A: 'text-red-400',
                    }
                    return (
                      <tr key={`${member.id}-${player.playerId}`} className="border-b border-surface-50/10">
                        {idx === 0 && (
                          <td rowSpan={member.indemnityPlayers?.length ?? 1} className="py-2 px-2 align-top border-r border-surface-50/10">
                            <span className="text-white text-sm">{member.teamName || member.username}</span>
                          </td>
                        )}
                        <td className={`py-2 px-2 text-center font-bold ${posColors[player.position] || 'text-gray-400'}`}>
                          {player.position}
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-white">{player.playerName}</span>
                          <span className="text-gray-500 text-xs ml-2">{player.team}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">
                            {player.exitReason}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-cyan-400">
                          {player.indemnityAmount}M
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function RubataTab({ data }: { data: unknown }) {
  if (!data) return <div className="text-gray-400">Caricamento...</div>

  const { auctions, stats } = data as {
    auctions: Array<{
      id: string
      player: { id: string; name: string; position: string; team: string }
      basePrice: number
      finalPrice: number
      seller: { memberId: string; username: string; teamName: string | null } | null
      winner: { memberId: string; username: string; teamName: string | null } | null
      wasStolen: boolean
      noBids: boolean
    }>
    stats: { total: number; stolen: number; retained: number; noBids: number }
  }

  const positionColors: Record<string, string> = {
    P: 'text-amber-400',
    D: 'text-blue-400',
    C: 'text-emerald-400',
    A: 'text-red-400',
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex gap-6 text-sm border-b border-surface-50/20 pb-3">
        <span className="text-gray-400">Totale: <span className="font-bold text-white">{stats.total}</span></span>
        <span className="text-gray-400">Rubati: <span className="font-bold text-red-400">{stats.stolen}</span></span>
        <span className="text-gray-400">Trattenuti: <span className="font-bold text-green-400">{stats.retained}</span></span>
        <span className="text-gray-400">No bid: <span className="font-bold text-gray-500">{stats.noBids}</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-200">
            <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
              <th className="text-center py-2 px-2 w-10">Esito</th>
              <th className="text-left py-2 px-2 w-10">R</th>
              <th className="text-left py-2 px-2">Giocatore</th>
              <th className="text-left py-2 px-2 hidden md:table-cell">Squadra</th>
              <th className="text-left py-2 px-2">Venditore</th>
              <th className="text-right py-2 px-2">Prezzo</th>
              <th className="text-left py-2 px-2">Acquirente</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map(auction => (
              <tr key={auction.id} className="border-b border-surface-50/10 hover:bg-surface-300/20">
                <td className="py-1.5 px-2 text-center">
                  {auction.wasStolen ? (
                    <span className="text-red-400 font-bold" title="Rubato">✗</span>
                  ) : auction.noBids ? (
                    <span className="text-gray-500" title="Nessuna offerta">—</span>
                  ) : (
                    <span className="text-green-400 font-bold" title="Trattenuto">✓</span>
                  )}
                </td>
                <td className={`py-1.5 px-2 font-bold ${positionColors[auction.player.position]}`}>
                  {auction.player.position}
                </td>
                <td className="py-1.5 px-2 text-white">{auction.player.name}</td>
                <td className="py-1.5 px-2 text-gray-500 hidden md:table-cell">{auction.player.team}</td>
                <td className="py-1.5 px-2 text-gray-300">
                  {auction.seller?.teamName || auction.seller?.username || '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-medium text-primary-400">{auction.finalPrice}M</td>
                <td className="py-1.5 px-2 text-gray-300">
                  {auction.wasStolen
                    ? (auction.winner?.teamName || auction.winner?.username || '-')
                    : auction.noBids ? '-' : 'Trattenuto'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {auctions.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nessuna asta rubata in questa sessione</p>
        )}
      </div>
    </div>
  )
}

function SvincolatiTab({ data }: { data: unknown }) {
  if (!data) return <div className="text-gray-400">Caricamento...</div>

  const { auctions, stats } = data as {
    auctions: Array<{
      id: string
      player: { id: string; name: string; position: string; team: string }
      basePrice: number
      finalPrice: number
      nominator: { memberId: string; username: string; teamName: string | null } | null
      winner: { memberId: string; username: string; teamName: string | null } | null
      noBids: boolean
    }>
    stats: { total: number; totalSpent: number; avgPrice: number }
  }

  const positionColors: Record<string, string> = {
    P: 'text-amber-400',
    D: 'text-blue-400',
    C: 'text-emerald-400',
    A: 'text-red-400',
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex gap-6 text-sm border-b border-surface-50/20 pb-3">
        <span className="text-gray-400">Totale: <span className="font-bold text-white">{stats.total}</span></span>
        <span className="text-gray-400">Speso: <span className="font-bold text-primary-400">{stats.totalSpent}M</span></span>
        <span className="text-gray-400">Media: <span className="font-bold text-yellow-400">{stats.avgPrice}M</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-200">
            <tr className="border-b border-surface-50/30 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 px-2 w-10">R</th>
              <th className="text-left py-2 px-2">Giocatore</th>
              <th className="text-left py-2 px-2 hidden md:table-cell">Squadra</th>
              <th className="text-right py-2 px-2">Base</th>
              <th className="text-right py-2 px-2">Prezzo</th>
              <th className="text-left py-2 px-2">Acquirente</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map(auction => (
              <tr key={auction.id} className="border-b border-surface-50/10 hover:bg-surface-300/20">
                <td className={`py-1.5 px-2 font-bold ${positionColors[auction.player.position]}`}>
                  {auction.player.position}
                </td>
                <td className="py-1.5 px-2 text-white">{auction.player.name}</td>
                <td className="py-1.5 px-2 text-gray-500 hidden md:table-cell">{auction.player.team}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{auction.basePrice}M</td>
                <td className="py-1.5 px-2 text-right font-medium text-primary-400">{auction.finalPrice}M</td>
                <td className="py-1.5 px-2 text-gray-300">
                  {auction.winner?.teamName || auction.winner?.username || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {auctions.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nessuna asta svincolati in questa sessione</p>
        )}
      </div>
    </div>
  )
}
