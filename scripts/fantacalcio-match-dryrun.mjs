/**
 * Fase 0 — Matching dry-run: nessuna scrittura DB.
 * Confronta i giocatori fantacalcio.it (da data/statistiche-fantacalcio/aggregato.json)
 * con i SerieAPlayer del DB, e verifica la stabilita' del playerId fantacalcio.it
 * attraverso le giornate (stesso nome+squadra atteso per lo stesso id, salvo
 * trasferimenti di gennaio legittimi).
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Stabilita' playerId attraverso le giornate (dati grezzi, non l'aggregato)
  const instabilities = []
  const identityBySeason = {}
  for (const season of ['2025-26', '2026-27']) {
    const dir = join('data', 'statistiche-fantacalcio', season)
    let files
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    } catch {
      continue
    }
    const seenIdentity = new Map() // playerId -> { nome, squadre: Set }
    for (const f of files) {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
      for (const p of data.players) {
        if (p.playerId == null) continue
        if (!seenIdentity.has(p.playerId)) {
          seenIdentity.set(p.playerId, { nome: p.nome, squadre: new Set([p.squadra]) })
        } else {
          const rec = seenIdentity.get(p.playerId)
          if (rec.nome !== p.nome) {
            instabilities.push({ season, playerId: p.playerId, nomeVisto: rec.nome, nomeNuovo: p.nome, giornata: data.giornata })
          }
          rec.squadre.add(p.squadra)
        }
      }
    }
    identityBySeason[season] = seenIdentity
    const multiTeam = [...seenIdentity.entries()].filter(([, v]) => v.squadre.size > 1)
    console.log(`${season}: ${seenIdentity.size} playerId distinti, ${multiTeam.length} con piu' di una squadra (probabili trasferimenti gennaio)`)
    if (multiTeam.length > 0) {
      console.log('  Esempi multi-squadra:', multiTeam.slice(0, 5).map(([id, v]) => `${v.nome} (${[...v.squadre].join(' -> ')})`).join(', '))
    }
  }
  console.log(`\nIncongruenze nome per stesso playerId (stessa stagione): ${instabilities.length}`)
  if (instabilities.length > 0) console.log(JSON.stringify(instabilities.slice(0, 10), null, 2))

  // 2. Matching vs DB — usa la stagione 2026-27 (corrente) come riferimento primario: il
  // roster squadre di quell'anno combacia esattamente con lo stato attuale del DB
  // (verificato: 0 discrepanze), mentre 2025-26 ha promosse/retrocesse diverse
  // (Cremonese/Verona/Pisa vs Monza/Venezia/Frosinone) che rompono il matching
  // per-squadra. Il fantacalcioId trovato qui viene poi riusato anche per le
  // righe storiche 2025-26 dello stesso giocatore (playerId stabile tra stagioni,
  // verificato sotto).
  const { matchFantacalcioPlayers } = await import('../src/services/fantacalcio-matching.service.ts')

  const toFcPlayers = (map) => [...map.entries()].map(([playerId, v]) => ({
    fantacalcioPlayerId: playerId,
    name: v.nome,
    team: [...v.squadre][v.squadre.size - 1], // ultima squadra nota
  }))

  const fantacalcioPlayers2027 = toFcPlayers(identityBySeason['2026-27'])
  const fantacalcioPlayers2526 = toFcPlayers(identityBySeason['2025-26'])

  const dbPlayers = await prisma.serieAPlayer.findMany({
    where: { isActive: true, listStatus: 'IN_LIST' },
    select: { id: true, name: true, team: true },
  })

  const reportPrimary = matchFantacalcioPlayers(dbPlayers, fantacalcioPlayers2027)

  console.log(`\n=== REPORT MATCHING vs 2026-27 (vs ${dbPlayers.length} giocatori DB IN_LIST) ===`)
  console.log('Matchati:', reportPrimary.matched.length)
  console.log('Ambigui:', reportPrimary.ambiguous.length)
  console.log('DB non matchati:', reportPrimary.unmatchedDb.length)

  // 2b. Fallback — giocatori assenti dalle giornate 2026-27 scaricate finora
  // (infortunati, fuori rosa, non ancora scesi in campo): non compaiono nel
  // pool candidati sopra e restano orfani anche se hanno uno storico 2025-26
  // valido sotto lo stesso fantacalcioId stabile. Riprova il matching (sempre
  // per-squadra, quindi le squadre promosse/retrocesse — assenti dal pool
  // 2025-26 — vengono saltate senza rischio di match sbagliati) contro il
  // pool 2025-26 per i soli non-matchati dal passaggio primario.
  const reportFallback = matchFantacalcioPlayers(reportPrimary.unmatchedDb, fantacalcioPlayers2526)

  console.log(`\n=== FALLBACK MATCHING vs 2025-26 (vs ${reportPrimary.unmatchedDb.length} non matchati) ===`)
  console.log('Recuperati:', reportFallback.matched.length)
  console.log('Ambigui:', reportFallback.ambiguous.length)
  console.log('Ancora non matchati:', reportFallback.unmatchedDb.length)

  const report = {
    matched: [...reportPrimary.matched, ...reportFallback.matched],
    ambiguous: [...reportPrimary.ambiguous, ...reportFallback.ambiguous],
    unmatchedDb: reportFallback.unmatchedDb,
    unmatchedFantacalcio: reportPrimary.unmatchedFantacalcio,
  }

  console.log(`\n=== TOTALE (primario + fallback) ===`)
  console.log('Matchati:', report.matched.length)
  console.log('Ambigui:', report.ambiguous.length)
  console.log('DB non matchati:', report.unmatchedDb.length)
  console.log('Fantacalcio.it non matchati:', report.unmatchedFantacalcio.length)

  const strategyCounts = {}
  for (const m of report.matched) strategyCounts[m.strategy] = (strategyCounts[m.strategy] || 0) + 1
  console.log('Per strategia:', JSON.stringify(strategyCounts))

  const outPath = join('data', 'statistiche-fantacalcio', 'match-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log('\nReport completo salvato in', outPath)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRORE:', e)
  await prisma.$disconnect()
  process.exit(1)
})
