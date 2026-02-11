/**
 * Standalone script for API-Football sync.
 *
 * Usage:
 *   npx tsx scripts/sync-api-football.ts                     # Incremental (5 fixtures)
 *   npx tsx scripts/sync-api-football.ts --backfill           # Loop until all done
 *   npx tsx scripts/sync-api-football.ts --backfill --with-stats  # Also sync season stats
 *   npx tsx scripts/sync-api-football.ts --max 10             # Custom max fixtures per run
 */

// Env vars loaded via dotenv-cli in npm scripts, or via system env

import { syncMatchRatings, syncStatsInternal } from '../src/services/api-football.service'
import { getRemainingQuota, getApiCallsUsedToday, DAILY_QUOTA_LIMIT } from '../src/services/api-football-quota'

const args = process.argv.slice(2)
const isBackfill = args.includes('--backfill')
const withStats = args.includes('--with-stats')
const maxIdx = args.indexOf('--max')
const maxFixtures = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) || 10 : isBackfill ? 10 : 5

async function main() {
  console.log('=== API-Football Sync ===')
  console.log(`Mode: ${isBackfill ? 'BACKFILL' : 'INCREMENTAL'}`)
  console.log(`Max fixtures per run: ${maxFixtures}`)
  console.log(`With stats: ${withStats}`)
  console.log()

  const usedToday = await getApiCallsUsedToday()
  console.log(`API calls used today: ${usedToday}/${DAILY_QUOTA_LIMIT}`)
  console.log()

  if (isBackfill) {
    let totalFixtures = 0
    let totalRatings = 0
    let totalApiCalls = 0
    let iteration = 0

    while (true) {
      iteration++
      const remaining = await getRemainingQuota()
      if (remaining < 2) {
        console.log(`\n[!] Quota exhausted (remaining: ${remaining}). Stopping.`)
        break
      }

      console.log(`--- Run #${iteration} (quota remaining: ${remaining}) ---`)
      const result = await syncMatchRatings({ maxFixtures })

      if (!result.success) {
        console.error(`Error: ${result.message}`)
        break
      }

      console.log(result.message)
      totalFixtures += result.data?.fixturesProcessed || 0
      totalRatings += result.data?.ratingsUpserted || 0
      totalApiCalls += result.data?.apiCallsUsed || 0

      if ((result.data?.remainingFixtures || 0) === 0) {
        console.log('\nAll fixtures synced!')
        break
      }

      // Delay between runs
      console.log(`Remaining fixtures: ${result.data?.remainingFixtures}. Waiting 2s...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    console.log(`\n=== Backfill complete ===`)
    console.log(`Total fixtures: ${totalFixtures}`)
    console.log(`Total ratings: ${totalRatings}`)
    console.log(`Total API calls: ${totalApiCalls}`)
  } else {
    // Single incremental run
    const result = await syncMatchRatings({ maxFixtures })
    console.log(result.success ? 'SUCCESS' : 'FAILED')
    console.log(result.message)
    if (result.data) {
      console.log(`Fixtures processed: ${result.data.fixturesProcessed}`)
      console.log(`Ratings upserted: ${result.data.ratingsUpserted}`)
      console.log(`API calls used: ${result.data.apiCallsUsed}`)
      console.log(`Remaining fixtures: ${result.data.remainingFixtures}`)
    }
  }

  // Optionally sync season stats
  if (withStats) {
    const remaining = await getRemainingQuota()
    if (remaining >= 10) {
      console.log('\n=== Syncing season stats ===')
      const statsResult = await syncStatsInternal()
      console.log(statsResult.success ? 'SUCCESS' : 'FAILED')
      console.log(statsResult.message)
    } else {
      console.log(`\nSkipping season stats sync (quota remaining: ${remaining})`)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
