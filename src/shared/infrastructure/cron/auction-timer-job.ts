/**
 * Auction Timer Job for FANTACONTRATTI
 *
 * A pre-configured cron job that checks for expired auctions every 2 seconds.
 * When an auction timer expires, it emits a domain event and sends Pusher notification
 * for immediate client synchronization.
 */

import { cronJobManager } from './cron-job'
import { prisma } from '@/lib/prisma'
import { eventBus, DomainEventTypes, type AuctionTimerExpired } from '../events'
import { triggerAuctionClosed } from '@/services/pusher.service'

/**
 * Interval in milliseconds for checking expired auctions
 * Set to 2 seconds for responsive auction experience and better sync
 */
const AUCTION_TIMER_CHECK_INTERVAL_MS = 2000

/**
 * Job name constant for reference
 */
export const AUCTION_TIMER_JOB_NAME = 'auction-timer-check'

/**
 * Register the auction timer job with the cron manager
 *
 * This job:
 * - Runs every 2 seconds
 * - Finds auctions where timerExpiresAt <= now() AND status = 'ACTIVE'
 * - Emits AUCTION_TIMER_EXPIRED event for each expired auction
 * - Sends AUCTION_CLOSED Pusher event for immediate client notification
 *
 * The actual auction closing logic should be handled by event subscribers
 * in the Auction module, maintaining separation of concerns.
 */
export function registerAuctionTimerJob(): void {
  cronJobManager.register(
    AUCTION_TIMER_JOB_NAME,
    AUCTION_TIMER_CHECK_INTERVAL_MS,
    async () => {
      // Find all auctions that have expired timers with necessary data for Pusher event
      const expiredAuctions = await prisma.auction.findMany({
        where: {
          status: 'ACTIVE',
          timerExpiresAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
          playerId: true,
          marketSessionId: true,
          player: {
            select: {
              name: true,
            },
          },
          bids: {
            where: { isWinning: true },
            take: 1,
            select: {
              bidderId: true,
              amount: true,
              bidder: {
                select: {
                  user: {
                    select: { username: true },
                  },
                },
              },
            },
          },
        },
      })

      // Emit domain event and Pusher notification for each expired auction
      for (const auction of expiredAuctions) {
        const event: AuctionTimerExpired = {
          auctionId: auction.id,
        }

        // Publish domain event - will be handled by Auction module
        await eventBus.publish(DomainEventTypes.AUCTION_TIMER_EXPIRED, event)

        // Send Pusher event for immediate client notification
        if (auction.marketSessionId) {
          const winningBid = auction.bids[0]

          await triggerAuctionClosed(auction.marketSessionId, {
            auctionId: auction.id,
            playerId: auction.playerId,
            playerName: auction.player.name,
            winnerId: winningBid?.bidderId ?? null,
            winnerName: winningBid?.bidder.user.username ?? null,
            finalPrice: winningBid?.amount ?? null,
            wasUnsold: !winningBid,
            timestamp: new Date().toISOString(),
          })

          console.log(`[CRON] Auction ${auction.id} timer expired - Pusher event sent`)
        }
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
