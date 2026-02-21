/**
 * API-Football Sync Job for FANTACONTRATTI
 *
 * Hourly check that triggers daily sync of match ratings, season stats,
 * and player cache from API-Football.
 *
 * Only runs in local dev (persistent Express server).
 * On Vercel, the same logic is invoked via Vercel Cron endpoint.
 */

import { cronJobManager } from './cron-job'
import { prisma } from '@/lib/prisma'

/**
 * Interval: check every hour (3600000 ms)
 */
const API_FOOTBALL_SYNC_INTERVAL_MS = 60 * 60 * 1000

export const API_FOOTBALL_SYNC_JOB_NAME = 'api-football-sync'

export function registerApiFootballSyncJob(): void {
  cronJobManager.register(
    API_FOOTBALL_SYNC_JOB_NAME,
    API_FOOTBALL_SYNC_INTERVAL_MS,
    async () => {
      const { shouldSync, getRemainingQuota } = await import('../../../services/api-football-quota')
      const { syncMatchRatings, syncStatsInternal, refreshCacheInternal } = await import('../../../services/api-football.service')

      // 1. Check if 24h have passed since last MATCH_RATINGS sync
      const needsMatchRatings = await shouldSync('MATCH_RATINGS')
      if (!needsMatchRatings) {
        return // Already synced today
      }

      // 2. Check quota
      const remaining = await getRemainingQuota()
      if (remaining < 2) {
        console.log('[CRON] API-Football sync skipped: quota exhausted')
        return
      }

      console.log(`[CRON] API-Football sync starting (quota remaining: ${remaining})`)

      // 3a. Priority: match ratings
      const ratingsResult = await syncMatchRatings({ maxFixtures: 5 })
      console.log(`[CRON] Match ratings: ${ratingsResult.message ?? ''}`)

      // 3b. If quota remains: season stats (check 24h separately)
      const needsStats = await shouldSync('SEASON_STATS')
      if (needsStats) {
        const statsRemaining = await getRemainingQuota()
        if (statsRemaining >= 10) {
          console.log('[CRON] Syncing season stats...')
          const statsResult = await syncStatsInternal()
          console.log(`[CRON] Season stats: ${statsResult.message ?? ''}`)

          await prisma.apiFootballSyncLog.create({
            data: {
              jobType: 'SEASON_STATS',
              status: statsResult.success ? 'SUCCESS' : 'FAILED',
              apiCallsUsed: statsResult.data?.apiCallsUsed || 0,
              details: statsResult.data || { error: statsResult.message },
              startedAt: new Date(),
              completedAt: new Date(),
            },
          })
        }
      }

      // 3c. If cache > 7 days: refresh cache
      const needsCache = await shouldSync('CACHE_REFRESH', 7 * 24 * 60 * 60 * 1000)
      if (needsCache) {
        const cacheRemaining = await getRemainingQuota()
        if (cacheRemaining >= 25) {
          console.log('[CRON] Refreshing API-Football cache...')
          const cacheResult = await refreshCacheInternal()
          console.log(`[CRON] Cache refresh: ${cacheResult.message ?? ''}`)

          await prisma.apiFootballSyncLog.create({
            data: {
              jobType: 'CACHE_REFRESH',
              status: cacheResult.success ? 'SUCCESS' : 'FAILED',
              apiCallsUsed: cacheResult.apiCallsUsed,
              details: { message: cacheResult.message },
              startedAt: new Date(),
              completedAt: new Date(),
            },
          })
        }
      }
    }
  )
}

export function startApiFootballSyncJob(): void {
  cronJobManager.start(API_FOOTBALL_SYNC_JOB_NAME)
}

export function stopApiFootballSyncJob(): void {
  cronJobManager.stop(API_FOOTBALL_SYNC_JOB_NAME)
}

export function getApiFootballSyncJobStatus() {
  return cronJobManager.getStatus(API_FOOTBALL_SYNC_JOB_NAME)
}
