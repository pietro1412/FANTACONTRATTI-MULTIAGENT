import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'

// Glossario dei concetti dinastici controintuitivi (P3 / F-ONB-1/2).
// Fonte: Bibbie (docs/bibbie/). `short` = micro-spiegazione per i tooltip nel
// punto d'uso; `long` = voce estesa per lo sheet glossario.

export interface GlossaryEntry {
  term: string
  short: string
  long: string
  source?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  quotazione: {
    term: 'Quotazione',
    short: 'Valore di listino del giocatore: è la base d\'asta, non lo stipendio.',
    long: 'Valore di listino del giocatore, usato come base d\'asta. Non va confuso con l\'ingaggio: la quotazione è "quanto vale", l\'ingaggio è "quanto ti costa tenerlo ogni stagione".',
    source: 'GIOCATORI.md',
  },
  ingaggio: {
    term: 'Ingaggio',
    short: 'Stipendio del giocatore: pesa ogni stagione sul Monte Ingaggi (≠ quotazione).',
    long: 'Stipendio annuo del giocatore. È la voce che pesa sul Monte Ingaggi della tua rosa stagione dopo stagione. Diverso dalla quotazione (valore di listino) e dal prezzo pagato all\'asta.',
    source: 'CONTRATTI.md',
  },
  durata: {
    term: 'Durata del contratto',
    short: 'Si misura in semestri e cala a ogni apertura di mercato.',
    long: 'La durata dei contratti si misura in semestri e viene decrementata all\'apertura di ogni mercato. Quando arriva a zero il giocatore si svincola, salvo rinnovo.',
    source: 'CONTRATTI.md',
  },
  clausola: {
    term: 'Clausola rescissoria',
    short: 'Il prezzo a cui un avversario può rubarti il giocatore nella fase Rubata.',
    long: 'La clausola rescissoria è il prezzo a cui un avversario può "rubare" il tuo giocatore durante la fase Rubata. Fa parte del contratto: gestirla è centrale per difendere i tuoi titolari.',
    source: 'CONTRATTI.md',
  },
  budget: {
    term: 'Budget',
    short: 'I crediti disponibili per operazioni (aste, scambi). Non è il Bilancio.',
    long: 'I crediti che hai a disposizione per le operazioni di mercato (aste, scambi). Da non confondere con il Bilancio, che è Budget al netto del Monte Ingaggi.',
    source: 'FINANZE.md §1.3',
  },
  monteIngaggi: {
    term: 'Monte Ingaggi',
    short: 'La somma degli ingaggi di tutti i giocatori della tua rosa.',
    long: 'La somma degli ingaggi di tutti i giocatori in rosa. Cresce quando aggiungi/rinnovi giocatori e va tenuta sotto controllo perché incide sul Bilancio.',
    source: 'FINANZE.md',
  },
  bilancio: {
    term: 'Bilancio',
    short: 'Bilancio = Budget − Monte Ingaggi. È la tua salute economica reale.',
    long: 'Il Bilancio è il Budget al netto del Monte Ingaggi (Bilancio = Budget − Monte Ingaggi). Misura la salute economica reale della rosa: puoi avere budget ma bilancio negativo se gli ingaggi sono alti.',
    source: 'FINANZE.md §1.3',
  },
  prezzoRubata: {
    term: 'Prezzo rubata',
    short: 'Quanto serve per rubare un giocatore: Clausola + Ingaggio.',
    long: 'Il costo totale per rubare un giocatore nella fase Rubata è la somma di Clausola rescissoria + Ingaggio (Prezzo rubata = Clausola + Ingaggio).',
    source: 'RUBATA.md §3.1',
  },
}

const GLOSSARY_ORDER: (keyof typeof GLOSSARY)[] = [
  'quotazione', 'ingaggio', 'durata', 'clausola', 'budget', 'monteIngaggi', 'bilancio', 'prezzoRubata',
]

/**
 * Pulsante help (icona "?") che apre uno sheet con il glossario dei concetti
 * dinastici. Auto-contenuto: gestisce il proprio stato → si inserisce ovunque
 * con una sola riga (es. nell'header di navigazione).
 */
export function GlossaryButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); }}
        className={`flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-surface-300/60 transition-colors ${className}`}
        aria-label="Apri il glossario dei termini"
        title="Glossario"
        data-testid="glossary-button"
      >
        <HelpCircle size={18} />
      </button>

      <BottomSheet isOpen={open} onClose={() => { setOpen(false); }} title="Glossario · come funziona una stagione">
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            I concetti chiave del gioco dinastico. La fonte sono le regole ufficiali della lega.
          </p>
          {GLOSSARY_ORDER.map((key) => {
            const e = GLOSSARY[key]!
            return (
              <div key={key} className="bg-surface-300/50 border border-surface-50/20 rounded-xl p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-white">{e.term}</h3>
                  {e.source && <span className="micro-label text-[8px] text-gray-600 flex-shrink-0">{e.source}</span>}
                </div>
                <p className="mt-1 text-xs text-gray-400 leading-relaxed">{e.long}</p>
              </div>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}
