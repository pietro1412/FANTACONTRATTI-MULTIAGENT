/**
 * Cron Job Infrastructure Exports
 *
 * This module exports the cron job manager and pre-configured jobs.
 */

// Cron Job Manager
export { CronJobManager, cronJobManager } from './cron-job'
export type { CronJob } from './cron-job'

// Auction Timer Job
export {
  registerAuctionTimerJob,
  startAuctionTimerJob,
  stopAuctionTimerJob,
  getAuctionTimerJobStatus,
  AUCTION_TIMER_JOB_NAME,
} from './auction-timer-job'

// API-Football Sync Job
export {
  registerApiFootballSyncJob,
  startApiFootballSyncJob,
  stopApiFootballSyncJob,
  getApiFootballSyncJobStatus,
  API_FOOTBALL_SYNC_JOB_NAME,
} from './api-football-sync-job'
