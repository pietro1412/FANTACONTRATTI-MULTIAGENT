export interface CockpitShellProps {
  /** Testata sempre visibile (StatusBar asta / RubataStateBar) */
  header: React.ReactNode
  /** Riga admin/rail sempre visibile sotto la testata (opzionale) */
  adminBar?: React.ReactNode
  /** Main: prende lo spazio rimanente; lo scroll vive DENTRO i pannelli (.panel-scroll) */
  children: React.ReactNode
  className?: string
}

/**
 * Layout cockpit a viewport bloccata (mockup 05/cockpit.html):
 * griglia [testata][admin-bar][main 1fr] senza scroll di pagina su desktop —
 * testata, admin e arena sempre visibili, scroll solo interno ai pannelli
 * lunghi. Sotto lg il layout torna a flusso normale (mobile invariato).
 *
 * La pagina ospitante deve bloccare il viewport su desktop:
 * `<div className="min-h-screen lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">`
 * con la Navigation come primo figlio e CockpitShell come secondo.
 */
export function CockpitShell({ header, adminBar, children, className = '' }: CockpitShellProps) {
  return (
    <div className={`lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden ${className}`}>
      <div className="lg:flex-shrink-0">{header}</div>
      {adminBar && <div className="lg:flex-shrink-0">{adminBar}</div>}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">{children}</div>
    </div>
  )
}
