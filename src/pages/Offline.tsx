/**
 * MOB-013: Offline fallback page
 * Shown when the user has no network connectivity
 */
export default function Offline() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-surface-300 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">📡</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Sei offline</h1>
        <p className="text-gray-400 mb-6">
          Non è possibile raggiungere il server. Controlla la tua connessione internet e riprova.
        </p>
        <button
          onClick={handleRetry}
          className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors min-h-[44px]"
        >
          Riprova
        </button>
        <p className="text-xs text-gray-500 mt-4">
          I dati già caricati potrebbero essere disponibili nella cache del browser.
        </p>
      </div>
    </div>
  )
}
