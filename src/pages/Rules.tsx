import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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

// Helper component for section headers
function SectionHeader({ id, title, icon }: { id: string; title: string; icon: string }) {
  return (
    <h2 id={id} className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3 scroll-mt-20">
      <span className="text-3xl">{icon}</span>
      {title}
    </h2>
  )
}

// Helper component for subsection headers
function SubsectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className="text-xl font-semibold text-primary-300 mb-4 scroll-mt-20">
      {title}
    </h3>
  )
}

// Helper for examples
function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-300/50 border border-primary-500/30 rounded-lg p-4 my-4">
      <div className="text-sm font-semibold text-primary-400 mb-2 flex items-center gap-2">
        <span>💡</span> {title}
      </div>
      <div className="text-gray-300 text-sm">{children}</div>
    </div>
  )
}

// Helper for info boxes
function InfoBox({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-primary-500/10 border-primary-500/30 text-primary-300',
    warning: 'bg-warning-500/10 border-warning-500/30 text-warning-300',
    success: 'bg-secondary-500/10 border-secondary-500/30 text-secondary-300',
  }
  return (
    <div className={`border rounded-lg p-4 my-4 ${styles[type]}`}>
      {children}
    </div>
  )
}

export function Rules() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const handleBack = () => {
    if (isAuthenticated) {
      navigate('/dashboard')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-200/95 backdrop-blur-sm border-b border-surface-50/20 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 text-gray-400 hover:text-white hover:bg-surface-300/50 rounded-lg transition-all"
              aria-label="Torna indietro"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
                <span className="text-xl">⚽</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Fantacontratti</h1>
                <p className="text-xs text-gray-400">Regole del Gioco</p>
              </div>
            </div>
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-primary-400 hover:text-white hover:bg-primary-500/20 rounded-lg transition-all"
            >
              Accedi
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Table of Contents - Desktop sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="sticky top-24 bg-surface-200/50 rounded-xl border border-surface-50/20 p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Indice</h2>
              <ul className="space-y-1">
                {TOC_ITEMS.map(item => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-surface-300/50 rounded-lg transition-all"
                    >
                      {item.label}
                    </a>
                    {item.children && (
                      <ul className="ml-4 mt-1 space-y-1">
                        {item.children.map(child => (
                          <li key={child.id}>
                            <a
                              href={`#${child.id}`}
                              className="block px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-surface-300/30 rounded-lg transition-all"
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
            <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-2xl border border-primary-500/30 p-8 mb-12">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Regole di Fantacontratti
              </h1>
              <p className="text-lg text-gray-300">
                Guida completa al fantacalcio dinastico con sistema contratti
              </p>
            </div>

            {/* Mobile TOC */}
            <details className="lg:hidden bg-surface-200/50 rounded-xl border border-surface-50/20 p-4 mb-8">
              <summary className="text-sm font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                Indice dei contenuti
              </summary>
              <ul className="mt-4 space-y-2">
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
            <section className="mb-16">
              <SectionHeader id="introduzione" title="Introduzione" icon="📖" />

              <p className="text-gray-300 mb-4">
                <strong className="text-white">Fantacontratti</strong> è una piattaforma per il fantacalcio in formato <strong className="text-primary-300">dynasty</strong> (o dinastico).
                A differenza del fantacalcio tradizionale dove le rose vengono azzerate ogni anno, nel formato dynasty i giocatori
                vengono mantenuti attraverso un sistema di <strong className="text-primary-300">contratti</strong> con durata variabile.
              </p>

              <InfoBox type="info">
                <strong>Caratteristiche principali:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Contratti a durata (1-4 semestri)</li>
                  <li>Clausola rescissoria calcolata automaticamente</li>
                  <li>Mercati strutturati con fasi definite</li>
                  <li>Aste in tempo reale</li>
                  <li>Sistema di premi e indennizzi</li>
                </ul>
              </InfoBox>

              <h3 className="text-lg font-semibold text-white mt-8 mb-4">Ruoli nella Lega</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface-300/30 rounded-lg p-4 border-l-4 border-accent-500">
                  <h4 className="font-semibold text-accent-400 mb-2">Admin (Presidente)</h4>
                  <p className="text-sm text-gray-400">
                    Gestisce la lega, controlla le fasi di mercato, assegna i premi e risolve eventuali dispute.
                  </p>
                </div>
                <div className="bg-surface-300/30 rounded-lg p-4 border-l-4 border-primary-500">
                  <h4 className="font-semibold text-primary-400 mb-2">Manager (DG)</h4>
                  <p className="text-sm text-gray-400">
                    Gestisce la propria squadra, partecipa alle aste, propone scambi e rinnova i contratti.
                  </p>
                </div>
              </div>
            </section>

            {/* ========== PRIMO MERCATO ASSOLUTO ========== */}
            <section className="mb-16">
              <SectionHeader id="primo-mercato" title="Primo Mercato Assoluto" icon="🏆" />

              <InfoBox type="success">
                Il <strong>Primo Mercato</strong> è l'asta iniziale per formare le rose. Si svolge <strong>una sola volta</strong> quando la lega viene avviata.
                Tutti i manager partono con lo stesso budget e rose vuote.
              </InfoBox>

              <h3 className="text-lg font-semibold text-white mt-8 mb-4">Come funziona</h3>
              <ol className="list-decimal ml-5 space-y-3 text-gray-300">
                <li><strong className="text-white">L'Admin imposta l'ordine dei turni</strong> - Definisce la sequenza in cui i manager nominano i giocatori</li>
                <li><strong className="text-white">L'Admin seleziona il ruolo</strong> - Si parte con i Portieri (P), poi Difensori (D), Centrocampisti (C) e infine Attaccanti (A)</li>
                <li><strong className="text-white">Il manager di turno nomina un giocatore</strong> - Sceglie un giocatore disponibile del ruolo selezionato</li>
                <li><strong className="text-white">Tutti confermano "SONO PRONTO"</strong> - Ready check prima dell'asta</li>
                <li><strong className="text-white">Parte l'asta a tempo</strong> - I manager rilanciano (minimo +1), il timer si resetta ad ogni offerta</li>
                <li><strong className="text-white">Alla scadenza del timer</strong> - L'Admin chiude l'asta e il vincitore paga il prezzo</li>
                <li><strong className="text-white">Il vincitore assegna il contratto</strong> - Sceglie ingaggio e durata (vedi sezione Contratti)</li>
                <li><strong className="text-white">Conferme e profezie</strong> - I manager confermano e possono lasciare commenti</li>
              </ol>

              <Example title="Esempio di asta">
                <p>Mario nomina Vlahovic. L'asta parte da 1 credito.</p>
                <p className="mt-2">Luigi offre 10, Peach offre 15, Mario rilancia a 20.</p>
                <p className="mt-2">Il timer scade, Mario vince Vlahovic per 20 crediti e gli assegna un contratto 20x3 (ingaggio 20, durata 3 semestri).</p>
              </Example>

              <h3 className="text-lg font-semibold text-white mt-8 mb-4">Vincoli Rosa</h3>
              <p className="text-gray-300 mb-4">
                La composizione della rosa è vincolata per ruolo. I parametri standard sono:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { role: 'P', name: 'Portieri', slots: 3, color: 'warning' },
                  { role: 'D', name: 'Difensori', slots: 8, color: 'primary' },
                  { role: 'C', name: 'Centrocampisti', slots: 8, color: 'secondary' },
                  { role: 'A', name: 'Attaccanti', slots: 6, color: 'danger' },
                ].map(r => (
                  <div key={r.role} className={`bg-${r.color}-500/10 border border-${r.color}-500/30 rounded-lg p-4 text-center`}>
                    <div className={`text-2xl font-bold text-${r.color}-400`}>{r.slots}</div>
                    <div className="text-sm text-gray-400">{r.name}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ========== MERCATO RICORRENTE ========== */}
            <section className="mb-16">
              <SectionHeader id="mercato-ricorrente" title="Mercato Ricorrente" icon="🔄" />

              <p className="text-gray-300 mb-6">
                Dopo il Primo Mercato, la lega entra nel ciclo dei <strong className="text-white">mercati ricorrenti</strong> (semestrali).
                Ogni sessione di mercato ricorrente segue un ordine preciso di fasi.
              </p>

              <div className="bg-surface-300/30 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Sequenza delle Fasi</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {[
                    { name: 'Scambi Pre', color: 'primary' },
                    { name: 'Premi', color: 'warning' },
                    { name: 'Contratti', color: 'secondary' },
                    { name: 'Rubata', color: 'danger' },
                    { name: 'Svincolati', color: 'accent' },
                    { name: 'Scambi Post', color: 'primary' },
                  ].map((phase, i) => (
                    <span key={phase.name} className="flex items-center gap-2">
                      <span className={`px-3 py-1.5 bg-${phase.color}-500/20 text-${phase.color}-400 rounded-lg font-medium`}>
                        {phase.name}
                      </span>
                      {i < 5 && <span className="text-gray-500">→</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fase Scambi Pre */}
              <div className="mb-12 pl-4 border-l-4 border-primary-500">
                <SubsectionHeader id="fase-scambi-pre" title="1. Fase Scambi Pre-Rinnovo" />
                <p className="text-gray-300 mb-4">
                  Prima fase del mercato ricorrente. I manager possono proporre e concludere scambi tra loro.
                </p>
                <ul className="list-disc ml-5 space-y-2 text-gray-300">
                  <li>Puoi proporre scambi di giocatori + budget</li>
                  <li>Il destinatario può accettare, rifiutare o controproporre</li>
                  <li>Le offerte scadono dopo 24 ore se non gestite</li>
                  <li>Vincolo anti-ritroso: un giocatore scambiato non può tornare allo stesso manager nella stessa sessione</li>
                </ul>
                <Example title="Esempio di scambio">
                  <p>Mario propone a Luigi: Vlahovic + 10M per Osimhen + 5M</p>
                  <p className="mt-2">Luigi accetta. I giocatori e il budget vengono trasferiti automaticamente.</p>
                </Example>
              </div>

              {/* Fase Premi */}
              <div className="mb-12 pl-4 border-l-4 border-warning-500">
                <SubsectionHeader id="fase-premi" title="2. Fase Premi" />
                <p className="text-gray-300 mb-4">
                  L'Admin assegna i premi in base ai risultati della stagione.
                </p>
                <h4 className="text-white font-medium mb-2">Tipologie di premio:</h4>
                <ul className="list-disc ml-5 space-y-2 text-gray-300 mb-4">
                  <li><strong className="text-warning-400">Re-incremento base</strong> - Importo fisso uguale per tutti</li>
                  <li><strong className="text-warning-400">Premi categoria</strong> - Es. "Miglior difesa", "Capocannoniere", ecc.</li>
                  <li><strong className="text-warning-400">Indennizzo partenza</strong> - Automatico per giocatori usciti dalla Serie A</li>
                </ul>
                <Example title="Esempio di premi">
                  <p>Re-incremento base: +50M a tutti</p>
                  <p className="mt-2">1° classificato: +30M, 2° classificato: +20M, 3° classificato: +10M</p>
                </Example>
              </div>

              {/* Fase Contratti */}
              <div className="mb-12 pl-4 border-l-4 border-secondary-500">
                <SubsectionHeader id="fase-contratti" title="3. Fase Contratti (Rinnovi)" />
                <p className="text-gray-300 mb-4">
                  I manager decidono il futuro dei propri giocatori: rinnovare, tagliare o lasciar scadere.
                </p>

                <InfoBox type="warning">
                  <strong>Importante:</strong> All'inizio di ogni mercato ricorrente, tutti i contratti perdono automaticamente 1 semestre di durata.
                </InfoBox>

                <h4 className="text-white font-medium mt-6 mb-3">Opzioni disponibili:</h4>

                <div className="space-y-4">
                  <div className="bg-secondary-500/10 border border-secondary-500/30 rounded-lg p-4">
                    <h5 className="font-semibold text-secondary-400 mb-2">Rinnovo Standard</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300">
                      <li>Puoi aumentare o mantenere l'ingaggio</li>
                      <li>Puoi aumentare o mantenere la durata (max 4 semestri)</li>
                      <li>La clausola viene ricalcolata automaticamente</li>
                    </ul>
                  </div>

                  <div className="bg-warning-500/10 border border-warning-500/30 rounded-lg p-4">
                    <h5 className="font-semibold text-warning-400 mb-2">Spalma (solo contratti 1 semestre)</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300">
                      <li>Permette di diminuire l'ingaggio allungando la durata</li>
                      <li><strong>Regola:</strong> Nuovo Ingaggio × Nuova Durata ≥ Ingaggio Iniziale</li>
                      <li>Esempio: 10M×1s → 5M×2s (5×2=10 ≥ 10) ✓</li>
                    </ul>
                  </div>

                  <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-4">
                    <h5 className="font-semibold text-danger-400 mb-2">Taglia (Rilascio)</h5>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-gray-300">
                      <li>Puoi liberare un giocatore pagando una penale</li>
                      <li><strong>Costo taglio:</strong> (Ingaggio × Durata residua) / 2</li>
                      <li>Esempio: 8M×2s → costo = (8×2)/2 = 8M</li>
                      <li>Il giocatore va agli svincolati</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Fase Rubata */}
              <div className="mb-12 pl-4 border-l-4 border-danger-500">
                <SubsectionHeader id="fase-rubata" title="4. Fase Rubata" />
                <p className="text-gray-300 mb-4">
                  La fase più caratteristica di Fantacontratti! I manager possono "rubare" giocatori agli avversari pagando la clausola rescissoria.
                </p>

                <h4 className="text-white font-medium mb-3">Come funziona:</h4>
                <ol className="list-decimal ml-5 space-y-2 text-gray-300 mb-6">
                  <li>L'Admin imposta l'ordine della rubata (tipicamente basato sulla classifica)</li>
                  <li>Per ogni manager, i giocatori sono ordinati per clausola (dalla più alta)</li>
                  <li>Per ogni giocatore nel tabellone, parte un'asta</li>
                  <li>Chiunque (tranne il proprietario) può fare un'offerta</li>
                  <li>Il prezzo base è: <strong className="text-danger-400">Clausola + Ingaggio</strong></li>
                  <li>Se c'è un vincitore, il giocatore viene trasferito</li>
                  <li>Il cedente incassa il prezzo di vendita</li>
                </ol>

                <InfoBox type="warning">
                  <strong>Il proprietario NON può rifiutare!</strong> La rubata è un meccanismo forzato per favorire il riequilibrio competitivo.
                </InfoBox>

                <Example title="Esempio di rubata">
                  <p>Vlahovic ha clausola 220M e ingaggio 20M. Prezzo base asta: 240M.</p>
                  <p className="mt-2">Luigi offre 240M, Peach rilancia a 250M. Nessun altro rilancio.</p>
                  <p className="mt-2">Peach vince Vlahovic per 250M. Mario (cedente) incassa 250M.</p>
                </Example>
              </div>

              {/* Fase Svincolati */}
              <div className="mb-12 pl-4 border-l-4 border-accent-500">
                <SubsectionHeader id="fase-svincolati" title="5. Fase Svincolati" />
                <p className="text-gray-300 mb-4">
                  Asta a turni per acquistare giocatori liberi: quelli tagliati, con contratto scaduto, o mai acquisiti.
                </p>

                <h4 className="text-white font-medium mb-3">Come funziona:</h4>
                <ol className="list-decimal ml-5 space-y-2 text-gray-300 mb-4">
                  <li>L'Admin imposta l'ordine dei turni</li>
                  <li>Il manager di turno può:
                    <ul className="list-disc ml-5 mt-1">
                      <li><strong>Nominare</strong> uno svincolato → parte l'asta</li>
                      <li><strong>Passare</strong> il turno (può tornare dopo)</li>
                      <li><strong>Dichiarare "Ho finito"</strong> (esce dalla rotazione)</li>
                    </ul>
                  </li>
                  <li>Il vincitore dell'asta deve assegnare un contratto</li>
                  <li>La fase termina quando tutti hanno finito o passato</li>
                </ol>

                <Example title="Esempio">
                  <p>Mario nomina Retegui (quotazione 15M). L'asta parte da 15M.</p>
                  <p className="mt-2">Mario vince per 18M e gli assegna un contratto 18×2.</p>
                </Example>
              </div>

              {/* Fase Scambi Post */}
              <div className="mb-12 pl-4 border-l-4 border-primary-500">
                <SubsectionHeader id="fase-scambi-post" title="6. Fase Scambi Post-Svincolati" />
                <p className="text-gray-300">
                  Ultima fase del mercato ricorrente. Funziona esattamente come la fase Scambi Pre-Rinnovo.
                  È l'ultima occasione per completare trattative prima della chiusura del mercato.
                </p>
              </div>
            </section>

            {/* ========== SISTEMA CONTRATTI ========== */}
            <section className="mb-16">
              <SectionHeader id="sistema-contratti" title="Sistema Contratti" icon="📝" />

              <p className="text-gray-300 mb-6">
                Il cuore di Fantacontratti è il sistema di contratti. Ogni giocatore ha un contratto con parametri specifici.
              </p>

              <h3 className="text-lg font-semibold text-white mb-4">Parametri del Contratto</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-50/20">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Parametro</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-surface-50/10">
                      <td className="py-3 px-4 font-medium text-white">Ingaggio</td>
                      <td className="py-3 px-4">Costo semestrale del giocatore (minimo = prezzo d'acquisto)</td>
                    </tr>
                    <tr className="border-b border-surface-50/10">
                      <td className="py-3 px-4 font-medium text-white">Durata</td>
                      <td className="py-3 px-4">Semestri rimanenti (da 1 a 4)</td>
                    </tr>
                    <tr className="border-b border-surface-50/10">
                      <td className="py-3 px-4 font-medium text-white">Clausola</td>
                      <td className="py-3 px-4">Prezzo minimo per la rubata = Ingaggio × Moltiplicatore</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-white mt-8 mb-4">Moltiplicatori Clausola</h3>
              <p className="text-gray-300 mb-4">
                La clausola rescissoria viene calcolata automaticamente in base alla durata:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { duration: 4, multiplier: 11 },
                  { duration: 3, multiplier: 9 },
                  { duration: 2, multiplier: 7 },
                  { duration: 1, multiplier: 4 },
                ].map(({ duration, multiplier }) => (
                  <div key={duration} className="bg-surface-300/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary-400">×{multiplier}</div>
                    <div className="text-sm text-gray-400">{duration} semestri</div>
                  </div>
                ))}
              </div>

              <Example title="Calcolo clausola">
                <p>Giocatore con ingaggio 20M e durata 3 semestri:</p>
                <p className="mt-2 font-mono text-primary-400">Clausola = 20 × 9 = 180M</p>
                <p className="mt-2">Prezzo base per la rubata: 180M + 20M = <strong>200M</strong></p>
              </Example>

              <h3 className="text-lg font-semibold text-white mt-8 mb-4">Strategia Contratti</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface-300/30 rounded-lg p-4">
                  <h4 className="font-semibold text-secondary-400 mb-2">Contratti lunghi (3-4s)</h4>
                  <p className="text-sm text-gray-400">
                    Clausola alta = difficile rubare. Ideale per i top player che vuoi proteggere.
                  </p>
                </div>
                <div className="bg-surface-300/30 rounded-lg p-4">
                  <h4 className="font-semibold text-warning-400 mb-2">Contratti corti (1-2s)</h4>
                  <p className="text-sm text-gray-400">
                    Clausola bassa = più flessibilità. Ideale per giocatori che potresti voler vendere.
                  </p>
                </div>
              </div>
            </section>

            {/* ========== GLOSSARIO ========== */}
            <section className="mb-16">
              <SectionHeader id="glossario" title="Glossario" icon="📚" />

              <div className="space-y-4">
                {[
                  { term: 'DG', def: 'Direttore Generale - il manager di una squadra' },
                  { term: 'Rosa', def: 'Insieme di giocatori posseduti da un manager' },
                  { term: 'Slot', def: 'Posizione disponibile in rosa per un determinato ruolo' },
                  { term: 'Clausola', def: 'Clausola rescissoria - importo minimo per rubare un giocatore' },
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
                  <div key={term} className="flex gap-4 py-3 border-b border-surface-50/10">
                    <dt className="w-32 flex-shrink-0 font-semibold text-primary-400">{term}</dt>
                    <dd className="text-gray-300">{def}</dd>
                  </div>
                ))}
              </div>
            </section>

            {/* ========== FAQ ========== */}
            <section className="mb-16">
              <SectionHeader id="faq" title="FAQ" icon="❓" />

              <div className="space-y-6">
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
                  <details key={i} className="bg-surface-300/30 rounded-lg overflow-hidden group">
                    <summary className="px-6 py-4 cursor-pointer font-medium text-white hover:bg-surface-300/50 transition-colors flex items-center justify-between">
                      {q}
                      <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-6 py-4 border-t border-surface-50/10 text-gray-300">
                      {a}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* Footer CTA */}
            <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-2xl border border-primary-500/30 p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Pronto a giocare?</h2>
              <p className="text-gray-300 mb-6">
                {isAuthenticated
                  ? 'Torna alla dashboard per gestire le tue leghe.'
                  : 'Registrati ora e inizia la tua avventura nel fantacalcio dinastico!'}
              </p>
              <button
                onClick={handleBack}
                className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
              >
                {isAuthenticated ? 'Vai alla Dashboard' : 'Accedi o Registrati'}
              </button>
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-surface-50/20 mt-16 py-8">
        <p className="text-center text-sm text-gray-500">
          © 2024 Fantacontratti. Tutti i diritti riservati.
        </p>
      </footer>
    </div>
  )
}

export default Rules
