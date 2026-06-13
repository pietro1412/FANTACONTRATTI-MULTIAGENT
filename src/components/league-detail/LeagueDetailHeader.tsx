import { LeagueCrest } from '@/components/ui/LeagueCrest'
import { PhaseIndicator } from './PhaseIndicator'

interface LeagueDetailHeaderProps {
  leagueName: string
  leagueStatus: string
  leagueImageUrl?: string | null
  memberCount: number
  sessions: Array<{ type: string; status: string; currentPhase: string; phaseStartedAt: string | null }>
  userBudget: number
}

function statusBadge(status: string) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 micro-label text-secondary-400 bg-secondary-500/10 border border-secondary-500/40 rounded-full px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary-500 shadow-[0_0_6px_theme(colors.secondary.500)]" aria-hidden="true" />
        Attiva
      </span>
    )
  }
  if (status === 'DRAFT') {
    return (
      <span className="inline-flex items-center gap-1.5 micro-label text-violet-400 bg-violet-500/10 border border-violet-500/40 rounded-full px-2.5 py-1">
        <span aria-hidden="true">◌</span>
        In preparazione
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 micro-label text-gray-400 bg-surface-50/20 border border-surface-50/30 rounded-full px-2.5 py-1">
      <span aria-hidden="true">✓</span>
      Completata
    </span>
  )
}

export function LeagueDetailHeader({
  leagueName,
  leagueStatus,
  leagueImageUrl,
  memberCount,
  sessions,
  userBudget,
}: LeagueDetailHeaderProps) {
  const showBudget = leagueStatus === 'ACTIVE'

  return (
    <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
            <LeagueCrest name={leagueName} imageUrl={leagueImageUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight truncate">
                {leagueName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2">
                {statusBadge(leagueStatus)}
                <span className="text-gray-600" aria-hidden="true">·</span>
                <span className="micro-label text-gray-400">Stagione 2025/26</span>
                <span className="text-gray-600" aria-hidden="true">·</span>
                <span className="micro-label text-gray-400">
                  {memberCount} {memberCount === 1 ? 'manager' : 'manager'}
                </span>
              </div>
            </div>
          </div>
          {showBudget && (
            <div className="text-right flex-shrink-0">
              <p className="micro-label text-gray-400">Il tuo budget</p>
              <p className="budget-display text-3xl sm:text-4xl text-accent-400 leading-none mt-1">
                {userBudget}
                <span className="text-base sm:text-lg text-gray-500 ml-1">M</span>
              </p>
            </div>
          )}
        </div>

        <PhaseIndicator leagueStatus={leagueStatus} sessions={sessions} />
      </div>
    </div>
  )
}
