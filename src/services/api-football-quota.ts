import { prisma } from '@/lib/prisma'


const DAILY_QUOTA_LIMIT = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT || '100', 10)

/**
 * Get the number of API calls used today across all sync jobs.
 * Reads from ApiFootballSyncLog entries created today.
 */
export async function getApiCallsUsedToday(): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const result = await prisma.apiFootballSyncLog.aggregate({
    _sum: { apiCallsUsed: true },
    where: {
      createdAt: { gte: todayStart },
    },
  })

  return result._sum.apiCallsUsed || 0
}

/**
 * Get remaining API calls available today.
 */
export async function getRemainingQuota(): Promise<number> {
  const used = await getApiCallsUsedToday()
  return Math.max(0, DAILY_QUOTA_LIMIT - used)
}

/**
 * Check if we have enough quota for a given number of calls.
 */
export async function hasQuota(callsNeeded: number = 1): Promise<boolean> {
  const remaining = await getRemainingQuota()
  return remaining >= callsNeeded
}

/**
 * Get the last successful sync time for a specific job type.
 */
export async function getLastSuccessfulSync(jobType: string): Promise<Date | null> {
  const log = await prisma.apiFootballSyncLog.findFirst({
    where: {
      jobType,
      status: { in: ['SUCCESS', 'PARTIAL'] },
    },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  })

  return log?.completedAt || null
}

/**
 * Check if enough time has passed since last sync (default 24h).
 */
export async function shouldSync(jobType: string, minIntervalMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
  const lastSync = await getLastSuccessfulSync(jobType)
  if (!lastSync) return true
  return Date.now() - lastSync.getTime() >= minIntervalMs
}

export { DAILY_QUOTA_LIMIT }
