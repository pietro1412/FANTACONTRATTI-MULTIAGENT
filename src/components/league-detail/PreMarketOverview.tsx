interface PreMarketOverviewProps {
  initialBudget: number
  teamCount: number
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

const SLOT_CONFIG = [
  { key: 'P', label: 'Portieri', color: 'bg-amber-500' },
  { key: 'D', label: 'Difensori', color: 'bg-blue-500' },
  { key: 'C', label: 'Centrocampisti', color: 'bg-emerald-500' },
  { key: 'A', label: 'Attaccanti', color: 'bg-red-500' },
] as const

export function PreMarketOverview({
  initialBudget,
  teamCount,
  goalkeeperSlots,
  defenderSlots,
  midfielderSlots,
  forwardSlots,
  onNavigate,
  leagueId,
}: PreMarketOverviewProps) {
  const slots = { P: goalkeeperSlots, D: defenderSlots, C: midfielderSlots, A: forwardSlots }
  const totalSlots = goalkeeperSlots + defenderSlots + midfielderSlots + forwardSlots
  const totalLeagueBudget = initialBudget * teamCount

  return (
    <div className="space-y-4">
      {/* Budget Overview */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">💰</span>
          <h3 className="text-base font-bold text-white">Situazione Economica</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-surface-300/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-accent-400">{initialBudget}M</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Budget per Manager</div>
          </div>
          <div className="bg-surface-300/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-primary-400">{teamCount}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Manager</div>
          </div>
          <div className="bg-surface-300/50 rounded-lg p-3 text-center sm:col-span-1 col-span-2">
            <div className="text-xl font-bold text-white">{totalLeagueBudget}M</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Budget Totale Lega</div>
          </div>
        </div>
      </div>

      {/* Slot Configuration */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="text-base font-bold text-white">Composizione Rosa</h3>
          </div>
          <span className="bg-surface-300 px-2 py-0.5 rounded-full text-xs text-gray-400">{totalSlots} slot</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SLOT_CONFIG.map(({ key, label, color }) => (
            <div key={key} className="bg-surface-300/50 rounded-lg p-3 text-center">
              <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto`}>
                {key}
              </div>
              <div className="text-xl font-bold text-white mt-2">{slots[key]}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-500 text-center">
          Riserva budget per slot: {totalSlots * 2}M (min 2M per slot)
        </div>
      </div>

      {/* Strategy Hub Link */}
      <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <div>
              <h3 className="text-base font-bold text-white">Hub Strategia</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Prepara la watchlist e le priorita prima dell'asta
              </p>
            </div>
          </div>
          <button
            onClick={() => { onNavigate('strategies', { leagueId }); }}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium whitespace-nowrap"
          >
            Apri Hub &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
