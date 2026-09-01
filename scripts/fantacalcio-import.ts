/**
 * Import statistiche fantacalcio.it: applica il matching persistito
 * (SerieAPlayer.fantacalcioId) e importa tutte le giornate raccolte in
 * data/statistiche-fantacalcio/ in FantacalcioMatchRating.
 *
 * Usage:
 *   npx tsx scripts/fantacalcio-import.ts --dry-run   # nessuna scrittura, solo conteggi
 *   npx tsx scripts/fantacalcio-import.ts             # scrittura reale
 *   npx tsx scripts/fantacalcio-import.ts --skip-matching  # salta l'applicazione del matching (gia' fatta)
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { applyMatches, importGiornata, type RawGiornataData } from '../src/services/fantacalcio-import.service'
import type { MatchReport } from '../src/services/fantacalcio-matching.service'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_MATCHING = args.includes('--skip-matching')

async function main() {
  console.log(`=== Import fantacalcio.it ${DRY_RUN ? '(DRY-RUN)' : '(SCRITTURA REALE)'} ===\n`)

  // 1. Applica il matching persistito (da Fase 0)
  if (!SKIP_MATCHING) {
    const report: MatchReport = JSON.parse(readFileSync(join('data', 'statistiche-fantacalcio', 'match-report.json'), 'utf-8'))
    console.log(`Matching da applicare: ${report.matched.length} coppie`)
    if (DRY_RUN) {
      console.log('(dry-run: skip applyMatches)')
    } else {
      const result = await applyMatches(report.matched.map((m) => ({ dbId: m.dbId, fantacalcioPlayerId: m.fantacalcioPlayerId })))
      console.log(`Matching applicato: ${result.updated}/${report.matched.length}`)
      if (result.errors.length > 0) {
        console.log('Errori:', JSON.stringify(result.errors.slice(0, 5), null, 2))
      }
    }
  } else {
    console.log('(--skip-matching: matching gia\' applicato in precedenza)')
  }

  // 2. Importa tutte le giornate di tutte le stagioni disponibili
  const baseDir = join('data', 'statistiche-fantacalcio')
  const seasons = readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const summary: Array<{ giornata: number; season: string; upserted: number; skippedUnmatched: number; skippedNoMatchId: number }> = []

  for (const season of seasons) {
    const dir = join(baseDir, season)
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    console.log(`\n--- Stagione ${season}: ${files.length} giornate ---`)

    for (const f of files) {
      const data: RawGiornataData = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
      const result = await importGiornata(data, DRY_RUN)
      summary.push({ ...result, season })
      console.log(`  Giornata ${result.giornata}: upserted=${result.upserted} unmatched=${result.skippedUnmatched} noMatchId=${result.skippedNoMatchId}`)
    }
  }

  const totalUpserted = summary.reduce((s, r) => s + r.upserted, 0)
  const totalUnmatched = summary.reduce((s, r) => s + r.skippedUnmatched, 0)
  const totalNoMatchId = summary.reduce((s, r) => s + r.skippedNoMatchId, 0)

  console.log('\n=== RIEPILOGO TOTALE ===')
  console.log('Righe upserted:', totalUpserted)
  console.log('Righe skip (giocatore non matchato):', totalUnmatched)
  console.log('Righe skip (nessun matchId):', totalNoMatchId)

  process.exit(0)
}

main().catch((e) => {
  console.error('ERRORE:', e)
  process.exit(1)
})
