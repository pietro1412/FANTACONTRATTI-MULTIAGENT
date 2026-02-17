interface DealMobileFooterProps {
  offeredCount: number
  requestedCount: number
  isSubmitting: boolean
  onSubmit: () => void
  canSubmit: boolean
  hasSelections: boolean
}

export function DealMobileFooter({
  offeredCount,
  requestedCount,
  isSubmitting,
  onSubmit,
  canSubmit,
  hasSelections,
}: DealMobileFooterProps) {
  if (!hasSelections) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-3 shadow-2xl">
        {/* Impact row */}
        <div className="flex items-center justify-center gap-4 mb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="text-danger-400 font-medium">Cedi {offeredCount}</span>
          </div>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="text-primary-400 font-medium">Ottieni {requestedCount}</span>
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full py-3 rounded-xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Invio in corso...
            </span>
          ) : (
            'Invia Offerta'
          )}
        </button>
      </div>
    </div>
  )
}
