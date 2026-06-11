import { useState } from 'react'
import { Eye, SkipForward } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '../ui/Button'
import { getTeamLogo } from '../../utils/teamLogos'

function TeamLogo({ team }: { team: string }) {
  return (
    <img
      src={getTeamLogo(team)}
      alt={team}
      className="w-full h-full object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

interface RubataPreference {
  id: string
  playerId: string
  isWatchlist: boolean
  isAutoPass: boolean
  maxBid: number | null
  priority: number | null
  notes: string | null
}

interface BoardPlayerBase {
  rosterId: string
  playerName: string
  playerTeam: string
  rubataPrice: number
  preference?: RubataPreference | null
}

export interface PreferenceModalProps {
  player: BoardPlayerBase
  onClose: () => void
  onSave: (data: { isWatchlist: boolean; isAutoPass: boolean; maxBid: number | null; priority: number | null; notes: string | null }) => Promise<void>
  onDelete: () => Promise<void>
  isSubmitting: boolean
}

export function PreferenceModal({ player, onClose, onSave, onDelete, isSubmitting }: PreferenceModalProps) {
  const [formData, setFormData] = useState({
    isWatchlist: player.preference?.isWatchlist ?? false,
    isAutoPass: player.preference?.isAutoPass ?? false,
    maxBid: player.preference?.maxBid?.toString() || '',
    priority: player.preference?.priority?.toString() || '',
    notes: player.preference?.notes || '',
  })

  const handleSave = async () => {
    await onSave({
      isWatchlist: formData.isWatchlist,
      isAutoPass: formData.isAutoPass,
      maxBid: formData.maxBid ? parseInt(formData.maxBid) : null,
      priority: formData.priority ? parseInt(formData.priority) : null,
      notes: formData.notes || null,
    })
  }

  return (
    <Modal isOpen={true} onClose={onClose} size="md" showCloseButton={false} className="border-primary-500/50">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded p-1">
            <TeamLogo team={player.playerTeam} />
          </div>
          <div>
            <h3 className="font-bold text-white">{player.playerName}</h3>
            <p className="text-sm text-gray-400">{player.playerTeam} • {player.rubataPrice}M</p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Form */}
        <div className="space-y-4">
          {/* Watchlist + AutoPass toggles */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setFormData(p => ({ ...p, isWatchlist: !p.isWatchlist, isAutoPass: !p.isWatchlist ? false : p.isAutoPass })); }}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all min-h-[44px] ${
                formData.isWatchlist
                  ? 'bg-primary-500/20 border-primary-500/60 text-primary-400'
                  : 'bg-surface-300/50 border-surface-50/20 text-gray-500 hover:border-surface-50/40'
              }`}
            >
              <Eye size={16} aria-hidden="true" />
              <span className="text-sm font-medium">Watchlist</span>
            </button>
            <button
              type="button"
              onClick={() => { setFormData(p => ({ ...p, isAutoPass: !p.isAutoPass, isWatchlist: !p.isAutoPass ? false : p.isWatchlist })); }}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all min-h-[44px] ${
                formData.isAutoPass
                  ? 'bg-gray-500/20 border-gray-500/60 text-gray-300'
                  : 'bg-surface-300/50 border-surface-50/20 text-gray-500 hover:border-surface-50/40'
              }`}
            >
              <SkipForward size={16} aria-hidden="true" />
              <span className="text-sm font-medium">Auto-skip</span>
            </button>
          </div>
          {formData.isAutoPass && (
            <p className="text-xs text-gray-500 text-center -mt-2">Non farai offerte per questo giocatore</p>
          )}

          {/* Max bid with +/- buttons */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Budget massimo</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setFormData(p => ({
                  ...p,
                  maxBid: String(Math.max(0, (parseInt(p.maxBid) || 0) - 5))
                })); }}
                disabled={!formData.maxBid || parseInt(formData.maxBid) <= 0}
                className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-lg bg-surface-300 border border-surface-50/30 text-white text-xl font-bold hover:bg-surface-50/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={formData.maxBid}
                  onChange={e => { setFormData(p => ({ ...p, maxBid: e.target.value })); }}
                  placeholder="—"
                  className="w-full text-center text-2xl font-bold bg-transparent text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-gray-500">milioni</p>
              </div>
              <button
                type="button"
                onClick={() => { setFormData(p => ({
                  ...p,
                  maxBid: String((parseInt(p.maxBid) || 0) + 5)
                })); }}
                className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-lg bg-surface-300 border border-surface-50/30 text-white text-xl font-bold hover:bg-surface-50/20 transition-all"
              >
                +
              </button>
            </div>
            {formData.maxBid && (
              <button
                type="button"
                onClick={() => { setFormData(p => ({ ...p, maxBid: '' })); }}
                className="mt-1 text-xs text-gray-500 hover:text-gray-400"
              >
                Rimuovi limite
              </button>
            )}
          </div>

          {/* Priority with star rating */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Priorità</label>
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map(star => {
                const currentPriority = parseInt(formData.priority) || 0
                const isActive = star <= currentPriority
                return (
                  <button
                    type="button"
                    key={star}
                    onClick={() => { setFormData(p => ({
                      ...p,
                      priority: p.priority === String(star) ? '' : String(star)
                    })); }}
                    className={`w-10 h-10 min-h-[44px] min-w-[44px] text-2xl transition-all transform hover:scale-110 ${
                      isActive ? 'text-accent-400' : 'text-gray-500 hover:text-accent-400/50'
                    }`}
                    title={`Priorità ${star}`}
                  >
                    {isActive ? '★' : '☆'}
                  </button>
                )
              })}
            </div>
            <p className="text-center text-xs text-gray-500 mt-1">
              {formData.priority ? `Priorità ${formData.priority} (clicca per rimuovere)` : 'Clicca per impostare'}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="preference-notes">Note private</label>
            <Textarea
              id="preference-notes"
              textareaSize="sm"
              value={formData.notes}
              onChange={e => { setFormData(p => ({ ...p, notes: e.target.value })); }}
              placeholder="Appunti personali..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        {player.preference && (
          <Button
            onClick={() => void onDelete()}
            disabled={isSubmitting}
            variant="outline"
            className="border-danger-500/50 text-danger-400 hover:bg-danger-500/10"
          >
            Rimuovi
          </Button>
        )}
        <Button onClick={onClose} variant="outline" className="flex-1">
          Annulla
        </Button>
        <Button onClick={() => void handleSave()} disabled={isSubmitting} className="flex-1">
          Salva
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default PreferenceModal
