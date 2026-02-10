import { PhaseStepper } from './PhaseStepper'

interface LeagueDetailHeaderProps {
  leagueName: string
  leagueStatus: string
  sessions: Array<{ type: string; status: string }>
  userBudget: number
}

export function LeagueDetailHeader({ leagueName, leagueStatus, sessions, userBudget }: LeagueDetailHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow flex-shrink-0">
              <span className="text-2xl sm:text-3xl">{'\uD83C\uDFDF\uFE0F'}</span>
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">{leagueName}</h1>
                <p className="text-gray-400 mt-0.5 text-xs sm:text-sm uppercase tracking-wide">Stagione 2025/26</p>
              </div>
              <PhaseStepper leagueStatus={leagueStatus} sessions={sessions} />
            </div>
          </div>
          <div className="text-right bg-surface-200 rounded-xl px-3 py-2 sm:px-6 sm:py-4 border border-surface-50/20 flex-shrink-0">
            <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Il tuo Budget</p>
            <p className="text-2xl sm:text-4xl font-bold text-accent-400">
              {userBudget}<span className="text-sm sm:text-lg text-gray-500 ml-1">FM</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
