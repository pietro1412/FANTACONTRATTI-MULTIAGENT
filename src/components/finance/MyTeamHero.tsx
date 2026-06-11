import { useMemo } from 'react'
import { type TeamData, getTeamBalance } from '@/components/finance/types'

interface MyTeamHeroProps {
  team: TeamData
  leagueName: string
  teamsCount: number
  budgetRank: number
  hasFinancialDetails: boolean
  onNavigateToRoster: () => void
  onShowMovements: () => void
}

export function MyTeamHero({
  team,
  leagueName,
  teamsCount,
  budgetRank,
  hasFinancialDetails,
  onNavigateToRoster,
  onShowMovements,
}: MyTeamHeroProps) {
  const balance = getTeamBalance(team, hasFinancialDetails)
  const reserve = team.slotReserve ?? 0
  const available = balance - reserve

  const expiringContracts = useMemo(() => {
    return team.players
      .filter(p => p.duration === 1)
      .sort((a, b) => b.salary - a.salary)
  }, [team.players])

  const expiringSalaryTotal = expiringContracts.reduce((sum, p) => sum + p.salary, 0)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-secondary-500/35 bg-surface-200 p-4 md:p-7">
      {/* Subtle green-tinted gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent to-secondary-500/[0.07]" />
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-secondary-500 to-secondary-700" />

      <div className="relative">
        {/* Eyebrow */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-secondary-400">
          La mia squadra
          <span className="font-bold normal-case tracking-wide text-gray-500">
            &middot; {team.teamName} &middot; {leagueName}
          </span>
        </div>

        {/* Main grid: big balance | stats | CTA */}
        <div className="mt-3.5 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,340px)_1fr_230px] lg:gap-8">
          {/* Big available balance */}
          <div>
            <div className="budget-display text-5xl leading-none text-secondary-400">
              {available}
              <span className="ml-0.5 text-2xl text-secondary-500">M</span>
            </div>
            <div className="mt-1.5 text-[13px] font-semibold text-gray-400">
              Bilancio disponibile per il mercato
            </div>
            <div className="mt-2.5 font-mono text-[11px] text-gray-500">
              <b className="text-gray-400">{team.budget}M</b> budget &minus; <b className="text-gray-400">{team.annualContractCost}M</b> ingaggi
              {reserve > 0 && (
                <> &minus; <b className="text-gray-400">{reserve}M</b> riserva</>
              )}
              {' '}= <b className="text-secondary-400">{available}M</b>
            </div>
          </div>

          {/* 3 key stats */}
          <div className="grid grid-cols-3 gap-3 border-t border-surface-50 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Budget totale</div>
              <div className="stat-number mt-1 text-2xl text-white md:text-[27px]">
                {team.budget}
                <span className="text-sm font-medium text-gray-400">M</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">{budgetRank}&deg; su {teamsCount} in lega</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Monte ingaggi</div>
              <div className="stat-number mt-1 text-2xl text-white md:text-[27px]">
                {team.annualContractCost}
                <span className="text-sm font-medium text-gray-400">M/anno</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                su {team.slotCount} {team.slotCount === 1 ? 'contratto attivo' : 'contratti attivi'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Slot rosa</div>
              <div className="stat-number mt-1 text-2xl text-white md:text-[27px]">
                {team.slotCount}
                <span className="text-sm font-medium text-gray-400">/{team.maxSlots}</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {team.slotsFree} {team.slotsFree === 1 ? 'slot ancora libero' : 'slot ancora liberi'}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-stretch gap-2.5">
            <button
              onClick={onNavigateToRoster}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90"
            >
              Vedi la mia rosa &rarr;
            </button>
            <button
              onClick={onShowMovements}
              className="h-10 rounded-xl border border-surface-50 text-xs font-bold text-gray-400 transition-colors hover:bg-surface-100/50 hover:text-white"
            >
              Storico movimenti
            </button>
          </div>
        </div>

        {/* Mandatory reserve strip (only during primo mercato / asta libera) */}
        {reserve > 0 && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-surface-50 bg-surface-100/30 px-3.5 py-2.5 text-xs text-gray-400">
            <span aria-hidden="true">&#128274;</span>
            <span>
              Riserva obbligatoria: <span className="font-mono font-bold text-white">{reserve}M</span> accantonati
              per coprire i <span className="font-mono font-bold text-white">{team.slotsFree} slot</span> vuoti
              minimi (2M ciascuno) &mdash; gi&agrave; sottratti dal disponibile.
            </span>
          </div>
        )}

        {/* Expiring contracts warning */}
        {expiringContracts.length > 0 && (
          <div className="mt-2.5 flex items-start gap-3 rounded-xl border border-accent-500/35 bg-accent-500/10 px-3.5 py-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-accent-500/25 text-xs font-extrabold text-accent-400" aria-hidden="true">
              !
            </div>
            <div className="text-[12.5px] leading-relaxed text-accent-300">
              <b className="text-accent-200">
                {expiringContracts.length === 1
                  ? '1 contratto in scadenza'
                  : `${expiringContracts.length} contratti in scadenza`}
              </b>
              {' '}&mdash; vanno rinnovati, spalmati o lasciati svincolare entro fine sessione
              ({expiringSalaryTotal}M/anno in gioco).
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {expiringContracts.map(p => (
                  <span
                    key={p.id}
                    className="rounded-lg border border-accent-500/30 bg-surface-600/30 px-2 py-1 font-mono text-[11px] font-bold text-white"
                  >
                    {p.name} <span className="text-accent-400">{p.salary}M</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
