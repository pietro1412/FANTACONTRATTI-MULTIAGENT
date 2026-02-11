import { AuctionTimer } from '../AuctionTimer'
import { BidControls } from './BidControls'
import type { Auction, Membership, MyRosterSlots } from '../../types/auctionroom.types'

interface MobileBottomBarProps {
  auction: Auction | null
  timeLeft: number | null
  timerSetting: number
  isTimerExpired: boolean
  isUserWinning: boolean
  membership: Membership | null
  bidAmount: string
  setBidAmount: (val: string) => void
  onPlaceBid: () => void
  myRosterSlots?: MyRosterSlots | null
  isBidding?: boolean
  isConnected?: boolean
}

export function MobileBottomBar({
  auction,
  timeLeft,
  timerSetting,
  isTimerExpired,
  isUserWinning,
  membership,
  bidAmount,
  setBidAmount,
  onPlaceBid,
  myRosterSlots,
  isBidding = false,
  isConnected = true,
}: MobileBottomBarProps) {
  if (!auction) return null

  // Check if role slot is full
  const auctionRole = auction.player.position as 'P' | 'D' | 'C' | 'A'
  const roleSlot = myRosterSlots?.slots[auctionRole]
  const isRoleFull = roleSlot ? roleSlot.filled >= roleSlot.total : false

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-3 shadow-2xl">
        {/* Timer + Current Info */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {auction.timerExpiresAt && (
              <AuctionTimer timeLeft={timeLeft} totalSeconds={timerSetting} compact />
            )}
            <div>
              <p className="text-sm text-gray-400 truncate max-w-[120px]">{auction.player.name}</p>
              <p className="text-2xl font-mono font-bold text-white">{auction.currentPrice}</p>
              {auction.bids.length > 0 && (
                <p className="text-xs text-gray-500 truncate max-w-[140px]">
                  {auction.bids[auction.bids.length - 1]?.bidder.teamName || auction.bids[auction.bids.length - 1]?.bidder.user.username}
                </p>
              )}
            </div>
          </div>
          {isUserWinning && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded-full font-medium border border-green-500/30">
              Vincendo
            </span>
          )}
        </div>

        {/* Bid Controls or Slot Full Banner */}
        {isRoleFull ? (
          <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/30 text-center">
            <p className="text-amber-400 font-bold text-sms">Slot Ruolo Completo</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Hai completato tutti gli slot per questo ruolo. Non puoi fare offerte.
            </p>
          </div>
        ) : (
          <BidControls
            bidAmount={bidAmount}
            setBidAmount={setBidAmount}
            onPlaceBid={onPlaceBid}
            currentPrice={auction.currentPrice}
            isTimerExpired={isTimerExpired}
            budget={membership?.currentBudget || 0}
            compact
            isBidding={isBidding}
            isConnected={isConnected}
          />
        )}
      </div>
    </div>
  )
}
