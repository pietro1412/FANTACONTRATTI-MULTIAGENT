import { useState } from 'react'
import { Button } from './ui/Button'

interface MarketSession {
  id: string
  type: 'PRIMO_MERCATO' | 'MERCATO_RICORRENTE'
  status: string
  currentPhase: string | null
}

interface ConsolidationStatus {
  allConsolidated: boolean
  members: Array<{
    memberId: string
    username: string
    consolidated: boolean
  }>
}

interface PhaseConfig {
  id: string
  label: string
  icon: string
  description: string
  actions: string[]
  exitCondition?: string
  onlyFirst?: boolean
  onlyRecurrent?: boolean
}

const PRIMO_MERCATO_PHASES: PhaseConfig[] = [
  {
    id: 'ASTA_LIBERA',
    label: 'Asta Primo Mercato',
    icon: '🔨',
    description: 'Costruzione delle rose. I manager acquistano giocatori seguendo la sequenza: Portieri → Difensori → Centrocampisti → Attaccanti.',
    actions: [
      'Nomina giocatori del ruolo corrente',
      'I manager fanno offerte',
      'Chiudi le aste manualmente o attendi il timer',
      'Al completamento di un ruolo, passa automaticamente al successivo'
    ],
    exitCondition: 'Tutte le rose devono essere complete (3P + 8D + 8C + 6A)',
    onlyFirst: true
  }
]

const MERCATO_RICORRENTE_PHASES: PhaseConfig[] = [
  {
    id: 'OFFERTE_PRE_RINNOVO',
    label: 'Scambi Pre-Rinnovo',
    icon: '🔄',
    description: 'Prima finestra di scambi. I manager possono scambiarsi giocatori e budget prima di rinnovare i contratti.',
    actions: [
      'I manager propongono scambi',
      'Accettano o rifiutano offerte',
      'Possono includere budget negli scambi'
    ],
    onlyRecurrent: true
  },
  {
    id: 'CONTRATTI',
    label: 'Rinnovo Contratti',
    icon: '📝',
    description: 'Gestione contratti. I manager devono impostare i contratti per i nuovi acquisti e possono rinnovare quelli esistenti.',
    actions: [
      'Setup contratti per nuovi giocatori',
      'Rinnovo contratti esistenti (aumenta salary/durata)',
      'Spalmaingaggi per contratti in scadenza',
      'Consolidamento obbligatorio prima di procedere'
    ],
    exitCondition: 'Tutti i manager devono consolidare i contratti',
    onlyRecurrent: true
  },
  {
    id: 'RUBATA',
    label: 'Rubata',
    icon: '🎯',
    description: 'Aste forzate. A turno, ogni manager mette all\'asta un proprio giocatore che gli altri possono "rubare" pagando la clausola rescissoria.',
    actions: [
      'Imposta l\'ordine dei turni di rubata',
      'Ogni manager al turno cede un giocatore',
      'Gli altri manager fanno offerte',
      'Il cedente incassa la clausola rescissoria'
    ],
    onlyRecurrent: true
  },
  {
    id: 'ASTA_SVINCOLATI',
    label: 'Asta Svincolati',
    icon: '📋',
    description: 'Acquisto giocatori liberi. I manager possono acquistare giocatori dal pool degli svincolati per completare le rose.',
    actions: [
      'Nomina giocatori dal pool svincolati',
      'I manager fanno offerte (base = 1 credito)',
      'Chi vince acquisisce il giocatore'
    ],
    onlyRecurrent: true
  },
  {
    id: 'OFFERTE_POST_ASTA_SVINCOLATI',
    label: 'Scambi Finali',
    icon: '🔄',
    description: 'Ultima finestra di scambi prima della chiusura del mercato. Ultima opportunità per aggiustare le rose.',
    actions: [
      'I manager propongono ultimi scambi',
      'Accettano o rifiutano offerte',
      'Chiudi la sessione quando tutti sono pronti'
    ],
    onlyRecurrent: true
  }
]

interface MarketPhaseManagerProps {
  session: MarketSession | null
  consolidationStatus: ConsolidationStatus | null
  isSubmitting: boolean
  onSetPhase: (sessionId: string, phase: string) => void
  onCloseSession: (sessionId: string) => void
  onCreateSession: (isRecurrent: boolean) => void
  onSimulateConsolidation?: () => void
  hasCompletedFirstMarket: boolean
}

export function MarketPhaseManager({
  session,
  consolidationStatus,
  isSubmitting,
  onSetPhase,
  onCloseSession,
  onCreateSession,
  onSimulateConsolidation,
  hasCompletedFirstMarket
}: MarketPhaseManagerProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // Determina le fasi in base al tipo di sessione
  const phases = session?.type === 'PRIMO_MERCATO'
    ? PRIMO_MERCATO_PHASES
    : MERCATO_RICORRENTE_PHASES

  const currentPhaseIndex = phases.findIndex(p => p.id === session?.currentPhase)
  const currentPhase = phases[currentPhaseIndex]
  const nextPhase = phases[currentPhaseIndex + 1]
  const prevPhase = phases[currentPhaseIndex - 1]

  // Verifica blocchi per avanzare
  const canAdvance = () => {
    if (!session || !currentPhase) return false

    if (currentPhase.id === 'ASTA_LIBERA') {
      // Per ora sempre true, il backend validerà
      return true
    }

    if (currentPhase.id === 'CONTRATTI') {
      return consolidationStatus?.allConsolidated === true
    }

    return true
  }

  // Nessuna sessione attiva
  if (!session) {
    return (
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-5xl">{hasCompletedFirstMarket ? '🔄' : '🏁'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {hasCompletedFirstMarket ? 'Avvia Mercato Ricorrente' : 'Avvia Primo Mercato'}
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            {hasCompletedFirstMarket
              ? 'Inizia una nuova sessione di mercato ricorrente. I contratti verranno decrementati automaticamente e i giocatori in scadenza saranno svincolati.'
              : 'Inizia il primo mercato della lega. I manager costruiranno le loro rose tramite asta.'}
          </p>
        </div>

        {/* Anteprima fasi */}
        <div className="bg-surface-300 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Fasi del {hasCompletedFirstMarket ? 'Mercato Ricorrente' : 'Primo Mercato'}
          </h3>
          <div className="space-y-3">
            {(hasCompletedFirstMarket ? MERCATO_RICORRENTE_PHASES : PRIMO_MERCATO_PHASES).map((phase, idx) => (
              <div key={phase.id} className="flex items-center gap-3 text-gray-300">
                <span className="w-8 h-8 rounded-full bg-surface-50/10 flex items-center justify-center text-lg">
                  {phase.icon}
                </span>
                <span className="font-medium">{idx + 1}. {phase.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => onCreateSession(hasCompletedFirstMarket)}
          disabled={isSubmitting}
        >
          {hasCompletedFirstMarket ? 'Avvia Mercato Ricorrente' : 'Avvia Primo Mercato'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con tipo sessione */}
      <div className="bg-gradient-to-r from-primary-600/20 to-primary-500/10 border border-primary-500/30 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center">
              <span className="text-3xl">{session.type === 'PRIMO_MERCATO' ? '🏁' : '🔄'}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
              </h2>
              <p className="text-gray-400">Sessione attiva</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Fase corrente</p>
            <p className="text-lg font-bold text-primary-400">{currentPhase?.label || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Timeline delle fasi */}
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
        <h3 className="text-lg font-bold text-white mb-6">Flusso delle Fasi</h3>

        <div className="relative">
          {/* Linea di connessione */}
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-surface-50/20" />

          <div className="space-y-4">
            {phases.map((phase, idx) => {
              const isCurrentPhase = phase.id === session.currentPhase
              const isPastPhase = idx < currentPhaseIndex
              const isFuturePhase = idx > currentPhaseIndex

              return (
                <div
                  key={phase.id}
                  className={`relative flex gap-4 p-4 rounded-xl transition-all ${
                    isCurrentPhase
                      ? 'bg-primary-500/20 border-2 border-primary-500/50'
                      : isPastPhase
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-surface-300 border border-surface-50/10'
                  }`}
                >
                  {/* Indicatore */}
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    isCurrentPhase
                      ? 'bg-primary-500 animate-pulse'
                      : isPastPhase
                        ? 'bg-green-500'
                        : 'bg-surface-50/20'
                  }`}>
                    {isPastPhase ? '✓' : phase.icon}
                  </div>

                  {/* Contenuto */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-bold ${isCurrentPhase ? 'text-primary-400' : isPastPhase ? 'text-green-400' : 'text-gray-300'}`}>
                        {idx + 1}. {phase.label}
                      </h4>
                      {isCurrentPhase && (
                        <span className="px-3 py-1 bg-primary-500/30 text-primary-400 text-xs font-bold rounded-full uppercase">
                          Fase Attuale
                        </span>
                      )}
                      {isPastPhase && (
                        <span className="px-3 py-1 bg-green-500/30 text-green-400 text-xs font-bold rounded-full uppercase">
                          Completata
                        </span>
                      )}
                    </div>

                    <p className={`text-sm mb-3 ${isCurrentPhase ? 'text-gray-300' : 'text-gray-500'}`}>
                      {phase.description}
                    </p>

                    {/* Azioni disponibili - solo per fase corrente */}
                    {isCurrentPhase && (
                      <div className="bg-surface-300/50 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Cosa puoi fare:</p>
                        <ul className="space-y-1">
                          {phase.actions.map((action, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-primary-400 mt-0.5">•</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Condizione di uscita */}
                    {isCurrentPhase && phase.exitCondition && (
                      <div className={`flex items-center gap-2 text-sm ${
                        canAdvance() ? 'text-green-400' : 'text-warning-400'
                      }`}>
                        <span>{canAdvance() ? '✓' : '⚠️'}</span>
                        <span>{phase.exitCondition}</span>
                      </div>
                    )}

                    {/* Stato consolidamento per fase CONTRATTI */}
                    {isCurrentPhase && phase.id === 'CONTRATTI' && consolidationStatus?.members && (
                      <div className="mt-3 bg-surface-300 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase">
                            Stato Consolidamento ({consolidationStatus.members.filter(m => m.consolidated).length}/{consolidationStatus.members.length})
                          </p>
                          {!consolidationStatus.allConsolidated && onSimulateConsolidation && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-purple-500/50 text-purple-400"
                              onClick={onSimulateConsolidation}
                              disabled={isSubmitting}
                            >
                              Simula Tutti
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {consolidationStatus.members.map(m => (
                            <div key={m.memberId} className="flex items-center gap-2 text-sm">
                              <span className={m.consolidated ? 'text-green-400' : 'text-gray-500'}>
                                {m.consolidated ? '✓' : '○'}
                              </span>
                              <span className={m.consolidated ? 'text-green-400' : 'text-gray-400'}>
                                {m.username}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Controlli navigazione fasi */}
      <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Gestione Fase</h3>

        <div className="flex flex-wrap gap-3">
          {/* Pulsante fase precedente */}
          {prevPhase && (
            <Button
              variant="outline"
              onClick={() => onSetPhase(session.id, prevPhase.id)}
              disabled={isSubmitting}
            >
              ← Torna a {prevPhase.label}
            </Button>
          )}

          {/* Pulsante fase successiva */}
          {nextPhase && (
            <Button
              variant="primary"
              onClick={() => onSetPhase(session.id, nextPhase.id)}
              disabled={isSubmitting || !canAdvance()}
            >
              Avanza a {nextPhase.label} →
            </Button>
          )}

          {/* Pulsante chiudi sessione (solo se ultima fase o primo mercato) */}
          {(!nextPhase || session.type === 'PRIMO_MERCATO') && (
            <>
              {!showCloseConfirm ? (
                <Button
                  variant="danger"
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={isSubmitting}
                >
                  Chiudi Sessione
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-danger-500/20 px-4 py-2 rounded-lg">
                  <span className="text-danger-400 text-sm">Confermi?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onCloseSession(session.id)
                      setShowCloseConfirm(false)
                    }}
                    disabled={isSubmitting}
                  >
                    Sì, chiudi
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCloseConfirm(false)}
                  >
                    Annulla
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Warning se non si può avanzare */}
        {nextPhase && !canAdvance() && currentPhase?.exitCondition && (
          <div className="mt-4 bg-warning-500/20 border border-warning-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-warning-400">Non puoi ancora avanzare</p>
                <p className="text-sm text-gray-400">{currentPhase.exitCondition}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selezione rapida fasi (per admin esperti) */}
      <details className="bg-surface-200 rounded-2xl border border-surface-50/20">
        <summary className="p-4 cursor-pointer text-gray-400 hover:text-white">
          Selezione rapida fasi (avanzato)
        </summary>
        <div className="p-4 pt-0 border-t border-surface-50/10">
          <p className="text-sm text-gray-500 mb-3">
            Passa direttamente a una fase specifica. Attenzione: alcune transizioni potrebbero essere bloccate.
          </p>
          <div className="flex flex-wrap gap-2">
            {phases.map(phase => (
              <Button
                key={phase.id}
                size="sm"
                variant={phase.id === session.currentPhase ? 'primary' : 'outline'}
                onClick={() => onSetPhase(session.id, phase.id)}
                disabled={isSubmitting || phase.id === session.currentPhase}
              >
                {phase.icon} {phase.label}
              </Button>
            ))}
          </div>
        </div>
      </details>
    </div>
  )
}
