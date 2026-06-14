import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Table of contents items
const TOC_ITEMS = [
  { id: 'introduzione', label: 'Introduzione' },
  { id: 'primo-mercato', label: 'Primo Mercato Assoluto' },
  { id: 'mercato-ricorrente', label: 'Mercato Ricorrente', children: [
    { id: 'fase-scambi-pre', label: 'Fase Scambi Pre-Rinnovo' },
    { id: 'fase-premi', label: 'Fase Premi' },
    { id: 'fase-contratti', label: 'Fase Contratti' },
    { id: 'fase-rubata', label: 'Fase Rubata' },
    { id: 'fase-svincolati', label: 'Fase Svincolati' },
    { id: 'fase-scambi-post', label: 'Fase Scambi Post-Svincolati' },
  ]},
  { id: 'sistema-contratti', label: 'Sistema Contratti' },
  { id: 'glossario', label: 'Glossario' },
  { id: 'faq', label: 'FAQ' },
]

type Accent = 'primary' | 'gold' | 'secondary' | 'danger' | 'neutral'

// Semantic icon container for section headers (clean monogram/icon, no emoji)
const ICON_STYLES: Record<Accent, string> = {
  primary: 'bg-primary-500/[0.14] text-primary-300 border border-primary-500/30',
  gold: 'bg-accent-500/[0.14] text-accent-400 border border-accent-500/30',
  secondary: 'bg-secondary-500/[0.14] text-secondary-300 border border-secondary-500/30',
  danger: 'bg-danger-500/[0.14] text-danger-300 border border-danger-500/30',
  neutral: 'bg-surface-300 text-gray-300 border border-surface-50',
}

// Helper component for section headers
function SectionHeader({ id, title, accent, children }: { id: string; title: string; accent: Accent; children: React.ReactNode }) {
  return (
    <div id={id} className="flex items-center gap-3.5 mb-5 pb-3.5 border-b border-surface-50 scroll-mt-24">
      <span className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${ICON_STYLES[accent]}`}>
        {children}
      </span>
      <h2 className="font-display text-2xl md:text-[26px] font-bold text-white">{title}</h2>
    </div>
  )
}

// Helper component for subsection headers
function SubsectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className="font-display text-lg font-bold text-primary-300 mb-3.5 scroll-mt-24">
      {title}
    </h3>
  )
}

// Helper for examples (Card with primary accent)
function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-300 border border-primary-500/30 rounded-xl p-4 my-4">
      <div className="micro-label !text-primary-300 mb-2 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {title}
      </div>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  )
}

// Helper for info boxes (Card with semantic border)
function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-primary-500/[0.08] border-primary-500/30 text-primary-300',
    warning: 'bg-accent-500/[0.08] border-accent-500/30 text-accent-400',
    success: 'bg-secondary-500/[0.08] border-secondary-500/30 text-secondary-300',
  }
  return (
    <div className={`border rounded-xl p-4 my-4 text-sm leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  )
}

export function Rules() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const handleBack = () => {
    if (isAuthenticated) {
      void navigate('/dashboard')
    } else {
      void navigate('/login')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header (solid surface token, no glassmorphism) */}
      <header className="sticky top-0 z-40 bg-surface-200 border-b border-surface-50 shadow-card">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-[10px] border border-surface-50 bg-surface-300 text-gray-400 hover:text-white hover:bg-surface-100 flex items-center justify-center transition-all"
              aria-label="Torna indietro"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-800 to-primary-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-[17px] font-bold text-white">Fantacontratti</h1>
                <p className="text-xs text-gray-400">Regole del Gioco</p>
              </div>
            </div>
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => { void navigate('/login') }}
              className="px-4 py-2 text-sm font-semibold text-primary-300 border border-primary-500/35 bg-primary-500/10 hover:bg-primary-500/20 rounded-[9px] transition-all"
            >
              Accedi
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-9">
          {/* Table of Contents - Desktop sidebar */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <nav className="sticky top-24 bg-surface-200 rounded-2xl border border-surface-50 p-4">
              <span className="micro-label block mb-3.5">Indice</span>
              <ul className="space-y-0.5">
                {TOC_ITEMS.map(item => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-surface-300 rounded-[9px] transition-all"
                    >
                      {item.label}
                    </a>
                    {item.children && (
                      <ul className="ml-3 mt-1 space-y-px border-l border-surface-50 pl-2">
                        {item.children.map(child => (
                          <li key={child.id}>
                            <a
                              href={`#${child.id}`}
                              className="block px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-surface-300 rounded-md transition-all"
                            >
                              {child.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Hero */}
            <div className="bg-gradient-to-r from-primary-500/[0.16] to-accent-500/[0.12] rounded-2xl border border-primary-500/30 p-7 md:p-8 mb-11 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl flex-shrink-0 bg-gradient-to-br from-primary-800 to-primary-500 flex items-center justify-center font-display font-extrabold text-2xl text-white shadow-glow">
                FC
              </div>
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white leading-tight mb-2">
                  Regole di Fantacontratti
                </h1>
                <p className="text-base text-gray-300">
                  Guida completa al fantacalcio dinastico con sistema contratti
                </p>
              </div>
            </div>

            {/* Mobile TOC */}
            <details className="lg:hidden bg-surface-200 rounded-2xl border border-surface-50 p-4 mb-8">
              <summary className="micro-label cursor-pointer">
                Indice dei contenuti
              </summary>
              <ul className="mt-4 space-y-1">
                {TOC_ITEMS.map(item => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="block px-3 py-2 text-sm text-gray-300 hover:text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>

            {/* ========== INTRODUZIONE ========== */}
            <section className="mb-14">
              <SectionHeader id="introduzione" title="Introduzione" accent="primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </SectionHeader>

              <p className="text-gray-300 mb-4 leading-relaxed">
                <strong className="text-white">Fantacontratti</strong> è una piattaforma per il fantacalcio in formato <strong className="text-primary-300">dynasty</strong> (o dinastico).
                A differenza del fantacalcio tradizionale dove le rose vengono azzerate ogni anno, nel formato dynasty i giocatori
                vengono mantenuti attraverso un sistema di <strong className="text-primary-300">contratti</strong> con durata variabile.
              </p>

              <InfoBox type="info">
                <strong className="text-white">Caratteristiche principali:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Contratti a durata (1-4 semestri)</li>
                  <li>Clausola rescissoria calcolata automaticamente</li>
                  <li>Mercati strutturati con fasi definite</li>
                  <li>Aste in tempo reale</li>
                  <li>Sistema di premi e indennizzi</li>
                </ul>
              </InfoBox>

              <h3 className="font-display text-lg font-bold text-white mt-7 mb-3.5">Ruoli nella Lega</h3>
              <div className="grid md:grid-cols-2 gap-3.5">
                <div className="bg-surface-300 rounded-xl p-4 border border-surface-50 border-l-4 border-l-accent-500">
                  <h4 className="font-display font-bold text-accent-400 mb-1.5">Admin (Presidente)</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Gestisce la lega, controlla le fasi di mercato, assegna i premi e risolve eventuali dispute.
                  </p>
                </div>
                <div className="bg-surface-300 rounded-xl p-4 border border-surface-50 border-l-4 border-l-primary-500">
                  <h4 className="font-display font-bold text-primary-300 mb-1.5">Manager (DG)</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Gestisce la propria squadra, partecipa alle aste, propone scambi e rinnova i contratti.
                  </p>
                </div>
              </div>
            </section>

            {/* ========== PRIMO MERCATO ASSOLUTO ========== */}
            <section className="mb-14">
              <SectionHeader id="primo-mercato" title="Primo Mercato Assoluto" accent="gold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </SectionHeader>

              <InfoBox type="success">
                Il <strong className="text-white">Primo Mercato</strong> è l'asta iniziale per formare le rose. Si svolge <strong className="text-white">una sola volta</strong> quando la lega viene avviata.
                Tutti i manager partono con lo stesso budget e rose vuote.
              </InfoBox>

              <h3 className="font-display text-lg font-bold text-primary-300 mt-7 mb-3.5">Come funziona</h3>
              <ol className="list-decimal ml-5 space-y-3 text-gray-300 text-sm leading-relaxed">
                <li><strong className="text-white">L'Admin imposta l'ordine dei turni</strong> — Definisce la sequenza in cui i manager nominano i giocatori</li>
                <li><strong className="text-white">L'Admin seleziona il ruolo</strong> — Si parte con i Portieri (P), poi Difensori (D), Centrocampisti (C) e infine Attaccanti (A)</li>
                <li><strong className="text-white">Il manager di turno nomina un giocatore</strong> — Sceglie un giocatore disponibile del ruolo selezionato</li>
                <li><strong className="text-white">Tutti confermano "SONO PRONTO"</strong> — Ready check prima dell'asta</li>
                <li><strong className="text-white">Parte l'asta a tempo</strong> — I manager rilanciano (minimo +1), il timer si resetta ad ogni offerta</li>
                <li><strong className="text-white">Alla scadenza del timer</strong> — L'Admin chiude l'asta e il vincitore paga il prezzo</li>
                <li><strong className="text-white">Il vincitore assegna il contratto</strong> — Sceglie ingaggio e durata (vedi sezione Contratti)</li>
                <li><strong className="text-white">Conferme e profezie</strong> — I manager confermano e possono lasciare commenti</li>
              </ol>

              <Example title="Esempio di asta">
                <p>Mario nomina Vlahovic. L'asta parte da 1 credito.</p>
                <p className="mt-1.5">Luigi offre 10, Peach offre 15, Mario rilancia a 20.</p>
                <p className="mt-1.5">Il timer scade, Mario vince Vlahovic per 20 crediti e gli assegna un contratto 20x3 (ingaggio 20, durata 3 semestri).</p>
              </Example>

              <h3 className="font-display text-lg font-bold text-primary-300 mt-7 mb-3.5">Vincoli Rosa</h3>
              <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                La composizione della rosa è vincolata per ruolo. I parametri standard sono:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Portieri', slots: 3, box: 'bg-accent-500/10 border-accent-500/30', num: 'text-accent-400' },
                  { name: 'Difensori', slots: 8, box: 'bg-primary-500/10 border-primary-500/30', num: 'text-primary-300' },
                  { name: 'Centrocampisti', slots: 8, box: 'bg-secondary-500/10 border-secondary-500/30', num: 'text-secondary-300' },
                  { name: 'Attaccanti', slots: 6, box: 'bg-danger-500/10 border-danger-500/30', num: 'text-danger-300' },
                ].map(r => (
                  <div key={r.name} className={`rounded-xl p-4 text-center border ${r.box}`}>
                    <div className={`stat-number text-3xl leading-none ${r.num}`}>{r.slots}</div>
                    <div className="text-xs text-gray-400 mt-1.5">{r.name}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ========== MERCATO RICORRENTE ========== */}
            <section className="mb-14">
              <SectionHeader id="mercato-ricorrente" title="Mercato Ricorrente" accent="secondary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </SectionHeader>

              <p className="text-gray-300 mb-5 text-sm leading-relaxed">
                Dopo il Primo Mercato, la lega entra nel ciclo dei <strong className="text-white">mercati ricorrenti</strong> (semestrali).
                Ogni sessione di mercato ricorrente segue un ordine preciso di fasi.
              </p>

              <div className="bg-surface-300 rounded-2xl border border-surface-50 p-5 mb-7">
                <span className="micro-label">Sequenza delle Fasi</span>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {[
                    { name: 'Scambi Pre', chip: 'bg-primary-500/[0.16] text-primary-300' },
                    { name: 'Premi', chip: 'bg-accent-500/[0.16] text-accent-400' },
                    { name: 'Contratti', chip: 'bg-secondary-500/[0.16] text-secondary-300' },
                    { name: 'Rubata', chip: 'bg-danger-500/[0.16] text-danger-300' },
                    { name: 'Svincolati', chip: 'bg-accent-500/20 text-accent-400' },
                    { name: 'Scambi Post', chip: 'bg-primary-500/[0.16] text-primary-300' },
                  ].map((phase, i) => (
                    <span key={phase.name} className="flex items-center gap-2">
                      <span className={`font-display text-[13px] font-semibold rounded-full px-3.5 py-1.5 ${phase.chip}`}>
                        {phase.name}
                      </span>
                      {i < 5 && <span className="text-gray-500 text-[13px]">→</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fase Scambi Pre */}
              <div className="mb-9 pl-[18px] border-l-4 border-primary-500">
                <SubsectionHeader id="fase-scambi-pre" title="1. Fase Scambi Pre-Rinnovo" />
                <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                  Prima fase del mercato ricorrente. I manager possono proporre e concludere scambi tra loro.
                </p>
                <ul className="list-disc ml-5 space-y-1.5 text-gray-300 text-sm leading-relaxed">
                  <li>Puoi proporre scambi di giocatori + budget</li>
                  <li>Il destinatario può accettare, rifiutare o controproporre</li>
                  <li>Le offerte scadono dopo 24 ore se non gestite</li>
                  <li>Vincolo anti-ritroso: un giocatore scambiato non può tornare allo stesso manager nella stessa sessione</li>
                </ul>
                <Example title="Esempio di scambio">
                  <p>Mario propone a Luigi: Vlahovic + 10M per Osimhen + 5M</p>
                  <p className="mt-1.5">Luigi accetta. I giocatori e il budget vengono trasferiti automaticamente.</p>
                </Example>
              </div>

              {/* Fase Premi */}
              <div className="mb-9 pl-[18px] border-l-4 border-warning-500">
                <h3 id="fase-premi" className="font-display text-lg font-bold text-accent-400 mb-3.5 scroll-mt-24">2. Fase Premi</h3>
                <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                  L'Admin assegna i premi in base ai risultati della stagione.
                </p>
                <h4 className="font-display text-white font-bold mb-2.5">Tipologie di premio:</h4>
                <ul className="list-disc ml-5 space-y-1.5 text-gray-300 text-sm leading-relaxed mb-3.5">
                  <li><strong className="text-white">Re-incremento base</strong> — Importo fisso uguale per tutti</li>
                  <li><strong className="text-white">Premi categoria</strong> — Es. "Miglior difesa", "Capocannoniere", ecc.</li>
                  <li><strong className="text-white">Indennizzo partenza</strong> — Automatico per giocatori usciti dalla Serie A</li>
                </ul>
                <Example title="Esempio di premi">
                  <p>Re-incremento base: +50M a tutti</p>
                  <p className="mt-1.5">1° classificato: +30M, 2° classificato: +20M, 3° classificato: +10M</p>
                </Example>
              </div>

              {/* Fase Contratti */}
              <div className="mb-9 pl-[18px] border-l-4 border-secondary-500">
                <h3 id="fase-contratti" className="font-display text-lg font-bold text-secondary-300 mb-3.5 scroll-mt-24">3. Fase Contratti (Rinnovi)</h3>
                <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                  I manager decidono il futuro dei propri giocatori: rinnovare, tagliare o lasciar scadere.
                </p>

                <InfoBox type="warning">
                  <strong className="text-white">Importante:</strong> All'inizio di ogni mercato ricorrente, tutti i contratti perdono automaticamente 1 semestre di durata.
                </InfoBox>

                <h4 className="font-display text-white font-bold mt-6 mb-3">Opzioni disponibili:</h4>

                <div className="space-y-3">
                  <div className="bg-secondary-500/[0.08] border border-secondary-500/30 rounded-xl p-4">
                    <h5 className="font-display font-bold text-secondary-300 mb-2">Rinnovo Standard</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300 leading-relaxed">
                      <li>Puoi aumentare o mantenere l'ingaggio</li>
                      <li>Puoi aumentare o mantenere la durata (max 4 semestri)</li>
                      <li>La clausola viene ricalcolata automaticamente</li>
                    </ul>
                  </div>

                  <div className="bg-accent-500/[0.08] border border-accent-500/30 rounded-xl p-4">
                    <h5 className="font-display font-bold text-accent-400 mb-2">Spalma (solo contratti 1 semestre)</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300 leading-relaxed">
                      <li>Permette di diminuire l'ingaggio allungando la durata</li>
                      <li><strong className="text-white">Regola:</strong> Nuovo Ingaggio × Nuova Durata ≥ Ingaggio Iniziale</li>
                      <li>Esempio: 10M×1s → 5M×2s (5×2=10 ≥ 10) ✓</li>
                    </ul>
                  </div>

                  <div className="bg-danger-500/[0.08] border border-danger-500/30 rounded-xl p-4">
                    <h5 className="font-display font-bold text-danger-300 mb-2">Taglia (Rilascio)</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300 leading-relaxed">
                      <li>Puoi liberare un giocatore pagando una penale</li>
                      <li><strong className="text-white">Costo taglio:</strong> (Ingaggio × Durata residua) / 2</li>
                      <li>Esempio: 8M×2s → costo = (8×2)/2 = 8M</li>
                      <li>Il giocatore va agli svincolati</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Fase Rubata */}
              <div className="mb-9 pl-[18px] border-l-4 border-danger-500">
                <h3 id="fase-rubata" className="font-display text-lg font-bold text-danger-300 mb-3.5 scroll-mt-24">4. Fase Rubata</h3>
                <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                  La fase più caratteristica di Fantacontratti! I manager possono "rubare" giocatori agli avversari pagando la clausola rescissoria.
                </p>

                <h4 className="font-display text-white font-bold mb-3">Come funziona:</h4>
                <ol className="list-decimal ml-5 space-y-1.5 text-gray-300 text-sm leading-relaxed mb-5">
                  <li>L'Admin imposta l'ordine della rubata (tipicamente basato sulla classifica)</li>
                  <li>Per ogni manager, i giocatori sono ordinati per clausola (dalla più alta)</li>
                  <li>Per ogni giocatore nel tabellone, parte un'asta</li>
                  <li>Chiunque (tranne il proprietario) può fare un'offerta</li>
                  <li>Il prezzo base è: <strong className="text-danger-300">Clausola + Ingaggio</strong></li>
                  <li>Se c'è un vincitore, il giocatore viene trasferito</li>
                  <li>Il cedente incassa il prezzo di vendita</li>
                </ol>

                <InfoBox type="warning">
                  <strong className="text-white">Il proprietario NON può rifiutare!</strong> La rubata è un meccanismo forzato per favorire il riequilibrio competitivo.
                </InfoBox>

                <Example title="Esempio di rubata">
                  <p>Vlahovic ha clausola 220M e ingaggio 20M. Prezzo base asta: 240M.</p>
                  <p className="mt-1.5">Luigi offre 240M, Peach rilancia a 250M. Nessun altro rilancio.</p>
                  <p className="mt-1.5">Peach vince Vlahovic per 250M. Mario (cedente) incassa 250M.</p>
                </Example>
              </div>

              {/* Fase Svincolati */}
              <div className="mb-9 pl-[18px] border-l-4 border-accent-500">
                <h3 id="fase-svincolati" className="font-display text-lg font-bold text-accent-400 mb-3.5 scroll-mt-24">5. Fase Svincolati</h3>
                <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                  Asta a turni per acquistare giocatori liberi: quelli tagliati, con contratto scaduto, o mai acquisiti.
                </p>

                <h4 className="font-display text-white font-bold mb-3">Come funziona:</h4>
                <ol className="list-decimal ml-5 space-y-1.5 text-gray-300 text-sm leading-relaxed mb-3.5">
                  <li>L'Admin imposta l'ordine dei turni</li>
                  <li>Il manager di turno può:
                    <ul className="list-disc ml-5 mt-1">
                      <li><strong className="text-white">Nominare</strong> uno svincolato → parte l'asta</li>
                      <li><strong className="text-white">Passare</strong> il turno (può tornare dopo)</li>
                      <li><strong className="text-white">Dichiarare "Ho finito"</strong> (esce dalla rotazione)</li>
                    </ul>
                  </li>
                  <li>Il vincitore dell'asta deve assegnare un contratto</li>
                  <li>La fase termina quando tutti hanno finito o passato</li>
                </ol>

                <Example title="Esempio">
                  <p>Mario nomina Retegui (quotazione 15M). L'asta parte da 15M.</p>
                  <p className="mt-1.5">Mario vince per 18M e gli assegna un contratto 18×2.</p>
                </Example>
              </div>

              {/* Fase Scambi Post */}
              <div className="pl-[18px] border-l-4 border-primary-500">
                <SubsectionHeader id="fase-scambi-post" title="6. Fase Scambi Post-Svincolati" />
                <p className="text-gray-300 text-sm leading-relaxed">
                  Ultima fase del mercato ricorrente. Funziona esattamente come la fase Scambi Pre-Rinnovo.
                  È l'ultima occasione per completare trattative prima della chiusura del mercato.
                </p>
              </div>
            </section>

            {/* ========== SISTEMA CONTRATTI ========== */}
            <section className="mb-14">
              <SectionHeader id="sistema-contratti" title="Sistema Contratti" accent="neutral">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </SectionHeader>

              <p className="text-gray-300 mb-5 text-sm leading-relaxed">
                Il cuore di Fantacontratti è il sistema di contratti. Ogni giocatore ha un contratto con parametri specifici.
              </p>

              <h3 className="font-display text-lg font-bold text-primary-300 mb-3.5">Parametri del Contratto</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-50">
                      <th className="text-left py-3 px-3.5 micro-label">Parametro</th>
                      <th className="text-left py-3 px-3.5 micro-label">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-surface-50/50">
                      <td className="py-3 px-3.5 font-bold text-white">Ingaggio</td>
                      <td className="py-3 px-3.5">Costo semestrale del giocatore (minimo = prezzo d'acquisto)</td>
                    </tr>
                    <tr className="border-b border-surface-50/50">
                      <td className="py-3 px-3.5 font-bold text-white">Durata</td>
                      <td className="py-3 px-3.5">Semestri rimanenti (da 1 a 4)</td>
                    </tr>
                    <tr className="border-b border-surface-50/50">
                      <td className="py-3 px-3.5 font-bold text-white">Clausola</td>
                      <td className="py-3 px-3.5">Prezzo minimo per la rubata = Ingaggio × Moltiplicatore</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="font-display text-lg font-bold text-primary-300 mt-7 mb-3.5">Moltiplicatori Clausola</h3>
              <p className="text-gray-300 mb-3.5 text-sm leading-relaxed">
                La clausola rescissoria viene calcolata automaticamente in base alla durata:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { duration: 4, multiplier: 11 },
                  { duration: 3, multiplier: 9 },
                  { duration: 2, multiplier: 7 },
                  { duration: 1, multiplier: 4 },
                ].map(({ duration, multiplier }) => (
                  <div key={duration} className="bg-surface-300 border border-surface-50 rounded-xl p-4 text-center">
                    <div className="stat-number text-3xl leading-none text-primary-300">×{multiplier}</div>
                    <div className="text-xs text-gray-400 mt-1.5">{duration} semestri</div>
                  </div>
                ))}
              </div>

              <Example title="Calcolo clausola">
                <p>Giocatore con ingaggio 20M e durata 3 semestri:</p>
                <p className="mt-1.5 font-mono text-primary-300">Clausola = 20 × 9 = 180M</p>
                <p className="mt-1.5">Prezzo base per la rubata: 180M + 20M = <strong className="text-white">200M</strong></p>
              </Example>

              <h3 className="font-display text-lg font-bold text-primary-300 mt-7 mb-3.5">Strategia Contratti</h3>
              <div className="grid md:grid-cols-2 gap-3.5">
                <div className="bg-surface-300 rounded-xl p-4 border border-surface-50 border-l-4 border-l-secondary-500">
                  <h4 className="font-display font-bold text-secondary-300 mb-1.5">Contratti lunghi (3-4s)</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Clausola alta = difficile rubare. Ideale per i top player che vuoi proteggere.
                  </p>
                </div>
                <div className="bg-surface-300 rounded-xl p-4 border border-surface-50 border-l-4 border-l-warning-500">
                  <h4 className="font-display font-bold text-accent-400 mb-1.5">Contratti corti (1-2s)</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Clausola bassa = più flessibilità. Ideale per giocatori che potresti voler vendere.
                  </p>
                </div>
              </div>
            </section>

            {/* ========== GLOSSARIO ========== */}
            <section className="mb-14">
              <SectionHeader id="glossario" title="Glossario" accent="primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </SectionHeader>

              <dl>
                {[
                  { term: 'DG', def: 'Direttore Generale — il manager di una squadra' },
                  { term: 'Rosa', def: 'Insieme di giocatori posseduti da un manager' },
                  { term: 'Slot', def: 'Posizione disponibile in rosa per un determinato ruolo' },
                  { term: 'Clausola', def: 'Clausola rescissoria — importo minimo per rubare un giocatore' },
                  { term: 'Rubata', def: 'Fase di mercato dove si possono acquistare giocatori avversari' },
                  { term: 'Svincolato', def: 'Giocatore senza contratto, libero di essere acquisito' },
                  { term: 'Spalma', def: 'Tecnica per ridurre l\'ingaggio allungando la durata' },
                  { term: 'Taglia', def: 'Rilasciare un giocatore pagando una penale' },
                  { term: 'Consolidamento', def: 'Conferma definitiva delle modifiche ai contratti' },
                  { term: 'Nomination', def: 'Proposta di un giocatore per l\'asta' },
                  { term: 'Ready Check', def: 'Verifica che tutti i manager siano pronti prima dell\'asta' },
                  { term: 'Profezia', def: 'Commento/previsione lasciato dopo un acquisto' },
                  { term: 'Indennizzo', def: 'Compensazione per giocatori usciti dalla Serie A' },
                ].map(({ term, def }) => (
                  <div key={term} className="flex gap-4 py-3 border-b border-surface-50/50">
                    <dt className="w-32 flex-shrink-0 font-display font-bold text-primary-300 text-sm">{term}</dt>
                    <dd className="text-sm text-gray-300 leading-relaxed">{def}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* ========== FAQ ========== */}
            <section className="mb-14">
              <SectionHeader id="faq" title="FAQ" accent="neutral">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </SectionHeader>

              <div className="space-y-3">
                {[
                  {
                    q: 'Posso rifiutare un\'offerta durante la rubata?',
                    a: 'No. La rubata è un meccanismo forzato. Se qualcuno paga il prezzo richiesto (clausola + ingaggio), il giocatore viene trasferito automaticamente.'
                  },
                  {
                    q: 'Cosa succede se un giocatore lascia la Serie A?',
                    a: 'Il giocatore viene rimosso dalla rosa e il manager riceve un indennizzo automatico calcolato in base al contratto residuo.'
                  },
                  {
                    q: 'Posso avere più giocatori dello stesso ruolo del limite massimo?',
                    a: 'No. Ogni ruolo ha un numero massimo di slot. Non puoi acquistare giocatori se hai già raggiunto il limite per quel ruolo.'
                  },
                  {
                    q: 'Come funziona lo spalma?',
                    a: 'Lo spalma è disponibile solo per contratti di 1 semestre. Puoi ridurre l\'ingaggio allungando la durata, purché il prodotto (nuovo ingaggio × nuova durata) sia maggiore o uguale all\'ingaggio iniziale.'
                  },
                  {
                    q: 'Quanto costa tagliare un giocatore?',
                    a: 'Il costo del taglio è pari alla metà del valore contrattuale residuo: (Ingaggio × Durata residua) / 2.'
                  },
                  {
                    q: 'Posso scambiare un giocatore appena ricevuto in scambio?',
                    a: 'Non nella stessa sessione di mercato con lo stesso manager (vincolo anti-ritroso). Puoi però scambiarlo con altri manager.'
                  },
                ].map(({ q, a }, i) => (
                  <details key={i} className="bg-surface-300 border border-surface-50 rounded-xl overflow-hidden group">
                    <summary className="px-[18px] py-3.5 cursor-pointer font-display font-semibold text-white hover:bg-surface-100 transition-colors flex items-center justify-between gap-3">
                      {q}
                      <svg className="w-[18px] h-[18px] text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-[18px] py-3.5 border-t border-surface-50 text-sm text-gray-300 leading-relaxed">
                      {a}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* Footer CTA */}
            <div className="bg-gradient-to-r from-primary-500/[0.18] to-accent-500/[0.12] rounded-2xl border border-primary-500/30 p-8 text-center">
              <h2 className="font-display text-2xl font-extrabold text-white mb-2.5">Pronto a giocare?</h2>
              <p className="text-gray-300 mb-5">
                {isAuthenticated
                  ? 'Torna alla dashboard per gestire le tue leghe.'
                  : 'Registrati ora e inizia la tua avventura nel fantacalcio dinastico!'}
              </p>
              <button
                onClick={handleBack}
                className="font-display px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors shadow-glow"
              >
                {isAuthenticated ? 'Vai alla Dashboard' : 'Accedi o Registrati'}
              </button>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-surface-50 mt-12 py-7">
        <p className="text-center text-xs text-gray-500">
          © 2024 Fantacontratti. Tutti i diritti riservati.
        </p>
      </footer>
    </div>
  )
}

export default Rules
