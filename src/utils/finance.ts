/**
 * Bilancio = Budget − Monte Ingaggi: nucleo condiviso da ogni punto della piattaforma
 * che mostra il bilancio di un manager (RosterOverview, LeagueDetailHeader, Dashboard,
 * RoseGiocatori, Trades, finance/types.ts). Evita che la formula diverga tra pagine
 * (rischio già concretizzato in passato sul Monte Ingaggi, vedi commit d97ff6a).
 */
export function computeBilancio(budget: number, totalSalaries: number): number {
  return budget - totalSalaries
}

/** Somma gli ingaggi di una lista di contratti (roster) — piccola utility condivisa
 * per evitare che ogni chiamante riscriva lo stesso `reduce`. */
export function sumContractSalaries(contracts: Array<{ salary?: number | null } | null | undefined>): number {
  return contracts.reduce((sum, c) => sum + (c?.salary || 0), 0)
}

/** Mirror di calculateDefaultSalary in src/services/contract.service.ts:48-50 —
 * duplicato di proposito: quel file è backend-only (importa Prisma), non
 * importabile nel bundle frontend. Se la regola cambia lì, va aggiornata anche qui. */
function estimateDefaultSalary(price: number): number {
  return Math.max(1, Math.round(price / 10))
}

/** Riserva Primo Mercato per gli slot che resteranno vuoti DOPO questo acquisto (1
 * offerta minima + 1 ingaggio minimo ciascuno) — mirror esatto di
 * src/services/auction.service.ts (~L1420-1430). Bibbia: docs/bibbie/PRIMO-MERCATO.md §8. */
export function computeSlotReserve(totalSlots: number, filledSlots: number): number {
  const remainingAfter = Math.max(0, totalSlots - filledSlots - 1)
  return remainingAfter * 2
}

/**
 * Offerta massima consentita dato un bilancio e una riserva slot — mirror esatto
 * della validazione server in src/services/auction.service.ts (~L1433): il prezzo più
 * alto il cui ingaggio risultante rientra ancora nel bilancio disponibile dopo la
 * riserva. Passare `slotReserve: 0` fuori da Primo Mercato (Rubata/Svincolati non
 * hanno questa riserva).
 *
 * Unica fonte di verità lato client: prima di questo fix, StatusBar/BiddingPanel/
 * FinancialDashboard (auction-room-v2) avevano 3 formule indipendenti e divergenti
 * (chi riservava 2M per OGNI slot vuoto invece che per gli slot vuoti DOPO questo,
 * chi riservava solo 1M invece di 2M) — stesso pattern di rischio del bug storico sul
 * Monte Ingaggi negli Scambi (commit d97ff6a).
 */
export function computeMaxAuctionBid(bilancio: number, slotReserve: number): number {
  const cap = Math.max(0, bilancio - slotReserve)
  let amount = cap
  while (amount > 0 && amount + estimateDefaultSalary(amount) > cap) {
    amount--
  }
  return amount
}
