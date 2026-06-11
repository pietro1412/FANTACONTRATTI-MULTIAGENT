/**
 * AdminControlsPanel.tsx - Pannello controlli admin per test asta
 *
 * Box riutilizzabile per tutti i layout contenente:
 * - Pulsanti di test (simula scelta, conferma, offerta bot, etc.)
 *
 * NOTA: Questo componente non sarà visibile nella versione finale.
 * Il selettore del timer asta è stato spostato nel pannello ufficiale
 * "Azioni Admin" (AdminActionsPanel). (test-session #27)
 */

import { Button } from '../ui/Button'

interface AdminControlsPanelProps {
  isAdmin: boolean
  hasAuction: boolean
  onBotNominate?: () => void
  onBotConfirmNomination?: () => void
  onBotBid?: () => void
  onForceAllReady?: () => void
  onForceAcknowledgeAll?: () => void
  onCompleteAllSlots?: () => void
  onResetFirstMarket?: () => void
}

export function AdminControlsPanel({
  isAdmin,
  hasAuction,
  onBotNominate,
  onBotConfirmNomination,
  onBotBid,
  onForceAllReady,
  onForceAcknowledgeAll,
  onCompleteAllSlots,
  onResetFirstMarket
}: AdminControlsPanelProps) {
  if (!isAdmin) return null

  return (
    <div className="bg-surface-200 rounded-xl border border-accent-500/30 overflow-hidden">
      <div className="p-3 border-b border-surface-50/20 bg-accent-500/10">
        <h3 className="font-bold text-accent-400 text-sm flex items-center gap-2">
          <span>⚙️</span>
          Controlli Admin (TEST)
        </h3>
      </div>
      <div className="p-3 space-y-3">
        {/* Test Buttons */}
        <div className="space-y-2">
          <p className="text-xs text-warning-500 font-bold uppercase">Test Mode</p>

          {onBotNominate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBotNominate}
              className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
            >
              🎯 Simula Scelta Giocatore
            </Button>
          )}

          {onBotConfirmNomination && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBotConfirmNomination}
              className="w-full text-xs border-warning-500/50 text-warning-400 hover:bg-warning-500/10"
            >
              ✅ Simula Conferma Scelta
            </Button>
          )}

          {hasAuction && onBotBid && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBotBid}
              className="w-full text-xs border-primary-500/50 text-primary-400 hover:bg-primary-500/10"
            >
              💰 Simula Offerta Bot
            </Button>
          )}

          {onForceAllReady && (
            <Button
              size="sm"
              variant="outline"
              onClick={onForceAllReady}
              className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
            >
              Forza Tutti Pronti
            </Button>
          )}

          {onForceAcknowledgeAll && (
            <Button
              size="sm"
              variant="outline"
              onClick={onForceAcknowledgeAll}
              className="w-full text-xs border-accent-500/50 text-accent-400 hover:bg-accent-500/10"
            >
              Forza Conferme
            </Button>
          )}

          {onCompleteAllSlots && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCompleteAllSlots}
              className="w-full text-xs border-secondary-500/50 text-secondary-400 hover:bg-secondary-500/10"
            >
              ✅ Completa Tutti Slot
            </Button>
          )}

          {onResetFirstMarket && (
            <Button
              size="sm"
              variant="danger"
              onClick={onResetFirstMarket}
              className="w-full text-xs"
            >
              Reset Asta
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminControlsPanel
