import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'

/**
 * I controlli di test esistono solo per le sessioni di prova: visibili in dev
 * (npm run dev / dev:local) o forzabili in build con VITE_TEST_CONTROLS=true.
 * In produzione il FAB sparisce per costruzione.
 */
export const TEST_CONTROLS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_TEST_CONTROLS === 'true'

interface AdminTestFabProps {
  isAdmin: boolean
  /** Contenuto del pannello test (specifico per sala asta / svincolati / …) */
  children: React.ReactNode
  /** Larghezza del pannello aperto (default 18rem) */
  panelClassName?: string
}

/**
 * Floating button per i Controlli Admin (TEST): il pannello non occupa spazio
 * nella maschera (l'admin vede la stessa sala dei manager) e si apre on demand
 * in overlay sopra il cockpit. Guscio generico — il contenuto arriva via children.
 */
export function AdminTestFab({ isAdmin, children, panelClassName = 'w-72' }: AdminTestFabProps) {
  const [open, setOpen] = useState(false)

  if (!isAdmin || !TEST_CONTROLS_ENABLED) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className={`${panelClassName} max-h-[70vh] overflow-y-auto rounded-xl shadow-card-hover`}>
          {children}
        </div>
      )}
      <button
        type="button"
        onClick={() => { setOpen(prev => !prev); }}
        aria-expanded={open}
        aria-label={open ? 'Chiudi controlli admin di test' : 'Apri controlli admin di test'}
        title="Controlli Admin (TEST) — solo ambiente di prova"
        className="flex items-center gap-1.5 rounded-full border border-warning-500/50 bg-surface-200 px-3.5 py-2.5 text-warning-400 shadow-lg shadow-black/40 hover:bg-warning-500/10 transition-colors min-h-[44px]"
      >
        {open ? <X size={16} aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
        <span className="font-mono text-[10.5px] font-bold tracking-[0.09em] uppercase">Test</span>
      </button>
    </div>
  )
}
