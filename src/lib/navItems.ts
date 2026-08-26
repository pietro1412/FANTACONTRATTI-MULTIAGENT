// Source of truth UNICA per la navigazione della lega.
//
// Una sola tassonomia stabile da cui derivano TUTTE le superfici di navigazione:
// header desktop + drawer mobile (Navigation), bottom-nav mobile (BottomNavBar) e
// tessere di accesso rapido dell'hub (QuickAccessTiles). Risolve i finding
// F-NAV-1/2 e F-COE-1 dell'audit prodotto (tre tassonomie divergenti).
//
// Principio (deciso con l'utente 2026-06-16, rivisto 2026-08-26):
// - Le sezioni di CONSULTAZIONE pura (Rose, Finanze, Premi, Storico, Profezie,
//   Feedback, Strategie) sono SEMPRE presenti, in ordine fisso che rispetta
//   l'ordine delle fasi del mercato ricorrente (MERCATO-RICORRENTE.md).
// - Le fasi vere e proprie — sia le ASTE live (Asta/Rubata/Svincolati) sia
//   Scambi/Contratti — compaiono SOLO quando la loro fase è attiva. Le aste
//   hanno badge LIVE, Scambi/Contratti badge ORA (stesso trattamento, non sono
//   aste in tempo reale).
// - La fase corrente NON sostituisce le altre voci: viene EVIDENZIATA (badge
//   ORA/LIVE + accento oro) sulla voce che la rappresenta.
//
// Valori fase = enum MarketPhase (prisma): ASTA_LIBERA, OFFERTE_PRE_RINNOVO, PREMI,
// CONTRATTI, RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA_SVINCOLATI.

/** Chiave della voce: coincide con il "page" passato a onNavigate (vedi createLeagueNavigator). */
export type NavItemKey =
  | 'leagueDetail'
  | 'adminPanel'
  | 'rose'
  | 'allPlayers'
  | 'financials'
  | 'prizes'
  | 'history'
  | 'prophecies'
  | 'feedbackHub'
  | 'strategie-rubata'
  | 'playerStats'
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
  /** True per le voci aste-live (Asta/Rubata/Svincolati): compaiono solo in fase. */
  isPhase: boolean
  /** Settato da getVisibleNavItems: questa voce rappresenta la fase corrente. */
  isCurrent?: boolean
  /** Settato da getVisibleNavItems: fase corrente di tipo asta-live (badge LIVE). */
  isLive?: boolean
  /** Metadati per la tessera QuickAccessTiles (presente solo sulle voci che vi appaiono). */
  tile?: { emoji: string; sub: string }
}

// --- Voci di consultazione: SEMPRE visibili, ordine canonico (= ordine fasi) ---
// NB: 'allPlayers' e 'playerStats' NON compaiono più come voci separate — dal
// 2026-08 sono tab della pagina unica "Rose" (Rose / Tutti i giocatori /
// Statistiche, vedi src/pages/RoseGiocatori.tsx). Le chiavi restano nell'enum
// NavItemKey solo per retrocompatibilità dei redirect (createLeagueNavigator).
const ALWAYS_VISIBLE: NavItem[] = [
  { key: 'leagueDetail', label: 'Dashboard', icon: 'dashboard', adminOnly: false, isPhase: false },
  { key: 'adminPanel', label: 'Admin', icon: 'admin', adminOnly: true, isPhase: false },
  { key: 'rose', label: 'Rose', icon: 'roster', adminOnly: false, isPhase: false, tile: { emoji: '👥', sub: 'Rose, giocatori e statistiche' } },
  { key: 'strategie-rubata', label: 'Strategie', icon: 'strategy', adminOnly: false, isPhase: false, tile: { emoji: '🎯', sub: 'Watchlist e priorità' } },
  { key: 'financials', label: 'Finanze', icon: 'financials', adminOnly: false, isPhase: false, tile: { emoji: '💰', sub: 'Bilanci, ingaggi, storia' } },
  { key: 'prizes', label: 'Premi', icon: 'prizes', adminOnly: false, isPhase: false, tile: { emoji: '🏆', sub: 'Premi ricevuti e in palio' } },
  { key: 'history', label: 'Storico', icon: 'history', adminOnly: false, isPhase: false, tile: { emoji: '📜', sub: 'Movimenti e stagioni' } },
  { key: 'prophecies', label: 'Profezie', icon: 'prophecy', adminOnly: false, isPhase: false, tile: { emoji: '🔮', sub: 'Pronostici di lega' } },
  { key: 'feedbackHub', label: 'Feedback', icon: 'feedbackHub', adminOnly: false, isPhase: false },
]

// Nessuna voce "solo-tile": ogni voce di consultazione pura è sempre visibile
// nel menu principale (QuickAccessTiles, l'unico consumatore di TILE_ONLY, è
// stato rimosso per ridondanza con la navigazione — vedi commit 426be9d).
const TILE_ONLY: NavItem[] = []

// Posizione fissa in cui inserire la voce di fase attiva nell'header (dopo "Rose").
// Un solo currentPhase per volta ⇒ al massimo una voce di fase inserita qui,
// quale che sia (Scambi/Contratti/Asta/Rubata/Svincolati).
const PHASE_ANCHOR: NavItemKey = 'rose'

// Definizione delle voci di fase (a comparsa SOLO quando la loro fase è attiva).
// Asta/Rubata/Svincolati sono aste live (badge LIVE); Scambi/Contratti non lo
// sono (badge ORA, stesso trattamento della fase corrente sulle altre voci).
const PHASE_AUCTION: NavItem = { key: 'auction', label: 'Asta', icon: 'auction', adminOnly: false, isPhase: true }
const PHASE_TRADES: NavItem = { key: 'trades', label: 'Scambi', icon: 'trades', adminOnly: false, isPhase: true, tile: { emoji: '🤝', sub: 'Offerte e controfferte' } }
const PHASE_CONTRACTS: NavItem = { key: 'contracts', label: 'Contratti', icon: 'contracts', adminOnly: false, isPhase: true, tile: { emoji: '📋', sub: 'Rinnovi e consolidamento' } }
const PHASE_RUBATA: NavItem = { key: 'rubata', label: 'Rubata', icon: 'rubata', adminOnly: false, isPhase: true }
const PHASE_SVINCOLATI: NavItem = { key: 'svincolati', label: 'Svincolati', icon: 'svincolati', adminOnly: false, isPhase: true }

/**
 * Mappa la fase corrente alla chiave della voce che la rappresenta nella navigazione.
 * Ogni fase — live o di consultazione (Scambi/Contratti) — ha una voce dedicata
 * a comparsa; PREMI resta senza voce navigabile propria (vedi getPhaseNavItem).
 */
export function phaseToNavKey(phase: string | null | undefined): NavItemKey | null {
  switch (phase) {
    case 'ASTA_LIBERA':
      return 'auction'
    case 'OFFERTE_PRE_RINNOVO':
    case 'OFFERTE_POST_ASTA_SVINCOLATI':
      return 'trades'
    case 'CONTRATTI':
      return 'contracts'
    case 'RUBATA':
      return 'rubata'
    case 'ASTA_SVINCOLATI':
      return 'svincolati'
    case 'PREMI':
      return 'prizes'
    default:
      return null
  }
}

const LIVE_KEYS = new Set<NavItemKey>(['auction', 'rubata', 'svincolati'])

const PHASE_ITEMS_BY_KEY: Partial<Record<NavItemKey, NavItem>> = {
  auction: PHASE_AUCTION,
  trades: PHASE_TRADES,
  contracts: PHASE_CONTRACTS,
  rubata: PHASE_RUBATA,
  svincolati: PHASE_SVINCOLATI,
}

/**
 * Restituisce la voce azionabile della fase corrente (per la tab centrale della
 * bottom-nav e per la CTA della barra-fase). Null se la fase non ha una sezione
 * navigabile dedicata (PREMI / nessuna sessione attiva).
 *
 * NB: comportamento storico preservato — Asta/Scambi/Contratti/Rubata/Svincolati,
 * null per PREMI. Usato da BottomNavBar e PhaseBar.
 */
export function getPhaseNavItem(phase: string | null | undefined): NavItem | null {
  const key = phaseToNavKey(phase)
  if (!key || key === 'prizes') return null
  return PHASE_ITEMS_BY_KEY[key] ?? null
}

/**
 * Sorgente di verità unica: elenco ordinato delle voci di navigazione visibili
 * (header desktop + drawer mobile). Le sezioni di consultazione pura sono
 * sempre presenti; la voce di fase attiva (live o Scambi/Contratti) appare
 * solo quando quella fase è in corso, subito dopo "Rose". La voce che
 * rappresenta la fase corrente è marcata isCurrent (+ isLive se asta).
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
  const currentKey = phaseToNavKey(phase)
  const phaseItem = currentKey ? PHASE_ITEMS_BY_KEY[currentKey] ?? null : null

  const items: NavItem[] = []
  for (const item of ALWAYS_VISIBLE) {
    items.push(item)
    // Inserisci la voce di fase attiva (se presente) subito dopo "Rose".
    if (phaseItem && item.key === PHASE_ANCHOR) {
      items.push(phaseItem)
    }
  }

  return items
    .filter((item) => !item.adminOnly || isLeagueAdmin)
    .map((item) => {
      if (currentKey && item.key === currentKey) {
        return { ...item, isCurrent: true, isLive: LIVE_KEYS.has(currentKey) }
      }
      return item
    })
}

/**
 * Voci da mostrare come tessere di accesso rapido nell'hub (QuickAccessTiles).
 * Derivate dalla stessa sorgente: tutte le voci non-admin con metadati `tile`.
 * Garantisce coerenza con header/bottom-nav (Assioma 4).
 */
export function getQuickAccessTiles(): NavItem[] {
  return [...ALWAYS_VISIBLE, ...TILE_ONLY].filter((item) => !item.adminOnly && item.tile)
}
