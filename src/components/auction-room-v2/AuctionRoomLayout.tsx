import { StatusBar } from './StatusBar'
import { RoleProgressRail } from './RoleProgressRail'
import { CenterStage, getAuctionPhase } from './CenterStage'
import { FinancialDashboard } from './FinancialDashboard'
import { MyPortfolio } from './MyPortfolio'
import { MobileSidePanel } from './MobileSidePanel'
import { MobileBottomBar } from './MobileBottomBar'
import { AdminActionsPanel } from './AdminActionsPanel'
import type { AuctionViewProps } from './types'

export function AuctionRoomLayout(props: AuctionViewProps) {
  const phase = getAuctionPhase(props)

  // Find current user's team initial from managersStatus
  const myManager = props.managersStatus?.managers.find(m => m.id === props.managersStatus?.myId)
  const teamInitial = myManager?.teamName?.charAt(0)?.toUpperCase() || myManager?.username?.charAt(0)?.toUpperCase() || 'F'

  return (
    <div className="space-y-3">
      {/* Status Bar - always visible */}
      <StatusBar
        isConnected={props.isConnected}
        connectionStatus={props.connectionStatus}
        currentTurnManager={props.currentTurnManager}
        isMyTurn={props.isMyTurn}
        membership={props.membership}
        currentPhase={phase}
        myRosterSlots={props.myRosterSlots}
        onPauseAuction={props.onPauseAuction}
        onExit={props.onNavigate && props.leagueId ? () => { props.onNavigate!('leagueDetail', { leagueId: props.leagueId! }); } : undefined}
        isAdmin={props.isAdmin}
        teamInitial={teamInitial}
        teamName={myManager?.teamName || myManager?.username}
        leagueSize={props.managersStatus?.managers.length}
        onRequestPause={props.onRequestPause}
        pauseRequest={props.pauseRequest}
        dismissPauseRequest={props.dismissPauseRequest}
      />

      {/* Role progress rail — where the market is, on its own row */}
      <RoleProgressRail
        marketProgress={props.marketProgress}
        isPrimoMercato={props.isPrimoMercato}
        myRosterSlots={props.myRosterSlots}
      />

      {/* Mobile: side panel triggers */}
      <MobileSidePanel
        managersStatus={props.managersStatus}
        onSelectManager={props.onSelectManager}
        myRosterSlots={props.myRosterSlots}
        budget={props.membership?.currentBudget || 0}
        currentBidderUsername={props.auction?.bids[0]?.bidder.user.username ?? null}
      />

      {/* Desktop: narrow side columns, dominant center stage / Mobile: single column */}
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)_280px] lg:gap-4">
        {/* Left: Managers (desktop only) */}
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <FinancialDashboard
              managersStatus={props.managersStatus}
              onSelectManager={props.onSelectManager}
              currentBidderUsername={props.auction?.bids[0]?.bidder.user.username ?? null}
            />
          </div>
        </div>

        {/* Center: Main Stage — the decision zone always on top; admin tools below it */}
        <div className="space-y-3 min-w-0">
          <CenterStage {...props} />
          {props.isAdmin && (
            <AdminActionsPanel
              canCloseAuction={props.auction?.status === 'ACTIVE'}
              onCloseAuction={props.onCloseAuction}
              canReopenAuction={!!props.lastReopenableAuction || !!props.pendingAck?.winner}
              onReopenAuction={props.onReopenAuction}
              pendingAppeals={props.pendingAppeals ?? []}
              resolvingAppealId={props.resolvingAppealId ?? null}
              onResolveAppeal={props.onResolveAppeal ?? (() => {})}
              timerSetting={props.timerSetting}
              onUpdateTimer={props.onUpdateTimer}
            />
          )}
        </div>

        {/* Right: My Portfolio (desktop only) */}
        <div className="hidden lg:block">
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
        myRosterSlots={props.myRosterSlots}
        isBidding={props.isBidding}
        isConnected={props.isConnected}
      />
    </div>
  )
}
