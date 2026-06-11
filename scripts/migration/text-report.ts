/**
 * Text Report Generator
 * Produces a chronological narrative of the league's history
 * from the parsed Excel data.
 */

import { INITIAL_BUDGET, calculateRescissionClause, SESSIONS } from './config.js'
import type {
  ParsedWorkbook, ParsedIniziale, InitialTeamBlock, InitialPlayer,
  ParsedAuctionSession, Zone1Team, Zone1Transaction, Zone2Contract,
  FinancialSummary,
} from './types.js'

const LINE = '═'.repeat(60)
const THIN = '─'.repeat(60)

export function generateTextReport(workbook: ParsedWorkbook): string {
  const lines: string[] = []
  const log = (s: string = '') => lines.push(s)

  log('╔' + '═'.repeat(58) + '╗')
  log('║   FANTACONTRATTI - RICOSTRUZIONE STORICA 2011-2026      ║')
  log('║   Generato da analyze-historical-data.ts                ║')
  log('╚' + '═'.repeat(58) + '╝')
  log()
  log(`Totale sessioni: ${workbook.sessions.length + 1} (1 primo mercato + ${workbook.sessions.length} aste)`)
  log(`Budget iniziale ipotizzato: ${INITIAL_BUDGET} crediti`)
  log()

  // ===============================
  // INIZIALE '11
  // ===============================
  reportIniziale(workbook.iniziale, log)

  // ===============================
  // AUCTION SESSIONS
  // ===============================
  for (const session of workbook.sessions) {
    reportAuctionSession(session, log)
  }

  // ===============================
  // WARNINGS
  // ===============================
  if (workbook.allWarnings.length > 0) {
    log()
    log(LINE)
    log('  AVVERTIMENTI E PROBLEMI')
    log(LINE)
    for (const w of workbook.allWarnings) {
      log(`  ⚠ ${w}`)
    }
  }

  // ===============================
  // GLOBAL STATS
  // ===============================
  reportGlobalStats(workbook, log)

  return lines.join('\n')
}

function reportIniziale(iniziale: ParsedIniziale, log: (s: string) => void) {
  const sessionDef = SESSIONS[0]

  // Separate teams with tracked prices from teams without
  const withPrices = iniziale.teams.filter(t => t.totalSpent > 0 || t.players.some(p => p.price > 0))
  const withoutPrices = iniziale.teams.filter(t => t.totalSpent === 0 && !t.players.some(p => p.price > 0))

  log(LINE)
  log(`  SESSIONE: Iniziale '11 (Primo Mercato)`)
  log(`  Stagione ${sessionDef.season} - Semestre Estivo`)
  log(LINE)
  log()
  log(`SQUADRE PARTECIPANTI: ${iniziale.teams.length}`)
  log(`  ${iniziale.teams.map(t => t.person || t.nickname).join(' | ')}`)
  if (withoutPrices.length > 0) {
    log(`  NOTA: per ${withoutPrices.map(t => t.person || t.nickname).join(', ')} i prezzi d'acquisto non sono stati registrati`)
  }
  log(`TOTALE GIOCATORI: ${iniziale.totalPlayers}`)
  log()

  for (const team of iniziale.teams) {
    const hasPrice = team.totalSpent > 0 || team.players.some(p => p.price > 0)

    log(`── ${team.person || team.nickname} (${team.nickname}) ──────────────────────────────────`)
    if (hasPrice) {
      log(`  Budget speso: ${team.totalSpent}/${INITIAL_BUDGET}`)
      log(`  Residuo: ${INITIAL_BUDGET - team.totalSpent}`)
    } else {
      log(`  Budget speso: non tracciato (stessa asta, prezzi non registrati)`)
    }

    // Count by position
    const posCounts: Record<string, number> = {}
    for (const p of team.players) {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1
    }
    const posStr = Object.entries(posCounts).map(([k, v]) => `${v}${k}`).join(', ')
    log(`  Rosa: ${team.players.length} giocatori (${posStr})`)
    log()

    // Calculate monte ingaggi
    const monteIngaggi = team.players.reduce((sum, p) => sum + p.salary, 0)
    log(`  Monte Ingaggi: ${monteIngaggi}`)

    // List players
    log(`  Acquisti:`)
    for (const p of team.players) {
      const clauseCheck = calculateRescissionClause(p.salary, p.duration)
      const clauseOk = clauseCheck === p.clause ? '' : ` [MISMATCH: calc=${clauseCheck}]`
      if (hasPrice) {
        const line = `    ${p.position.padEnd(4)} ${p.name.padEnd(25)} (${p.club.padEnd(5)}) ${String(p.price).padStart(3)} cr  [ing=${p.salary} dur=${p.duration} cl=${p.clause}${clauseOk}]`
        log(line)
      } else {
        const line = `    ${p.position.padEnd(4)} ${p.name.padEnd(25)} (${p.club.padEnd(5)})        [ing=${p.salary} dur=${p.duration} cl=${p.clause}${clauseOk}]`
        log(line)
      }
    }
    log()
  }
}

function reportAuctionSession(session: ParsedAuctionSession, log: (s: string) => void) {
  const { sessionDef, zone1, zone2, financialSummaries, warnings } = session
  const semesterName = sessionDef.semester === 1 ? 'Estivo' : 'Invernale'

  log()
  log(LINE)
  log(`  SESSIONE: ${sessionDef.sheetName} (${sessionDef.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'})`)
  log(`  Stagione ${sessionDef.season} - Semestre ${semesterName} - Anno ${sessionDef.year}`)
  log(`  Codice: ${sessionDef.code}`)
  log(LINE)
  log()

  // Session warnings
  if (warnings.length > 0) {
    for (const w of warnings) {
      log(`  ⚠ ${w}`)
    }
    log()
  }

  // Zone 1: Transactions
  if (zone1) {
    log(`  ZONE 1 - TRANSAZIONI (${zone1.teams.length} squadre)`)
    log(THIN)

    for (const team of zone1.teams) {
      log()
      log(`  ── ${team.person || team.nickname} (${team.nickname}) ──`)
      log(`     Spesa netta: ${team.netSpend}`)

      if (team.transactions.length === 0) {
        log(`     Nessuna transazione`)
        continue
      }

      // Separate buys (positive/zero) and sells (negative)
      const buys = team.transactions.filter(t => t.amount >= 0 && !t.isSpecial)
      const sells = team.transactions.filter(t => t.amount < 0)
      const specials = team.transactions.filter(t => t.isSpecial)

      if (buys.length > 0) {
        log(`     Acquisti (${buys.length}):`)
        for (const t of buys) {
          log(`       + ${t.playerName.padEnd(25)} ${String(t.amount).padStart(4)} cr`)
        }
      }

      if (sells.length > 0) {
        log(`     Cessioni (${sells.length}):`)
        for (const t of sells) {
          log(`       - ${t.playerName.padEnd(25)} ${String(t.amount).padStart(4)} cr`)
        }
      }

      if (specials.length > 0) {
        log(`     Speciali:`)
        for (const t of specials) {
          log(`       ? ${t.playerName.padEnd(25)} [${t.specialMarker}]`)
        }
      }

      // Verify net spend matches
      const calcNet = team.transactions.reduce((sum, t) => sum + t.amount, 0)
      if (calcNet !== team.netSpend) {
        log(`     ⚠ Spesa netta calcolata: ${calcNet} (header dice: ${team.netSpend})`)
      }
    }
    log()
  } else {
    log(`  ZONE 1: non rilevata`)
    log()
  }

  // Zone 2: Contract Registry
  if (zone2) {
    const totalContracts = zone2.teams.reduce((sum, t) => sum + t.contracts.length, 0)
    log(`  ZONE 2 - REGISTRO CONTRATTI (${totalContracts} contratti trovati)`)
    log(THIN)

    for (const team of zone2.teams) {
      if (team.contracts.length === 0) continue

      // Group by type
      const byType: Record<string, Zone2Contract[]> = {}
      for (const c of team.contracts) {
        const key = c.type || 'unknown'
        if (!byType[key]) byType[key] = []
        byType[key].push(c)
      }

      for (const [type, contracts] of Object.entries(byType)) {
        if (contracts.length === 0) continue
        log(`     Tipo: ${type} (${contracts.length})`)
        for (const c of contracts.slice(0, 30)) {  // limit to first 30 per type
          const updStr = c.salaryUpdated !== null
            ? ` -> ing=${c.salaryUpdated} dur=${c.durationUpdated} cl=${c.clauseUpdated}`
            : ''
          log(`       ${c.playerName.padEnd(22)} ${c.club.padEnd(4)} [${c.originSession.padEnd(3)}] ing=${c.salaryOriginal} dur=${c.durationOriginal} cl=${c.clauseOriginal}${updStr}`)
        }
        if (contracts.length > 30) {
          log(`       ... e altri ${contracts.length - 30}`)
        }
      }
    }
    log()
  } else {
    log(`  ZONE 2: non rilevata`)
    log()
  }

  // Financial summaries
  if (financialSummaries.length > 0) {
    log(`  RIEPILOGO FINANZIARIO`)
    log(THIN)
    log(`  ${'Squadra'.padEnd(15)} ${'Res'.padStart(5)} ${'Ent'.padStart(5)} ${'Pre'.padStart(5)} ${'Via'.padStart(5)} ${'Nuo'.padStart(5)} ${'Tot'.padStart(5)}`)
    for (const fs of financialSummaries) {
      log(`  ${(fs.person || fs.nickname).padEnd(15)} ${String(fs.residual).padStart(5)} ${String(fs.income).padStart(5)} ${String(fs.prizes).padStart(5)} ${String(fs.outgoing).padStart(5)} ${String(fs.newSpend).padStart(5)} ${String(fs.total).padStart(5)}`)
    }
    log()
  }
}

function reportGlobalStats(workbook: ParsedWorkbook, log: (s: string) => void) {
  log()
  log(LINE)
  log('  STATISTICHE GLOBALI')
  log(LINE)
  log()

  // Count unique players across all sessions
  const allPlayerNames = new Set<string>()

  // From Iniziale
  for (const team of workbook.iniziale.teams) {
    for (const p of team.players) {
      allPlayerNames.add(p.name.toLowerCase())
    }
  }

  // From Zone 1 transactions
  for (const session of workbook.sessions) {
    if (session.zone1) {
      for (const team of session.zone1.teams) {
        for (const t of team.transactions) {
          allPlayerNames.add(t.playerName.toLowerCase())
        }
      }
    }
  }

  // From Zone 2 contracts
  for (const session of workbook.sessions) {
    if (session.zone2) {
      for (const team of session.zone2.teams) {
        for (const c of team.contracts) {
          allPlayerNames.add(c.playerName.toLowerCase())
        }
      }
    }
  }

  log(`  Giocatori unici menzionati: ${allPlayerNames.size}`)
  log(`  Sessioni con Zone 1: ${workbook.sessions.filter(s => s.zone1 !== null).length}/${workbook.sessions.length}`)
  log(`  Sessioni con Zone 2: ${workbook.sessions.filter(s => s.zone2 !== null).length}/${workbook.sessions.length}`)
  log(`  Sessioni con riepilogo finanziario: ${workbook.sessions.filter(s => s.financialSummaries.length > 0).length}/${workbook.sessions.length}`)

  // Per-person stats
  log()
  log(`  PARTECIPAZIONE PER PERSONA:`)
  const personSessions: Record<string, number> = {}

  for (const team of workbook.iniziale.teams) {
    if (team.person) personSessions[team.person] = (personSessions[team.person] || 0) + 1
  }

  for (const session of workbook.sessions) {
    if (session.zone1) {
      for (const team of session.zone1.teams) {
        if (team.person) personSessions[team.person] = (personSessions[team.person] || 0) + 1
      }
    }
  }

  for (const [person, count] of Object.entries(personSessions).sort((a, b) => b[1] - a[1])) {
    log(`    ${person.padEnd(15)}: ${count} sessioni`)
  }

  // Zone 2 contract type breakdown
  const typeBreakdown: Record<string, number> = {}
  for (const session of workbook.sessions) {
    if (session.zone2) {
      for (const team of session.zone2.teams) {
        for (const c of team.contracts) {
          typeBreakdown[c.type] = (typeBreakdown[c.type] || 0) + 1
        }
      }
    }
  }

  if (Object.keys(typeBreakdown).length > 0) {
    log()
    log(`  TIPI DI CONTRATTO (Zone 2 totali cross-sessione):`)
    for (const [type, count] of Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])) {
      log(`    ${type.padEnd(15)}: ${count}`)
    }
  }

  // Iniziale summary table
  log()
  log(`  RIEPILOGO INIZIALE '11:`)
  log(`  ${'Squadra'.padEnd(15)} ${'Speso'.padStart(5)} ${'Res'.padStart(5)} ${'#G'.padStart(4)} ${'P'.padStart(3)} ${'D'.padStart(3)} ${'C'.padStart(3)} ${'A'.padStart(3)} ${'Ing'.padStart(5)}`)
  for (const team of workbook.iniziale.teams) {
    const posCounts: Record<string, number> = {}
    let monteIngaggi = 0
    for (const p of team.players) {
      posCounts[p.position] = (posCounts[p.position] || 0) + 1
      monteIngaggi += p.salary
    }
    const hasPrice = team.totalSpent > 0 || team.players.some(p => p.price > 0)
    const spentStr = hasPrice ? String(team.totalSpent).padStart(5) : '  N/A'
    const resStr = hasPrice ? String(INITIAL_BUDGET - team.totalSpent).padStart(5) : '  N/A'
    log(`  ${(team.person || team.nickname).padEnd(15)} ${spentStr} ${resStr} ${String(team.players.length).padStart(4)} ${String(posCounts['P'] || 0).padStart(3)} ${String(posCounts['D'] || 0).padStart(3)} ${String(posCounts['C'] || 0).padStart(3)} ${String(posCounts['A'] || 0).padStart(3)} ${String(monteIngaggi).padStart(5)}`)
  }
}
