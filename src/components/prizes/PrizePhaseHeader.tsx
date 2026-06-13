interface PrizeStat {
  label: string
  value: string
  gold?: boolean
}

interface PrizePhaseHeaderProps {
  title: string
  subtitle: string
  stats: PrizeStat[]
}

/** Golden header (testata premi) shared by admin and manager views. */
export function PrizePhaseHeader({ title, subtitle, stats }: PrizePhaseHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface-200 border border-accent-500/35 rounded-2xl p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.1)]">
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-700 to-accent-400 flex items-center justify-center text-3xl flex-shrink-0 border border-accent-500/50">
        <span aria-hidden="true">🏆</span>
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-6 sm:ml-auto">
        {stats.map(stat => (
          <div key={stat.label} className="text-left sm:text-right">
            <div className="micro-label text-[9px]">{stat.label}</div>
            <div className={`stat-number text-2xl leading-tight ${stat.gold ? 'text-accent-400' : 'text-white'}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
