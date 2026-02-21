import { NominationPanel } from './NominationPanel'
import { ReadyCheckPanel } from './ReadyCheckPanel'
import { BiddingPanel } from './BiddingPanel'
import { AcknowledgmentPanel } from './AcknowledgmentPanel'
import { WaitingPanel } from './WaitingPanel'
import { AdminControlsPanel } from '../auction/AdminControlsPanel'
import type { AuctionViewProps, AuctionPhase } from './types'
import { PHASE_COLORS } from './types'

export function getAuctionPhase(props: Pick<AuctionViewProps, 'pendingAck' | 'readyStatus' | 'auction' | 'isMyTurn'>): AuctionPhase {
  if (props.pendingAck && !props.auction) return 'acknowledgment'
  if (props.readyStatus?.hasPendingNomination && !props.auction) return 'readyCheck'
  if (props.auction) return 'bidding'
  if (props.isMyTurn) return 'nomination'
  return 'waiting'
}

type CenterStageProps = AuctionViewProps

export function CenterStage(props: CenterStageProps) {
  const phase = getAuctionPhase(props)
  const colors = PHASE_COLORS[phase]

  return (
    <div className={`bg-slate-900/80 backdrop-blur-xl border-2 ${colors.border} rounded-xl border-white/10 overflow-hidden`}>
      {/* Phase header strip */}
      <div className={`px-4 py-2 ${colors.bg} border-b ${colors.border} flex items-center justify-between`}>
        <span className={`text-sms font-bold uppercase tracking-wider ${colors.text}`}>
          {colors.label}
        </span>
        {phase === 'bidding' && props.isUserWinning && (
          <span className="text-sms font-bold text-green-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Stai vincendo!
          </span>
        )}
      </div>

      {/* Content with fadeIn transition */}
      <div className="p-4 lg:p-5 animate-fade-in">
        {phase === 'acknowledgment' && props.pendingAck && (
          <AcknowledgmentPanel
            pendingAck={props.pendingAck}
            onAcknowledge={props.onAcknowledge}
            ackSubmitting={props.ackSubmitting}
            isAdmin={props.isAdmin}
            onForceAcknowledgeAll={props.onForceAcknowledgeAll}
          />
        )}

        {phase === 'readyCheck' && props.readyStatus && (
          <ReadyCheckPanel
            readyStatus={props.readyStatus}
            onConfirmNomination={props.onConfirmNomination}
            onCancelNomination={props.onCancelNomination}
            onMarkReady={props.onMarkReady}
            markingReady={props.markingReady}
            isAdmin={props.isAdmin}
            onForceAllReady={props.onForceAllReady}
          />
        )}

        {phase === 'bidding' && props.auction && (
          <BiddingPanel
            auction={props.auction}
            timeLeft={props.timeLeft}
            timerSetting={props.timerSetting}
            isTimerExpired={props.isTimerExpired}
            isUserWinning={props.isUserWinning}
            currentUsername={props.currentUsername}
            membership={props.membership}
            bidAmount={props.bidAmount}
            setBidAmount={props.setBidAmount}
            onPlaceBid={props.onPlaceBid}
            isAdmin={props.isAdmin}
            onCloseAuction={props.onCloseAuction}
            myRosterSlots={props.myRosterSlots}
            isBidding={props.isBidding}
            isConnected={props.isConnected}
          />
        )}

        {phase === 'nomination' && (
          <NominationPanel
            players={props.players}
            searchQuery={props.searchQuery}
            onSearchChange={props.onSearchChange}
            selectedTeam={props.selectedTeam}
            onTeamChange={props.onTeamChange}
            availableTeams={props.availableTeams}
            teamDropdownOpen={props.teamDropdownOpen}
            setTeamDropdownOpen={props.setTeamDropdownOpen}
            onNominatePlayer={props.onNominatePlayer}
            marketProgress={props.marketProgress}
            isPrimoMercato={props.isPrimoMercato}
          />
        )}

        {phase === 'waiting' && (
          <>
            <WaitingPanel
              currentTurnManager={props.currentTurnManager}
              marketProgress={props.marketProgress}
            />
            <NominationPanel
              players={props.players}
              searchQuery={props.searchQuery}
              onSearchChange={props.onSearchChange}
              selectedTeam={props.selectedTeam}
              onTeamChange={props.onTeamChange}
              availableTeams={props.availableTeams}
              teamDropdownOpen={props.teamDropdownOpen}
              setTeamDropdownOpen={props.setTeamDropdownOpen}
              onNominatePlayer={props.onNominatePlayer}
              marketProgress={props.marketProgress}
              isPrimoMercato={props.isPrimoMercato}
              disabled
            />
          </>
        )}
      </div>

      {/* Admin Controls - collapsible at bottom */}
      {props.isAdmin && (
        <div className="border-t border-white/10">
          <AdminControlsPanel
            isAdmin={props.isAdmin}
            timerSetting={props.timerSetting}
            hasAuction={!!props.auction}
            onUpdateTimer={props.onUpdateTimer}
            onBotNominate={props.onBotNominate}
            onBotConfirmNomination={props.onBotConfirmNomination}
            onBotBid={props.onBotBid}
            onForceAllReady={props.onForceAllReady}
            onForceAcknowledgeAll={props.onForceAcknowledgeAll}
            onCompleteAllSlots={props.onCompleteAllSlots}
            onResetFirstMarket={props.onResetFirstMarket}
          />
        </div>
      )}
    </div>
  )
}
