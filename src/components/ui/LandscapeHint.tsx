import { RotateCcw } from 'lucide-react'

export function LandscapeHint() {
  return (
    <div className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-300/50 border border-surface-50/10 text-xs text-gray-400 mb-3">
      <RotateCcw size={16} className="flex-shrink-0" />
      <span>Ruota il telefono per una visualizzazione migliore dei grafici</span>
    </div>
  )
}
