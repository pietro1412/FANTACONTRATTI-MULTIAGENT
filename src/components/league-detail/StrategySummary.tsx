interface StrategySummaryData {
  targets: number
  topPriority: number
  watching: number
  toSell: number
  total: number
}

interface StrategySummaryProps {
  data: StrategySummaryData
  onNavigate: (page: string, params?: Record<string, string>) => void
  leagueId: string
}

const COUNTERS: { key: keyof StrategySummaryData; label: string; icon: string; color: string }[] = [
  { key: 'targets', label: 'Target', icon: '\uD83C\uDFAF', color: 'text-secondary-400' },
  { key: 'topPriority', label: 'Top Priorit\u00E0', icon: '\u2B50', color: 'text-accent-400' },
  { key: 'watching', label: 'Sotto Oss.', icon: '\uD83D\uDC41\uFE0F', color: 'text-primary-400' },
  { key: 'toSell', label: 'Da Cedere', icon: '\uD83D\uDCE4', color: 'text-danger-400' },
]

export function StrategySummary({ data, onNavigate, leagueId }: StrategySummaryProps) {
  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\uD83C\uDFAF'}</span>
          <h3 className="text-base font-bold text-white">Strategie Attive</h3>
          {data.total > 0 && (
            <span className="bg-surface-300 px-2 py-0.5 rounded-full text-xs text-gray-400">{data.total}</span>
          )}
        </div>
        <button
          onClick={() => { onNavigate('strategies', { leagueId }); }}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
        >
          Vedi Hub Strategia &rarr;
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COUNTERS.map(({ key, label, icon, color }) => (
          <div key={key} className="bg-surface-300/50 rounded-lg p-3 text-center">
            <span className="text-lg">{icon}</span>
            <div className={`text-xl font-bold mt-1 ${color}`}>{data[key]}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
