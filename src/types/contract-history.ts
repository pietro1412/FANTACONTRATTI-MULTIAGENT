// =============================================================================
// Contract History Types
// =============================================================================
// Types for tracking contract changes and manager snapshots during market sessions

// Matches Prisma enum ContractEventType
export type ContractEventType =
  | 'SESSION_START_SNAPSHOT'    // Snapshot iniziale sessione
  | 'DURATION_DECREMENT'        // Decremento automatico durata
  | 'AUTO_RELEASE_EXPIRED'      // Svincolo automatico (durata 0)
  | 'RENEWAL'                   // Rinnovo con aumento
  | 'SPALMA'                    // Applicazione spalma
  | 'RELEASE_NORMAL'            // Taglio normale
  | 'RELEASE_ESTERO'            // Rilascio giocatore estero
  | 'RELEASE_RETROCESSO'        // Rilascio giocatore retrocesso
  | 'KEEP_ESTERO'               // Mantenimento giocatore estero
  | 'KEEP_RETROCESSO'           // Mantenimento giocatore retrocesso
  | 'INDEMNITY_RECEIVED';       // Indennizzo ricevuto

// Matches Prisma enum SnapshotType
export type SnapshotType =
  | 'SESSION_START'    // Inizio sessione (dopo decremento durata)
  | 'PHASE_START'      // Inizio fase CONTRATTI (dopo premi)
  | 'PHASE_END';       // Fine fase CONTRATTI (dopo consolidamento)

// Contract history entry from database
export interface ContractHistoryEntry {
  id: string;
  contractId: string | null;
  playerId: string;
  leagueMemberId: string;
  marketSessionId: string;
  eventType: ContractEventType;
  previousSalary: number | null;
  previousDuration: number | null;
  previousClause: number | null;
  newSalary: number | null;
  newDuration: number | null;
  newClause: number | null;
  cost: number | null;
  income: number | null;
  notes: string | null;
  createdAt: Date;
  // Populated relations
  player?: {
    id: string;
    name: string;
    team: string;
    position: string;
  };
}

// Manager session snapshot from database
export interface ManagerSessionSnapshot {
  id: string;
  leagueMemberId: string;
  marketSessionId: string;
  snapshotType: SnapshotType;
  budget: number;
  totalSalaries: number;
  balance: number;
  totalIndemnities: number | null;
  totalReleaseCosts: number | null;
  totalRenewalCosts: number | null;
  contractCount: number;
  releasedCount: number | null;
  renewedCount: number | null;
  createdAt: Date;
}

// Input for creating contract history entries
export interface CreateContractHistoryInput {
  contractId?: string;
  playerId: string;
  leagueMemberId: string;
  marketSessionId: string;
  eventType: ContractEventType;
  previousSalary?: number;
  previousDuration?: number;
  previousClause?: number;
  newSalary?: number;
  newDuration?: number;
  newClause?: number;
  cost?: number;
  income?: number;
  notes?: string;
}

// Input for creating manager snapshots
export interface CreateManagerSnapshotInput {
  leagueMemberId: string;
  marketSessionId: string;
  snapshotType: SnapshotType;
  budget: number;
  totalSalaries: number;
  balance: number;
  totalIndemnities?: number;
  totalReleaseCosts?: number;
  totalRenewalCosts?: number;
  contractCount: number;
  releasedCount?: number;
  renewedCount?: number;
}

// Summary of session contract history for a manager
export interface ManagerSessionSummary {
  leagueMemberId: string;
  managerName: string;
  teamName: string;
  // From PHASE_START snapshot
  initialBudget: number;
  initialSalaries: number;
  initialBalance: number;
  initialContractCount: number;
  // Calculated from history
  totalIndemnities: number;
  totalReleaseCosts: number;
  totalRenewalCosts: number;
  // Current state
  currentBudget: number;
  currentSalaries: number;
  currentBalance: number;
  currentContractCount: number;
  // Counts
  releasedCount: number;
  renewedCount: number;
  spalmaCount: number;
  // Details
  events: ContractHistoryEntry[];
}

// Prospetto line item for UI
export interface ProspettoLineItem {
  id: string;
  description: string;
  playerName?: string;
  eventType: ContractEventType;
  debit?: number;   // Negative impact on balance (tagli, rinnovi)
  credit?: number;  // Positive impact on balance (indennizzi)
  timestamp: Date;
}

// Contract phase prospetto (real-time summary during CONTRATTI)
export interface ContractPhaseProspetto {
  // Budget section
  budgetIniziale: number;
  indennizziRicevuti: number;
  costiTagli: number;
  costiRinnovi: number;
  budgetAttuale: number;
  // Salaries section
  ingaggiIniziali: number;
  ingaggiAttuali: number;
  variazionIngaggi: number;
  // Balance
  bilancioIniziale: number;
  bilancioAttuale: number;
  // Counts
  contrattiIniziali: number;
  contrattiAttuali: number;
  giocatoriTagliati: number;
  contrattiRinnovati: number;
  contrattiSpalmati: number;
  // Line items for detailed view
  lineItems: ProspettoLineItem[];
}

// Historical session summary for viewing past sessions
export interface HistoricalSessionSummary {
  sessionId: string;
  sessionName: string;
  season: number;
  semester: number;
  phaseStartSnapshot: ManagerSessionSnapshot | null;
  phaseEndSnapshot: ManagerSessionSnapshot | null;
  contractEvents: ContractHistoryEntry[];
  // Calculated
  budgetChange: number;
  salariesChange: number;
  netChange: number;
}
