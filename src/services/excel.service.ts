import * as XLSX from 'xlsx'

/**
 * Excel Service - Generate contract renewal exports
 */

export interface ContractExportData {
  teamName: string
  leagueName: string
  exportDate: Date
  contracts: Array<{
    playerName: string
    position: string
    realTeam: string
    // Current contract
    currentSalary: number
    currentDuration: number
    currentClause: number
    // Draft/proposed values
    draftSalary: number | null
    draftDuration: number | null
    draftClause: number | null
    // Flags
    isReleased: boolean      // Marcato per taglio
    isSpalmaActive: boolean  // Regola spalma attivata (duration from 1 to higher)
    // Exit info (for ESTERO/RETROCESSO players)
    isExitedPlayer: boolean
    exitReason: string | null
    exitDecision: string | null  // KEEP, RELEASE, or null (undecided)
    indemnityAmount: number
  }>
  pendingContracts: Array<{
    playerName: string
    position: string
    realTeam: string
    acquisitionPrice: number
    acquisitionType: string
    minSalary: number
    draftSalary: number | null
    draftDuration: number | null
  }>
  budget: number
}

/**
 * Generate an Excel file for contract renewals
 */
export function generateContractsExcel(data: ContractExportData): Buffer {
  const workbook = XLSX.utils.book_new()

  // Sheet 1: Contratti Attivi
  const contractsData = data.contracts.map(c => {
    const salaryChange = c.draftSalary ? c.draftSalary - c.currentSalary : 0
    const durationChange = c.draftDuration ? c.draftDuration - c.currentDuration : 0

    return {
      'Giocatore': c.playerName,
      'Pos': c.position,
      'Squadra Reale': c.realTeam,
      'Ingaggio Attuale': c.currentSalary,
      'Durata Attuale': c.currentDuration,
      'Clausola Attuale': c.currentClause,
      'Nuovo Ingaggio': c.draftSalary ?? '-',
      'Nuova Durata': c.draftDuration ?? '-',
      'Nuova Clausola': c.draftClause ?? '-',
      'Variazione Ingaggio': salaryChange !== 0 ? (salaryChange > 0 ? `+${salaryChange}` : salaryChange) : '-',
      'Variazione Durata': durationChange !== 0 ? (durationChange > 0 ? `+${durationChange}` : durationChange) : '-',
      'Tagliato': c.isReleased ? 'SI' : '',
      'Spalma Attivato': c.isSpalmaActive ? 'SI' : '',
      'Uscito Lista': c.isExitedPlayer ? 'SI' : '',
      'Motivo Uscita': c.exitReason ?? '',
      'Decisione': c.exitDecision ?? '',
      'Indennizzo': c.indemnityAmount > 0 ? c.indemnityAmount : '',
    }
  })

  const contractsSheet = XLSX.utils.json_to_sheet(contractsData)

  // Set column widths
  contractsSheet['!cols'] = [
    { wch: 25 },  // Giocatore
    { wch: 5 },   // Pos
    { wch: 15 },  // Squadra Reale
    { wch: 12 },  // Ingaggio Attuale
    { wch: 12 },  // Durata Attuale
    { wch: 12 },  // Clausola Attuale
    { wch: 12 },  // Nuovo Ingaggio
    { wch: 12 },  // Nuova Durata
    { wch: 12 },  // Nuova Clausola
    { wch: 14 },  // Variazione Ingaggio
    { wch: 14 },  // Variazione Durata
    { wch: 8 },   // Tagliato
    { wch: 12 },  // Spalma Attivato
    { wch: 10 },  // Uscito Lista
    { wch: 15 },  // Motivo Uscita
    { wch: 10 },  // Decisione
    { wch: 10 },  // Indennizzo
  ]

  XLSX.utils.book_append_sheet(workbook, contractsSheet, 'Contratti Attivi')

  // Sheet 2: Nuovi Contratti (pending)
  if (data.pendingContracts.length > 0) {
    const pendingData = data.pendingContracts.map(p => ({
      'Giocatore': p.playerName,
      'Pos': p.position,
      'Squadra Reale': p.realTeam,
      'Prezzo Acquisto': p.acquisitionPrice,
      'Tipo Acquisto': formatAcquisitionType(p.acquisitionType),
      'Ingaggio Minimo': p.minSalary,
      'Ingaggio Proposto': p.draftSalary ?? '-',
      'Durata Proposta': p.draftDuration ?? '-',
    }))

    const pendingSheet = XLSX.utils.json_to_sheet(pendingData)

    pendingSheet['!cols'] = [
      { wch: 25 },  // Giocatore
      { wch: 5 },   // Pos
      { wch: 15 },  // Squadra Reale
      { wch: 14 },  // Prezzo Acquisto
      { wch: 15 },  // Tipo Acquisto
      { wch: 14 },  // Ingaggio Minimo
      { wch: 14 },  // Ingaggio Proposto
      { wch: 14 },  // Durata Proposta
    ]

    XLSX.utils.book_append_sheet(workbook, pendingSheet, 'Nuovi Contratti')
  }

  // Sheet 3: Riepilogo
  const summaryData = [
    { 'Voce': 'Squadra', 'Valore': data.teamName },
    { 'Voce': 'Lega', 'Valore': data.leagueName },
    { 'Voce': 'Data Export', 'Valore': formatDate(data.exportDate) },
    { 'Voce': '', 'Valore': '' },
    { 'Voce': 'Contratti Attivi', 'Valore': data.contracts.length },
    { 'Voce': 'Nuovi Contratti', 'Valore': data.pendingContracts.length },
    { 'Voce': 'Giocatori Tagliati', 'Valore': data.contracts.filter(c => c.isReleased).length },
    { 'Voce': 'Spalma Attivati', 'Valore': data.contracts.filter(c => c.isSpalmaActive).length },
    { 'Voce': 'Giocatori Usciti', 'Valore': data.contracts.filter(c => c.isExitedPlayer).length },
    { 'Voce': '', 'Valore': '' },
    { 'Voce': 'Budget Attuale', 'Valore': `${data.budget}M` },
    { 'Voce': 'Monte Ingaggi Attuale', 'Valore': `${data.contracts.reduce((sum, c) => sum + c.currentSalary, 0)}M` },
    { 'Voce': 'Monte Ingaggi Proposto', 'Valore': `${calculateProposedSalary(data)}M` },
  ]

  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  summarySheet['!cols'] = [
    { wch: 25 },
    { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo')

  // Generate buffer - use 'array' type and convert to Buffer for better compatibility
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return Buffer.from(arrayBuffer)
}

function formatAcquisitionType(type: string): string {
  const types: Record<string, string> = {
    'FIRST_MARKET': 'Primo Mercato',
    'RUBATA': 'Rubata',
    'SVINCOLATI': 'Svincolati',
    'TRADE': 'Scambio',
  }
  return types[type] || type
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateProposedSalary(data: ContractExportData): number {
  let total = 0

  for (const c of data.contracts) {
    if (c.isReleased) continue // Tagliato, non conta
    if (c.isExitedPlayer && c.exitDecision === 'RELEASE') continue // Uscito e rilasciato

    // Use draft salary if available, otherwise current
    total += c.draftSalary ?? c.currentSalary
  }

  // Add pending contracts with draft values
  for (const p of data.pendingContracts) {
    if (p.draftSalary) {
      total += p.draftSalary
    }
  }

  return total
}
