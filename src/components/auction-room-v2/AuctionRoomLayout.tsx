import { StatusBar } from './StatusBar'
import { CenterStage, getAuctionPhase } from './CenterStage'
import { FinancialDashboard } from './FinancialDashboard'
import { MyPortfolio } from './MyPortfolio'
import { MobileSidePanel } from './MobileSidePanel'
import { MobileBottomBar } from './MobileBottomBar'
import type { AuctionViewProps } from './types'

export function AuctionRoomLayout(props: AuctionViewProps) {
  const phase = getAuctionPhase(props)

  return (
    <div className="space-y-3">
      {/* Status Bar - always visible */}
      <StatusBar
        isConnected={props.isConnected}
        connectionStatus={props.connectionStatus}
        currentTurnManager={props.currentTurnManager}
        isMyTurn={props.isMyTurn}
        marketProgress={props.marketProgress}
        isPrimoMercato={props.isPrimoMercato}
        membership={props.membership}
        currentPhase={phase}
      />

      {/* Error/Success messages */}
      {/* (handled by parent AuctionRoom.tsx) */}

      {/* Mobile: side panel triggers */}
      <MobileSidePanel
        managersStatus={props.managersStatus}
        firstMarketStatus={props.firstMarketStatus}
        onSelectManager={props.onSelectManager}
        myRosterSlots={props.myRosterSlots}
        budget={props.membership?.currentBudget || 0}
      />

      {/* Desktop: 3-column grid / Mobile: single column */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-4">
        {/* Left: Financial Dashboard (desktop only) */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-4">
            <FinancialDashboard
              managersStatus={props.managersStatus}
              firstMarketStatus={props.firstMarketStatus}
              onSelectManager={props.onSelectManager}
            />
          </div>
        </div>

        {/* Center: Main Stage */}
        <div className="lg:col-span-6">
          <CenterStage {...props} />
        </div>

        {/* Right: My Portfolio (desktop only) */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-4">
            <MyPortfolio
              myRosterSlots={props.myRosterSlots}
              budget={props.membership?.currentBudget || 0}
            />
          </div>
        </div>
      </div>

      {/* Mobile: sticky bottom bid controls during auction */}
      <MobileBottomBar
        auction={props.auction}
        timeLeft={props.timeLeft}
        timerSetting={props.timerSetting}
        isTimerExpired={props.isTimerExpired}
        isUserWinning={props.isUserWinning}
        membership={props.membership}
        bidAmount={props.bidAmount}
        setBidAmount={props.setBidAmount}
        onPlaceBid={props.onPlaceBid}
      />
    </div>
  )
}
