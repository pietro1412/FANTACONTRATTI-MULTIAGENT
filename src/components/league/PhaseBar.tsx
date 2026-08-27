// Barra-fase persistente (P2): bussola+timone sempre presente sotto l'header in
// ogni sezione di consultazione (NON nei cockpit live: lì la testata cockpit
// mostra già fase e timer). Risolve F-NAV-4 e il finding #4 dell'audit prodotto.
//
// Mostra: fase corrente ("Fase N di 7"), titolo + hint "cosa fare ora", stepper a
// 7 fasi cliccabile (passate/corrente navigano alla sezione; future disabilitate)
// e una CTA che porta alla sezione della fase corrente.
//
// Sorgente fasi condivisa: src/lib/phaseSteps.ts (riusata da PhaseIndicator).

import { Zap, ArrowLeftRight, Trophy, FileSignature, Target, UserPlus, ChevronRight } from 'lucide-react'
import type { NavigateFn } from '@/components/league/attention'
import { phaseToNavKey } from '@/lib/navItems'
import { buildRecurrentSteps, currentRecurrentPosition } from '@/lib/phaseSteps'

interface PhaseBarProps {
  leagueId: string
  /** currentPhase della sessione attiva (enum MarketPhase) o null. */
  currentPhase: string | null | undefined
  /** id sessione attiva: serve per aprire l'asta del primo mercato. */
  activeSessionId?: string | null
  /** Pagina corrente (stesso valore passato a Navigation): nasconde la CTA se coincide con la fase. */
  currentPage?: string
  onNavigate: NavigateFn
}

interface PhaseUi {
  title: string
  hint: string
  cta: string
  live?: boolean
  Icon: typeof Zap
}

const PHASE_UI: Record<string, PhaseUi> = {
  ASTA_LIBERA: { title: 'Primo Mercato', hint: 'Asta iniziale delle rose', cta: "Entra nell'asta", live: true, Icon: Zap },
  OFFERTE_PRE_RINNOVO: { title: 'Offerte e Scambi', hint: 'Tratta prima dei rinnovi', cta: 'Vai agli scambi', Icon: ArrowLeftRight },
  PREMI: { title: 'Assegnazione Premi', hint: 'Premi e indennizzi di stagione', cta: 'Vedi i premi', Icon: Trophy },
  CONTRATTI: { title: 'Rinnovo Contratti', hint: 'Rinnova, spalma, consolida', cta: 'Gestisci i contratti', Icon: FileSignature },
  RUBATA: { title: 'Asta Rubata', hint: 'Difendi i tuoi, ruba agli altri', cta: 'Entra nella Rubata', live: true, Icon: Target },
  ASTA_SVINCOLATI: { title: 'Asta Svincolati', hint: 'Aggiudicati gli svincolati', cta: 'Vai ai Svincolati', live: true, Icon: UserPlus },
  OFFERTE_POST_ASTA_SVINCOLATI: { title: 'Offerte e Scambi', hint: 'Ultimi scambi del mercato', cta: 'Vai agli scambi', Icon: ArrowLeftRight },
}

export function PhaseBar({ leagueId, currentPhase, activeSessionId, currentPage, onNavigate }: PhaseBarProps) {
  const ui = currentPhase ? PHASE_UI[currentPhase] : undefined
  // Niente fase navigabile (nessuna sessione attiva / fase senza barra) → non mostrare.
  if (!ui) return null

  const navKey = phaseToNavKey(currentPhase)
  // Già sulla pagina della fase corrente: la CTA "porta" dove si è già, non ha senso mostrarla.
  const isOnCurrentPhasePage = Boolean(navKey) && navKey === currentPage
  const pos = currentRecurrentPosition(currentPhase)
  const steps = buildRecurrentSteps(currentPhase)
  const Icon = ui.Icon

  const goToCurrent = () => {
    if (!navKey) return
    const params: Record<string, string> = { leagueId }
    if (navKey === 'auction' && activeSessionId) params.sessionId = activeSessionId
    onNavigate(navKey, params)
  }

  const goToStep = (phaseKey: string, navigable: boolean) => {
    if (!navigable) return
    const key = phaseToNavKey(phaseKey)
    if (key) onNavigate(key, { leagueId })
  }

  return (
    <div
      className="corner-cut border-b border-surface-50/20 bg-gradient-to-r from-accent-500/10 via-surface-300/30 to-surface-300/10"
      data-testid="phase-bar"
    >
      <div className="max-w-full mx-auto px-4 py-2 flex items-center gap-3">
        {/* Fase corrente */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ui.live ? 'bg-danger-500/15 text-danger-400' : 'bg-accent-500/15 text-accent-400'}`}>
            <Icon size={18} />
          </div>
          <div className="leading-tight">
            <div className="micro-label text-accent-400 flex items-center gap-1.5">
              {pos ? `Fase ${pos.index} di ${pos.total}` : 'In corso'}
              {ui.live && (
                <span className="inline-flex items-center gap-1 text-danger-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse" />LIVE
                </span>
              )}
            </div>
            <div className="font-display text-sm font-bold text-white leading-tight">{ui.title}</div>
          </div>
        </div>

        {/* Hint "cosa fare ora" — solo su schermi medi */}
        <span className="hidden md:block lg:hidden text-xs text-gray-400 truncate">{ui.hint}</span>

        {/* Stepper 7 fasi cliccabile — desktop */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide" role="list" aria-label="Avanzamento fasi">
          {steps.map((step, i) => {
            const navigable = step.state !== 'future'
            return (
              <div key={step.key} className="flex items-center" role="listitem">
                <button
                  type="button"
                  onClick={() => { goToStep(step.key, navigable) }}
                  disabled={!navigable}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    step.state === 'current'
                      ? 'bg-accent-400 text-[#0a0a0b]'
                      : step.state === 'done'
                        ? 'text-secondary-400 hover:bg-surface-100'
                        : 'text-gray-500 opacity-60 cursor-default'
                  }`}
                >
                  <span className={`stat-number w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${
                    step.state === 'current' ? 'bg-[#0a0a0b] text-accent-400' : step.state === 'done' ? 'bg-secondary-500 text-[#06200f]' : 'bg-surface-100 text-gray-500'
                  }`}>
                    {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : String(i + 1)}
                  </span>
                  {step.label}
                </button>
                {i < steps.length - 1 && <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* CTA verso la fase corrente (nascosta se si è già su quella pagina) */}
        {navKey && !isOnCurrentPhasePage && (
          <button
            type="button"
            onClick={goToCurrent}
            className="ml-auto lg:ml-0 flex-shrink-0 font-display text-xs font-bold uppercase tracking-wide text-[#0a0a0b] bg-gradient-to-b from-accent-300 to-accent-500 hover:from-accent-200 hover:to-accent-400 rounded-lg px-3.5 py-2 transition-colors"
            data-testid="phase-bar-cta"
          >
            {ui.cta} →
          </button>
        )}
      </div>

      {/* Progresso compatto a segmenti — mobile (<lg) */}
      <div className="flex lg:hidden gap-1 px-4 pb-2">
        {steps.map((step) => (
          <span
            key={step.key}
            className={`flex-1 h-1 rounded-full ${
              step.state === 'done' ? 'bg-secondary-500' : step.state === 'current' ? 'bg-accent-400' : 'bg-surface-100'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
