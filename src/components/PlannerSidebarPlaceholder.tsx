/**
 * PlannerSidebarPlaceholder - Placeholder for Planner Widget
 * Part of Sprint 2: Layout 3 Colonne
 * Will be replaced with full PlannerWidget in Sprint 3
 */

interface PlannerSidebarPlaceholderProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  budgetAvailable?: number
  plannedCount?: number
}

export function PlannerSidebarPlaceholder({
  isCollapsed = false,
  onToggleCollapse,
  budgetAvailable = 0,
  plannedCount = 0,
}: PlannerSidebarPlaceholderProps) {
  if (isCollapsed) {
    return (
      <div className="w-12 bg-surface-200 rounded-2xl border border-surface-50/20 p-2 flex flex-col items-center gap-3">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          title="Espandi planner"
        >
          <span className="text-lg">📝</span>
        </button>

        {/* Quick stats */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-xs text-gray-500">Budget</div>
          <div className="text-sm font-bold text-green-400">{budgetAvailable}M</div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center mt-2">
          <div className="text-xs text-gray-500">Piano</div>
          <div className="text-sm font-bold text-blue-400">{plannedCount}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-surface-50/20 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>📝</span>
          Planner Clausole
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-lg bg-surface-300 hover:bg-surface-100 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            title="Comprimi planner"
          >
            <span className="text-xs">▶</span>
          </button>
        )}
      </div>

      {/* Budget Summary */}
      <div className="p-3 border-b border-surface-50/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Budget Disponibile</span>
          <span className="text-lg font-bold text-green-400">{budgetAvailable}M</span>
        </div>
        <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.min(100, (budgetAvailable / 100) * 100)}%` }}
          />
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
          <span className="text-3xl">🎯</span>
        </div>
        <h4 className="text-sm font-medium text-white mb-2">
          Planner Clausole
        </h4>
        <p className="text-xs text-gray-400 mb-4">
          Pianifica i tuoi acquisti per il prossimo Clause Day.
          Imposta offerte e priorità per gestire il budget.
        </p>
        <div className="text-xs text-gray-500 bg-surface-300/50 px-3 py-2 rounded-lg">
          🚧 In arrivo nello Sprint 3
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-3 border-t border-surface-50/20 bg-surface-300/30">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">Giocatori pianificati</div>
            <div className="text-lg font-bold text-blue-400">{plannedCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Totale offerte</div>
            <div className="text-lg font-bold text-orange-400">-</div>
          </div>
        </div>
      </div>

      {/* Future features teaser */}
      <div className="p-3 border-t border-surface-50/20 text-xs text-gray-500">
        <div className="flex items-center gap-2 mb-2">
          <span>✨</span>
          <span className="font-medium text-gray-400">Funzionalità in arrivo:</span>
        </div>
        <ul className="space-y-1 pl-6">
          <li className="list-disc">Drag & drop priorità</li>
          <li className="list-disc">Simulazione budget</li>
          <li className="list-disc">Alert budget superato</li>
        </ul>
      </div>
    </div>
  )
}

export default PlannerSidebarPlaceholder
