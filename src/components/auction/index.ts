/**
 * Auction Components Index
 *
 * Export di tutti i componenti per i layout asta
 */

export { AuctionLayoutSelector, useAuctionLayout } from './AuctionLayoutSelector'
export type { AuctionLayout } from './AuctionLayoutSelector'

// Legacy layouts (kept for backwards compatibility, will be removed)
export { LayoutA } from './LayoutA'
export { LayoutB } from './LayoutB'
export { LayoutC } from './LayoutC'
export { LayoutD } from './LayoutD'
export { LayoutE } from './LayoutE'
export { LayoutF } from './LayoutF'

// Consolidated layouts (Sprint 4)
export { LayoutMobile } from './LayoutMobile'
export { LayoutDesktop } from './LayoutDesktop'
export { LayoutPro } from './LayoutPro'

export * from './types'
