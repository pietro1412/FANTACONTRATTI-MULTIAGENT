import { type BudgetAnalysis } from '../services/api'

interface SimulatoreBudgetProps {
  budget: BudgetAnalysis
}

export function SimulatoreBudget({ budget }: SimulatoreBudgetProps) {
  // Calculate percentages for progress bars
  const totalSlotsPercent = (budget.totalSlots.used / budget.totalSlots.max) * 100
  const positionPercents = {
    P: (budget.slotsByPosition.P.used / budget.slotsByPosition.P.max) * 100,
    D: (budget.slotsByPosition.D.used / budget.slotsByPosition.D.max) * 100,
    C: (budget.slotsByPosition.C.used / budget.slotsByPosition.C.max) * 100,
    A: (budget.slotsByPosition.A.used / budget.slotsByPosition.A.max) * 100,
  }

  const positionColors = {
    P: '#f59e0b', // amber
    D: '#22c55e', // green
    C: '#3b82f6', // blue
    A: '#ef4444', // red
  }

  const positionLabels = {
    P: 'Portieri',
    D: 'Difensori',
    C: 'Centrocampisti',
    A: 'Attaccanti',
  }

  // Check if there are draft renewals that will impact budget
  const hasDraftImpact = budget.draftRenewalsImpact > 0

  // Check if budget will be negative after consolidation
  const willBeOverBudget = budget.projectedBudget < 0

  return (
    <div className="space-y-6">
      {/* Main Budget Card */}
      <div className="bg-dark-200 rounded-xl p-6 border border-dark-100">
        <h3 className="text-lg font-bold text-white mb-4">Situazione Budget</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Current Budget */}
          <div className="bg-dark-300 rounded-lg p-4">
            <p className="text-sm text-dark-100 mb-1">Budget Attuale</p>
            <p className="text-2xl font-bold text-white">{budget.currentBudget}</p>
          </div>

          {/* Total Salary */}
          <div className="bg-dark-300 rounded-lg p-4">
            <p className="text-sm text-dark-100 mb-1">Monte Ingaggi</p>
            <p className="text-2xl font-bold text-yellow-400">{budget.totalSalary}</p>
          </div>

          {/* Draft Impact */}
          <div className="bg-dark-300 rounded-lg p-4">
            <p className="text-sm text-dark-100 mb-1">Impatto Rinnovi</p>
            <p className={`text-2xl font-bold ${hasDraftImpact ? 'text-orange-400' : 'text-dark-100'}`}>
              {hasDraftImpact ? `-${budget.draftRenewalsImpact}` : '0'}
            </p>
          </div>

          {/* Projected Budget */}
          <div className="bg-dark-300 rounded-lg p-4">
            <p className="text-sm text-dark-100 mb-1">Budget Proiettato</p>
            <p className={`text-2xl font-bold ${willBeOverBudget ? 'text-red-500' : 'text-green-400'}`}>
              {budget.projectedBudget}
            </p>
          </div>
        </div>

        {/* Warning if over budget */}
        {willBeOverBudget && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400">
              <span className="text-lg">{'\u26A0'}</span>
              <span className="font-medium">Attenzione: Budget insufficiente</span>
            </div>
            <p className="text-sm text-red-300 mt-1">
              Con i rinnovi pianificati, il budget diventa negativo. Considera di cedere alcuni giocatori o ridurre i rinnovi.
            </p>
          </div>
        )}

        {/* Info about draft renewals */}
        {hasDraftImpact && !willBeOverBudget && (
          <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-orange-400">
              <span className="text-lg">{'\u2139'}</span>
              <span className="font-medium">Rinnovi in bozza</span>
            </div>
            <p className="text-sm text-orange-300 mt-1">
              Hai rinnovi salvati che impattano sul budget per {budget.draftRenewalsImpact} crediti.
            </p>
          </div>
        )}
      </div>

      {/* Slots by Position */}
      <div className="bg-dark-200 rounded-xl p-6 border border-dark-100">
        <h3 className="text-lg font-bold text-white mb-4">Slot Rosa</h3>

        {/* Total slots */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-dark-100">Totale</span>
            <span className="text-white font-medium">
              {budget.totalSlots.used} / {budget.totalSlots.max}
            </span>
          </div>
          <div className="h-3 bg-dark-300 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalSlotsPercent >= 100 ? 'bg-red-500' : 'bg-primary-500'}`}
              style={{ width: `${Math.min(totalSlotsPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Position breakdown */}
        <div className="space-y-4">
          {(['P', 'D', 'C', 'A'] as const).map((pos) => {
            const slots = budget.slotsByPosition[pos]
            const percent = positionPercents[pos]
            const isFull = slots.used >= slots.max

            return (
              <div key={pos}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: positionColors[pos] }}
                    >
                      {pos}
                    </span>
                    <span className="text-dark-100">{positionLabels[pos]}</span>
                  </div>
                  <span className={`font-medium ${isFull ? 'text-green-400' : 'text-white'}`}>
                    {slots.used} / {slots.max}
                    {isFull && <span className="ml-2 text-xs">{'\u2713'}</span>}
                  </span>
                </div>
                <div className="h-2 bg-dark-300 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: positionColors[pos],
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Available for Purchase */}
      <div className="bg-dark-200 rounded-xl p-6 border border-dark-100">
        <h3 className="text-lg font-bold text-white mb-4">Disponibilita per Acquisti</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-dark-100 mb-1">Budget utilizzabile</p>
            <p className="text-sm text-dark-100/70">
              Considerando i rinnovi pianificati
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${budget.availableForPurchase < 0 ? 'text-red-500' : 'text-primary-400'}`}>
              {budget.availableForPurchase}
            </p>
            <p className="text-xs text-dark-100">crediti</p>
          </div>
        </div>

        {/* Slot availability summary */}
        <div className="mt-4 pt-4 border-t border-dark-100">
          <p className="text-sm text-dark-100 mb-2">Slot liberi per ruolo:</p>
          <div className="flex gap-3">
            {(['P', 'D', 'C', 'A'] as const).map((pos) => {
              const free = budget.slotsByPosition[pos].max - budget.slotsByPosition[pos].used
              return (
                <div
                  key={pos}
                  className="flex items-center gap-1.5 bg-dark-300 rounded-lg px-3 py-1.5"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: positionColors[pos] }}
                  >
                    {pos}
                  </span>
                  <span className={`font-medium ${free === 0 ? 'text-dark-100' : 'text-white'}`}>
                    {free}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
