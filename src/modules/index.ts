/**
 * Modules Index
 *
 * Central export point for all module routers.
 * Import from here to register module routes in the main API.
 *
 * Usage:
 *   import { auctionRouter, rubataRouter, svincolatiRouter } from '@/modules'
 *
 *   app.use('/api/auctions', auctionRouter)
 *   app.use('/api/rubata', rubataRouter)
 *   app.use('/api/svincolati', svincolatiRouter)
 */

// Auction Module
export { auctionRouter } from './auction/infrastructure/api'

// Rubata Module
export { rubataRouter } from './rubata/infrastructure/api'

// Svincolati Module
export { svincolatiRouter } from './svincolati/infrastructure/api'
