export function LandscapeHint() {
  return (
    <div className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-300/50 border border-surface-50/10 text-xs text-gray-400 mb-3">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Ruota il telefono per una visualizzazione migliore dei grafici</span>
    </div>
  )
}
