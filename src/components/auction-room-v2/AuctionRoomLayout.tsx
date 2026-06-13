import { CockpitShell } from '@/components/cockpit/CockpitShell'
import { StatusBar } from './StatusBar'
import { RoleProgressRail } from './RoleProgressRail'
import { CockpitRailAdminBar } from './CockpitRailAdminBar'
import { CenterStage, getAuctionPhase } from './CenterStage'
import { FinancialDashboard } from './FinancialDashboard'
import { MyPortfolio } from './MyPortfolio'
import { MobileSidePanel } from './MobileSidePanel'
import { MobileBottomBar } from './MobileBottomBar'
import { AdminActionsPanel } from './AdminActionsPanel'
import { AdminControlsPanel } from '../auction/AdminControlsPanel'
import { AdminTestFab } from '../auction/AdminTestFab'
import type { AuctionViewProps } from './types'

/**
 * Layout asta a cockpit (mockup 05/cockpit.html): viewport bloccata su
 * desktop — testata, rail+admin e arena sempre visibili, scroll SOLO
 * interno alle colonne Manager e La mia rosa. Mobile invariato
 * (MobileSidePanel, MobileBottomBar, flusso a colonna singola).
 */
export function AuctionRoomLayout(props: AuctionViewProps) {
  const phase = getAuctionPhase(props)

  // Find current user's team initial from managersStatus
  const myManager = props.managersStatus?.managers.find(m => m.id === props.managersStatus?.myId)
  const teamInitial = myManager?.teamName?.charAt(0)?.toUpperCase() || myManager?.username?.charAt(0)?.toUpperCase() || 'F'

  return (
    <CockpitShell
      header={
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
      }
      adminBar={
        <>
          {/* Desktop: rail ruoli + azioni admin fusi in una riga sempre visibile (P7) */}
          <div className="hidden lg:block mt-2">
            <CockpitRailAdminBar
              marketProgress={props.marketProgress}
              isPrimoMercato={props.isPrimoMercato}
              myRosterSlots={props.myRosterSlots}
              isAdmin={props.isAdmin}
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
          </div>
          {/* Mobile: rail ruoli come prima */}
          <div className="lg:hidden mt-3">
            <RoleProgressRail
              marketProgress={props.marketProgress}
              isPrimoMercato={props.isPrimoMercato}
              myRosterSlots={props.myRosterSlots}
            />
          </div>
        </>
      }
    >
      {/* Mobile: side panel triggers */}
      <div className="lg:hidden mt-3">
        <MobileSidePanel
          managersStatus={props.managersStatus}
          onSelectManager={props.onSelectManager}
          myRosterSlots={props.myRosterSlots}
          budget={props.membership?.currentBudget || 0}
          currentBidderUsername={props.auction?.bids[0]?.bidder.user.username ?? null}
        />
      </div>

      {/* Main: 3 colonne a viewport bloccata su desktop / colonna singola su mobile */}
      <div className="mt-3 lg:mt-0 lg:pt-2 lg:h-full lg:min-h-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_280px] lg:gap-3">
        {/* Sinistra: Manager — scroll interno */}
        <div className="hidden lg:flex lg:flex-col lg:min-h-0">
          <FinancialDashboard
            managersStatus={props.managersStatus}
            onSelectManager={props.onSelectManager}
            currentBidderUsername={props.auction?.bids[0]?.bidder.user.username ?? null}
          />
        </div>

        {/* Centro: arena sempre visibile */}
        <div className="space-y-3 min-w-0 lg:space-y-0 lg:flex lg:flex-col lg:min-h-0">
          {/* Mobile: pannello admin completo come prima (su desktop vive nella barra rail+admin) */}
          {props.isAdmin && (
            <div className="lg:hidden">
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
            </div>
          )}
          <CenterStage {...props} />
        </div>

        {/* Destra: La mia rosa — scroll interno */}
        <div className="hidden lg:flex lg:flex-col lg:min-h-0">
          <MyPortfolio
            myRosterSlots={props.myRosterSlots}
            budget={props.membership?.currentBudget || 0}
          />
        </div>
      </div>

      {/* Controlli admin di TEST in floating button (solo dev/test, sparisce in produzione) */}
      <AdminTestFab isAdmin={props.isAdmin}>
        <AdminControlsPanel
          isAdmin={props.isAdmin}
          hasAuction={!!props.auction}
          onBotNominate={props.onBotNominate}
          onBotConfirmNomination={props.onBotConfirmNomination}
          onBotBid={props.onBotBid}
          onForceAllReady={props.onForceAllReady}
          onForceAcknowledgeAll={props.onForceAcknowledgeAll}
          onCompleteAllSlots={props.onCompleteAllSlots}
          onResetFirstMarket={props.onResetFirstMarket}
        />
      </AdminTestFab>

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
    </CockpitShell>
  )
}
