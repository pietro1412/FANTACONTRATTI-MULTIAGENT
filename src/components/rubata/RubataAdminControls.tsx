import { Button } from '../ui/Button'
import type {
  LeagueMember,
  ActiveAuction,
  MemberBudgetInfo,
  RubataStateType,
} from '../../types/rubata.types'

// ============================================================
// Budget Panel (visible to all)
// ============================================================
interface BudgetPanelProps {
  memberBudgets: MemberBudgetInfo[]
}

export function BudgetPanel({ memberBudgets }: BudgetPanelProps) {
  return (
    <div className="bg-surface-200 rounded-2xl border border-primary-500/50 overflow-hidden sticky top-20">
      <div className="p-3 border-b border-surface-50/20 bg-primary-500/10">
        <h3 className="font-bold text-primary-400 text-sm flex items-center gap-2">
          <span>💰</span>
          Budget Residuo
        </h3>
      </div>
      <div className="p-2 space-y-1">
        {memberBudgets.map((mb, idx) => (
          <div
            key={mb.memberId}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${
              idx === 0 ? 'bg-accent-500/10 border border-accent-500/20' :
              mb.residuo < 0 ? 'bg-danger-500/10' :
              mb.residuo < 50 ? 'bg-warning-500/5' :
              'bg-surface-300/30'
            }`}
          >
            <span className="text-xs text-gray-400 truncate flex-1">{mb.teamName}</span>
            <span className={`text-sm font-bold ml-2 ${
              mb.residuo < 0 ? 'text-danger-400' :
              mb.residuo < 50 ? 'text-warning-400' :
              'text-accent-400'
            }`}>
              {mb.residuo}M
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Timer Settings Panel
// ============================================================
interface TimerSettingsPanelProps {
  offerTimer: number
  setOfferTimer: (v: number | ((prev: number) => number)) => void
  auctionTimer: number
  setAuctionTimer: (v: number | ((prev: number) => number)) => void
  isSubmitting: boolean
  onUpdateTimers: () => void
}

export function TimerSettingsPanel({
  offerTimer,
  setOfferTimer,
  auctionTimer,
  setAuctionTimer,
  isSubmitting,
  onUpdateTimers,
}: TimerSettingsPanelProps) {
  return (
    <div className="bg-surface-200 rounded-2xl border border-accent-500/50 overflow-hidden">
      <div className="p-3 border-b border-surface-50/20 bg-accent-500/10">
        <h3 className="font-bold text-accent-400 flex items-center gap-2">
          <span>⏱️</span>
          Timer
        </h3>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 uppercase mb-1">Offerta (sec)</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setOfferTimer(prev => Math.max(5, prev - 5)); }}
              className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
            >−</button>
            <input
              type="number"
              value={offerTimer}
              onChange={(e) => { setOfferTimer(Math.max(5, parseInt(e.target.value) || 5)); }}
              className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
            />
            <button
              onClick={() => { setOfferTimer(prev => prev + 5); }}
              className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
            >+</button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase mb-1">Asta (sec)</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setAuctionTimer(prev => Math.max(5, prev - 5)); }}
              className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
            >−</button>
            <input
              type="number"
              value={auctionTimer}
              onChange={(e) => { setAuctionTimer(Math.max(5, parseInt(e.target.value) || 5)); }}
              className="w-full min-w-0 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-2 text-white text-lg font-bold"
            />
            <button
              onClick={() => { setAuctionTimer(prev => prev + 5); }}
              className="w-10 h-10 shrink-0 rounded-lg bg-surface-300 text-white hover:bg-surface-100 text-xl font-bold flex items-center justify-center"
            >+</button>
          </div>
        </div>
        <Button
          onClick={onUpdateTimers}
          disabled={isSubmitting}
          size="sm"
          className="w-full"
        >
          💾 Salva
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Bot Simulation Panel
// ============================================================
interface BotSimulationPanelProps {
  rubataState: RubataStateType
  activeAuction: ActiveAuction | null
  members: LeagueMember[]
  myMemberId: string | undefined
  currentPlayerMemberId: string | undefined
  simulateMemberId: string
  setSimulateMemberId: (v: string) => void
  simulateBidAmount: number
  setSimulateBidAmount: (v: number | ((prev: number) => number)) => void
  isSubmitting: boolean
  onSimulateOffer: () => void
  onSimulateBid: () => void
}

export function BotSimulationPanel({
  rubataState,
  activeAuction,
  members,
  myMemberId,
  currentPlayerMemberId,
  simulateMemberId,
  setSimulateMemberId,
  simulateBidAmount,
  setSimulateBidAmount,
  isSubmitting,
  onSimulateOffer,
  onSimulateBid,
}: BotSimulationPanelProps) {
  if (rubataState !== 'OFFERING' && rubataState !== 'AUCTION') return null

  return (
    <div className="bg-surface-200 rounded-2xl border border-orange-500/50 overflow-hidden">
      <div className="p-4 border-b border-surface-50/20 bg-orange-500/10">
        <h3 className="font-bold text-orange-400 flex items-center gap-2">
          <span>🤖</span>
          Simula Bot
        </h3>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 uppercase mb-1">Manager</label>
          <select
            value={simulateMemberId}
            onChange={(e) => { setSimulateMemberId(e.target.value); }}
            className="w-full px-3 py-2 bg-surface-300 border border-surface-50/30 rounded-lg text-white text-sm"
          >
            <option value="">-- Seleziona --</option>
            {members
              .filter(m => m.id !== myMemberId && m.id !== currentPlayerMemberId)
              .map(m => (
                <option key={m.id} value={m.id}>
                  {m.user?.username || m.teamName || 'Unknown'}
                </option>
              ))}
          </select>
        </div>

        {rubataState === 'OFFERING' && (
          <Button
            onClick={onSimulateOffer}
            disabled={isSubmitting || !simulateMemberId}
            size="sm"
            variant="outline"
            className="w-full border-orange-500/50 text-orange-400"
          >
            🎯 Simula Offerta
          </Button>
        )}

        {rubataState === 'AUCTION' && activeAuction && (
          <>
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Importo</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setSimulateBidAmount(prev => Math.max(activeAuction.currentPrice + 1, prev - 1)); }}
                  className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                >−</button>
                <input
                  type="number"
                  value={simulateBidAmount}
                  onChange={(e) => { setSimulateBidAmount(Math.max(activeAuction.currentPrice + 1, parseInt(e.target.value) || 0)); }}
                  className="flex-1 text-center bg-surface-300 border border-surface-50/30 rounded-lg py-1 text-white text-sm"
                />
                <button
                  onClick={() => { setSimulateBidAmount(prev => prev + 1); }}
                  className="w-8 h-8 rounded-lg bg-surface-300 text-white text-sm"
                >+</button>
              </div>
            </div>
            <Button
              onClick={onSimulateBid}
              disabled={isSubmitting || !simulateMemberId || simulateBidAmount <= activeAuction.currentPrice}
              size="sm"
              variant="outline"
              className="w-full border-orange-500/50 text-orange-400"
            >
              💰 Simula Rilancio
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Complete Rubata Panel
// ============================================================
interface CompleteRubataPanelProps {
  rubataState: RubataStateType
  isSubmitting: boolean
  onCompleteRubata: () => void
}

export function CompleteRubataPanel({
  rubataState,
  isSubmitting,
  onCompleteRubata,
}: CompleteRubataPanelProps) {
  return (
    <div className="bg-surface-200 rounded-2xl border border-danger-500/50 overflow-hidden">
      <div className="p-3 border-b border-surface-50/20 bg-danger-500/10">
        <h3 className="font-bold text-danger-400 flex items-center gap-2">
          <span>⚡</span>
          Test Rapido
        </h3>
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-400 mb-3">Completa la rubata con transazioni casuali (30% rubate)</p>
        <Button
          onClick={onCompleteRubata}
          disabled={isSubmitting || rubataState === 'COMPLETED'}
          size="sm"
          className="w-full bg-danger-500 hover:bg-danger-600"
        >
          🚀 Completa Rubata
        </Button>
      </div>
    </div>
  )
}
