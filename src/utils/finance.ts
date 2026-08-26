/**
 * Bilancio = Budget − Monte Ingaggi: nucleo condiviso da ogni punto della piattaforma
 * che mostra il bilancio di un manager (RosterOverview, LeagueDetailHeader, Dashboard,
 * RoseGiocatori, Trades, finance/types.ts). Evita che la formula diverga tra pagine
 * (rischio già concretizzato in passato sul Monte Ingaggi, vedi commit d97ff6a).
 */
export function computeBilancio(budget: number, totalSalaries: number): number {
  return budget - totalSalaries
}
