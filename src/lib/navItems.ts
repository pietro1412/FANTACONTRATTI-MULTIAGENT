// Source of truth UNICA per le voci di navigazione della lega.
// Le voci "di fase" (Asta/Scambi/Contratti/Rubata/Svincolati) derivano dalla
// fase corrente della sessione attiva; le voci "sempre visibili" sono costanti.
// Usata sia dall'header/drawer (Navigation) sia dalla bottom-nav mobile (BottomNavBar)
// per garantire coerenza desktop/mobile.
//
// Valori fase = enum MarketPhase (prisma): ASTA_LIBERA, OFFERTE_PRE_RINNOVO, PREMI,
// CONTRATTI, RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA_SVINCOLATI.

/** Chiave della voce: coincide con il "page" passato a onNavigate (vedi createLeagueNavigator). */
export type NavItemKey =
  | 'leagueDetail'
  | 'adminPanel'
  | 'allPlayers'
  | 'financials'
  | 'history'
  | 'prophecies'
  | 'feedbackHub'
  | 'auction'
  | 'trades'
  | 'contracts'
  | 'rubata'
  | 'svincolati'

export interface NavItem {
  /** Identità della voce e "page" per onNavigate. */
  key: NavItemKey
  /** Etichetta utente (italiano). */
  label: string
  /** Chiave icona nella mappa MenuIcons di Navigation. */
  icon: string
  /** Voce visibile solo agli admin di lega. */
  adminOnly: boolean
  /** True per le voci derivate dalla fase corrente (vs. sempre visibili). */
  isPhase: boolean
}

// Voci sempre visibili, in ordine canonico.
const ALWAYS_VISIBLE: NavItem[] = [
  { key: 'leagueDetail', label: 'Dashboard', icon: 'dashboard', adminOnly: false, isPhase: false },
  { key: 'adminPanel', label: 'Admin', icon: 'admin', adminOnly: true, isPhase: false },
  { key: 'allPlayers', label: 'Giocatori', icon: 'allRosters', adminOnly: false, isPhase: false },
  { key: 'financials', label: 'Finanze', icon: 'financials', adminOnly: false, isPhase: false },
  { key: 'history', label: 'Storico', icon: 'history', adminOnly: false, isPhase: false },
  { key: 'prophecies', label: 'Profezie', icon: 'prophecy', adminOnly: false, isPhase: false },
  { key: 'feedbackHub', label: 'Feedback', icon: 'feedbackHub', adminOnly: false, isPhase: false },
]

// Definizione delle sole voci di fase.
const PHASE_AUCTION: NavItem = { key: 'auction', label: 'Asta', icon: 'auction', adminOnly: false, isPhase: true }
const PHASE_TRADES: NavItem = { key: 'trades', label: 'Scambi', icon: 'trades', adminOnly: false, isPhase: true }
const PHASE_CONTRACTS: NavItem = { key: 'contracts', label: 'Contratti', icon: 'contracts', adminOnly: false, isPhase: true }
const PHASE_RUBATA: NavItem = { key: 'rubata', label: 'Rubata', icon: 'rubata', adminOnly: false, isPhase: true }
const PHASE_SVINCOLATI: NavItem = { key: 'svincolati', label: 'Svincolati', icon: 'svincolati', adminOnly: false, isPhase: true }

/**
 * Restituisce la voce di fase applicabile alla fase corrente, o null se la fase
 * non ha una sezione manager dedicata (es. PREMI) o non c'è una sessione attiva.
 *
 * - Primo mercato attivo (ASTA_LIBERA) → Asta
 * - OFFERTE_PRE_RINNOVO → Scambi
 * - CONTRATTI → Contratti
 * - RUBATA → Rubata
 * - ASTA_SVINCOLATI → Svincolati
 * - OFFERTE_POST_ASTA_SVINCOLATI → Scambi
 * - PREMI / nessuna fase → null
 */
export function getPhaseNavItem(phase: string | null | undefined): NavItem | null {
  switch (phase) {
    case 'ASTA_LIBERA':
      return PHASE_AUCTION
    case 'OFFERTE_PRE_RINNOVO':
    case 'OFFERTE_POST_ASTA_SVINCOLATI':
      return PHASE_TRADES
    case 'CONTRATTI':
      return PHASE_CONTRACTS
    case 'RUBATA':
      return PHASE_RUBATA
    case 'ASTA_SVINCOLATI':
      return PHASE_SVINCOLATI
    default:
      return null
  }
}

/**
 * Sorgente di verità unica: elenco ordinato delle voci di navigazione visibili.
 * Le voci di fase vengono inserite dopo Dashboard/Admin, prima delle voci dati.
 *
 * @param phase fase corrente (currentPhase della sessione ACTIVE) o null
 * @param _leagueStatus stato lega (DRAFT/ACTIVE/...) — riservato per estensioni future
 * @param isLeagueAdmin se l'utente è admin della lega
 */
export function getVisibleNavItems(
  phase: string | null | undefined,
  _leagueStatus: string | null | undefined,
  isLeagueAdmin: boolean,
): NavItem[] {
  const phaseItem = getPhaseNavItem(phase)

  // Ordine: Dashboard, Admin, [voce di fase], Giocatori, Finanze, Storico, Profezie, Feedback
  const items: NavItem[] = []
  for (const item of ALWAYS_VISIBLE) {
    items.push(item)
    // Inserisci la voce di fase subito dopo Admin (o dopo Dashboard se non admin)
    if (phaseItem && ((item.key === 'adminPanel' && isLeagueAdmin) || (item.key === 'leagueDetail' && !isLeagueAdmin))) {
      items.push(phaseItem)
    }
  }

  return items.filter((item) => !item.adminOnly || isLeagueAdmin)
}
