// @ts-nocheck
/**
 * FASE A: Analisi Testuale dei Dati Storici
 *
 * Questo script legge il file Excel "Fantacontratti storico.xlsx"
 * e produce un report testuale cronologico (storico-analisi.txt)
 * che racconta la storia della lega sessione per sessione.
 *
 * Non tocca il database. Serve per validare il parsing prima della migrazione.
 *
 * Uso:
 *   npx tsx scripts/analyze-historical-data.ts
 *   npx tsx scripts/analyze-historical-data.ts --sheet "asta febb 26"
 *   npx tsx scripts/analyze-historical-data.ts --verbose
 */

import XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { parseWorkbook, parseAuctionSheet, parseIniziale } from './migration/excel-parser.js'
import { generateTextReport } from './migration/text-report.js'
import { SESSIONS } from './migration/config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse CLI args
const args = process.argv.slice(2)
const sheetFilter = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null
const verbose = args.includes('--verbose')

async function main() {
  const excelPath = path.join(__dirname, '..', 'Fantacontratti storico.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error('File Excel non trovato:', excelPath)
    process.exit(1)
  }

  console.log('Lettura file Excel...')
  const wb = XLSX.readFile(excelPath)
  console.log(`Fogli trovati: ${wb.SheetNames.length}`)

  if (sheetFilter) {
    // Single sheet mode
    console.log(`Modalita singolo foglio: "${sheetFilter}"`)

    if (sheetFilter === "Iniziale '11") {
      const iniziale = parseIniziale(wb)
      console.log(`\nTeam trovati: ${iniziale.teams.length}`)
      console.log(`Giocatori totali: ${iniziale.totalPlayers}`)
      for (const team of iniziale.teams) {
        console.log(`  ${team.person || team.nickname}: ${team.players.length} giocatori, speso ${team.totalSpent}`)
      }
      return
    }

    const sessionDef = SESSIONS.find(s => s.sheetName === sheetFilter)
    if (!sessionDef) {
      console.error(`Sessione non trovata: "${sheetFilter}"`)
      console.log('Sessioni disponibili:')
      for (const s of SESSIONS) {
        console.log(`  "${s.sheetName}"`)
      }
      process.exit(1)
    }

    const parsed = parseAuctionSheet(wb, sessionDef)
    console.log(`\nZone 1: ${parsed.zone1 ? parsed.zone1.teams.length + ' squadre' : 'non trovata'}`)
    console.log(`Zone 2: ${parsed.zone2 ? parsed.zone2.teams.reduce((s, t) => s + t.contracts.length, 0) + ' contratti' : 'non trovata'}`)
    console.log(`Riepiloghi: ${parsed.financialSummaries.length}`)
    console.log(`Warnings: ${parsed.warnings.length}`)
    for (const w of parsed.warnings) {
      console.log(`  - ${w}`)
    }

    if (verbose && parsed.zone1) {
      console.log('\n--- Zone 1 ---')
      for (const team of parsed.zone1.teams) {
        console.log(`${team.person || team.nickname} (${team.nickname}): netto ${team.netSpend}, ${team.transactions.length} transazioni`)
        for (const t of team.transactions) {
          console.log(`  ${t.amount >= 0 ? '+' : ''}${t.amount} ${t.playerName}${t.isSpecial ? ' [' + t.specialMarker + ']' : ''}`)
        }
      }
    }

    if (verbose && parsed.zone2) {
      console.log('\n--- Zone 2 ---')
      for (const team of parsed.zone2.teams) {
        for (const c of team.contracts) {
          console.log(`  [${c.type}] ${c.originSession} ${c.playerName} (${c.club}) ing=${c.salaryOriginal} dur=${c.durationOriginal} cl=${c.clauseOriginal}`)
        }
      }
    }
    return
  }

  // Full workbook mode
  console.log('Parsing completo del workbook...')
  const workbook = parseWorkbook(wb)

  console.log(`\nIniziale: ${workbook.iniziale.teams.length} team, ${workbook.iniziale.totalPlayers} giocatori`)
  console.log(`Sessioni asta: ${workbook.sessions.length}`)
  console.log(`Warnings totali: ${workbook.allWarnings.length}`)

  // Summary per session
  for (const session of workbook.sessions) {
    const z1Info = session.zone1 ? `Z1: ${session.zone1.teams.length} sq` : 'Z1: -'
    const z2Info = session.zone2 ? `Z2: ${session.zone2.teams.reduce((s, t) => s + t.contracts.length, 0)} ctr` : 'Z2: -'
    const fsInfo = session.financialSummaries.length > 0 ? `FS: ${session.financialSummaries.length}` : 'FS: -'
    const warnInfo = session.warnings.length > 0 ? ` [${session.warnings.length} warn]` : ''
    console.log(`  ${session.sessionDef.code.padEnd(4)} ${session.sessionDef.sheetName.padEnd(20)} ${z1Info.padEnd(10)} ${z2Info.padEnd(15)} ${fsInfo}${warnInfo}`)
  }

  // Generate report
  console.log('\nGenerazione report testuale...')
  const report = generateTextReport(workbook)

  const outputPath = path.join(__dirname, '..', 'storico-analisi.txt')
  fs.writeFileSync(outputPath, report, 'utf8')
  console.log(`Report scritto su: ${outputPath}`)
  console.log(`Dimensione: ${Math.round(report.length / 1024)} KB, ${report.split('\n').length} righe`)
}

main().catch(err => {
  console.error('Errore:', err)
  process.exit(1)
})
