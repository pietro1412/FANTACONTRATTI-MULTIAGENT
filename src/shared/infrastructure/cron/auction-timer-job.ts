/**
 * Auction Timer Job for FANTACONTRATTI
 *
 * A pre-configured cron job that checks for expired auctions every 5 seconds.
 * When an auction timer expires, it emits a domain event for the Auction module to handle.
 */

import { cronJobManager } from './cron-job'
import { prisma } from '@/lib/prisma'
import { eventBus, DomainEventTypes, type AuctionTimerExpired } from '../events'

/**
 * Interval in milliseconds for checking expired auctions
 * Set to 5 seconds for responsive auction experience
 */
const AUCTION_TIMER_CHECK_INTERVAL_MS = 5000

/**
 * Job name constant for reference
 */
export const AUCTION_TIMER_JOB_NAME = 'auction-timer-check'

/**
 * Register the auction timer job with the cron manager
 *
 * This job:
 * - Runs every 5 seconds
 * - Finds auctions where timerExpiresAt <= now() AND status = 'ACTIVE'
 * - Emits AUCTION_TIMER_EXPIRED event for each expired auction
 *
 * The actual auction closing logic should be handled by event subscribers
 * in the Auction module, maintaining separation of concerns.
 */
export function registerAuctionTimerJob(): void {
  cronJobManager.register(
    AUCTION_TIMER_JOB_NAME,
    AUCTION_TIMER_CHECK_INTERVAL_MS,
    async () => {
      // Find all auctions that have expired timers
      const expiredAuctions = await prisma.auction.findMany({
        where: {
          status: 'ACTIVE',
          timerExpiresAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
        },
      })

      // Emit domain event for each expired auction
      for (const auction of expiredAuctions) {
        const event: AuctionTimerExpired = {
          auctionId: auction.id,
        }

        // Publish event - will be handled by Auction module
        await eventBus.publish(DomainEventTypes.AUCTION_TIMER_EXPIRED, event)
      }
    }
  )
}

/**
 * Start the auction timer job
 * Call this during application startup
 */
export function startAuctionTimerJob(): void {
  cronJobManager.start(AUCTION_TIMER_JOB_NAME)
}

/**
 * Stop the auction timer job
 * Call this during graceful shutdown
 */
export function stopAuctionTimerJob(): void {
  cronJobManager.stop(AUCTION_TIMER_JOB_NAME)
}

/**
 * Get the current status of the auction timer job
 */
export function getAuctionTimerJobStatus() {
  return cronJobManager.getStatus(AUCTION_TIMER_JOB_NAME)
}
