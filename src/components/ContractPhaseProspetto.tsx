import { useState, useEffect } from 'react'
import { contractHistoryApi } from '../services/api'
import type { ContractPhaseProspetto as ContractPhaseProspettoType, ProspettoLineItem, ContractEventType } from '../types/contract-history'

interface Props {
  leagueId: string
  isConsolidated?: boolean
}

// Event type labels in Italian
const EVENT_TYPE_LABELS: Record<ContractEventType, string> = {
  SESSION_START_SNAPSHOT: 'Snapshot Iniziale',
  DURATION_DECREMENT: 'Decremento Durata',
  AUTO_RELEASE_EXPIRED: 'Scadenza Contratto',
  RENEWAL: 'Rinnovo',
  SPALMA: 'Spalma',
  RELEASE_NORMAL: 'Taglio',
  RELEASE_ESTERO: 'Rilascio Estero',
  RELEASE_RETROCESSO: 'Rilascio Retrocesso',
  KEEP_ESTERO: 'Mantenuto Estero',
  KEEP_RETROCESSO: 'Mantenuto Retrocesso',
  INDEMNITY_RECEIVED: 'Indennizzo Ricevuto',
}

// Event type colors
const getEventTypeColor = (eventType: ContractEventType): string => {
  switch (eventType) {
    case 'INDEMNITY_RECEIVED':
      return 'text-green-400'
    case 'RENEWAL':
    case 'SPALMA':
      return 'text-blue-400'
    case 'RELEASE_NORMAL':
      return 'text-red-400'
    case 'RELEASE_ESTERO':
    case 'RELEASE_RETROCESSO':
      return 'text-orange-400'
    case 'KEEP_ESTERO':
    case 'KEEP_RETROCESSO':
      return 'text-yellow-400'
    default:
      return 'text-gray-400'
  }
}

export function ContractPhaseProspetto({ leagueId, isConsolidated }: Props) {
  const [prospetto, setProspetto] = useState<ContractPhaseProspettoType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    async function fetchProspetto() {
      try {
        setLoading(true)
        setError(null)

        const response = await contractHistoryApi.getProspetto(leagueId)

        if (!response.success) {
          // If not in CONTRATTI phase, don't show error
          if (response.message?.includes('CONTRATTI')) {
            setProspetto(null)
          } else {
            setError(response.message || 'Errore sconosciuto')
          }
          return
        }

        setProspetto(response.data as ContractPhaseProspettoType)
      } catch (err) {
        console.error('Error fetching prospetto:', err)
        setError('Errore nel caricamento del prospetto')
      } finally {
        setLoading(false)
      }
    }

    fetchProspetto()
  }, [leagueId])

  if (loading) {
    return (
      <div className="bg-surface-secondary rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!prospetto) {
    return null
  }

  const formatNumber = (n: number) => {
    return n >= 0 ? `${n}` : `${n}`
  }

  const formatDiff = (n: number) => {
    if (n > 0) return `+${n}`
    if (n < 0) return `${n}`
    return '0'
  }

  return (
    <div className="bg-surface-secondary rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          Prospetto Fase Contratti
          {isConsolidated && (
            <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
              CONSOLIDATO
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Budget */}
        <div className="bg-surface-primary rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Budget</div>
          <div className="text-xl font-bold">{formatNumber(prospetto.budgetAttuale)}</div>
          <div className="text-xs text-gray-500">
            Iniziale: {formatNumber(prospetto.budgetIniziale)}
          </div>
        </div>

        {/* Ingaggi */}
        <div className="bg-surface-primary rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Ingaggi</div>
          <div className="text-xl font-bold">{formatNumber(prospetto.ingaggiAttuali)}</div>
          <div className={`text-xs ${prospetto.variazionIngaggi > 0 ? 'text-red-400' : prospetto.variazionIngaggi < 0 ? 'text-green-400' : 'text-gray-500'}`}>
            {formatDiff(prospetto.variazionIngaggi)}
          </div>
        </div>

        {/* Bilancio */}
        <div className="bg-surface-primary rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Bilancio</div>
          <div className={`text-xl font-bold ${prospetto.bilancioAttuale >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNumber(prospetto.bilancioAttuale)}
          </div>
          <div className="text-xs text-gray-500">
            Iniziale: {formatNumber(prospetto.bilancioIniziale)}
          </div>
        </div>

        {/* Contratti */}
        <div className="bg-surface-primary rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Contratti</div>
          <div className="text-xl font-bold">{prospetto.contrattiAttuali}</div>
          <div className="text-xs text-gray-500">
            Iniziali: {prospetto.contrattiIniziali}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-surface-primary rounded p-3 mb-4">
        <div className="text-sm font-semibold mb-2">Riepilogo Finanziario</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Budget iniziale:</span>
            <span>{formatNumber(prospetto.budgetIniziale)}</span>
          </div>
          {prospetto.indennizziRicevuti > 0 && (
            <div className="flex justify-between">
              <span className="text-green-400">+ Indennizzi:</span>
              <span className="text-green-400">+{prospetto.indennizziRicevuti}</span>
            </div>
          )}
          {prospetto.costiTagli > 0 && (
            <div className="flex justify-between">
              <span className="text-red-400">- Costi tagli:</span>
              <span className="text-red-400">-{prospetto.costiTagli}</span>
            </div>
          )}
          {prospetto.costiRinnovi > 0 && (
            <div className="flex justify-between">
              <span className="text-orange-400">- Costi rinnovi:</span>
              <span className="text-orange-400">-{prospetto.costiRinnovi}</span>
            </div>
          )}
          <div className="flex justify-between col-span-2 border-t border-gray-700 pt-1 mt-1">
            <span className="font-semibold">= Budget attuale:</span>
            <span className="font-semibold">{formatNumber(prospetto.budgetAttuale)}</span>
          </div>
        </div>
      </div>

      {/* Counts */}
      <div className="flex flex-wrap gap-4 text-sm mb-4">
        {prospetto.giocatoriTagliati > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-red-400">Tagliati:</span>
            <span className="font-bold">{prospetto.giocatoriTagliati}</span>
          </div>
        )}
        {prospetto.contrattiRinnovati > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-blue-400">Rinnovati:</span>
            <span className="font-bold">{prospetto.contrattiRinnovati}</span>
          </div>
        )}
        {prospetto.contrattiSpalmati > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-purple-400">Spalmati:</span>
            <span className="font-bold">{prospetto.contrattiSpalmati}</span>
          </div>
        )}
      </div>

      {/* Detailed Line Items */}
      {showDetails && prospetto.lineItems.length > 0 && (
        <div className="bg-surface-primary rounded p-3">
          <div className="text-sm font-semibold mb-2">Dettaglio Operazioni</div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {prospetto.lineItems.map((item: ProspettoLineItem) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm py-1 border-b border-gray-700 last:border-0"
              >
                <div className="flex-1">
                  <span className={getEventTypeColor(item.eventType)}>
                    [{EVENT_TYPE_LABELS[item.eventType]}]
                  </span>{' '}
                  <span className="text-gray-300">{item.description}</span>
                  {item.description.startsWith('[BOZZA]') && (
                    <span className="ml-1 text-xs bg-yellow-600 text-white px-1 rounded">
                      BOZZA
                    </span>
                  )}
                </div>
                <div className="ml-4 text-right whitespace-nowrap">
                  {item.debit && (
                    <span className="text-red-400">-{item.debit}</span>
                  )}
                  {item.credit && (
                    <span className="text-green-400">+{item.credit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractPhaseProspetto
