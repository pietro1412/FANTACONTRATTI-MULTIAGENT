import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { simulatoreApi, type CessioneAnalysis, type BudgetAnalysis } from '../services/api'
import { Navigation } from '../components/Navigation'
import { SimulatoreCessioni } from '../components/SimulatoreCessioni'
import { SimulatoreBudget } from '../components/SimulatoreBudget'

type TabType = 'cessioni' | 'budget'

interface SimulatoreProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

export function Simulatore({ onNavigate }: SimulatoreProps) {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [activeTab, setActiveTab] = useState<TabType>('cessioni')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Data state
  const [cessioni, setCessioni] = useState<CessioneAnalysis[]>([])
  const [budget, setBudget] = useState<BudgetAnalysis | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    if (!leagueId) return

    setLoading(true)
    setError('')

    try {
      // Load both cessioni and budget in parallel
      const [cessioniRes, budgetRes] = await Promise.all([
        simulatoreApi.getCessioni(leagueId),
        simulatoreApi.getBudget(leagueId),
      ])

      if (cessioniRes.success && cessioniRes.data) {
        setCessioni(cessioniRes.data)
      } else {
        setError(cessioniRes.message || 'Errore nel caricamento dati cessioni')
      }

      if (budgetRes.success && budgetRes.data) {
        setBudget(budgetRes.data)
      } else if (!cessioniRes.success) {
        setError(budgetRes.message || 'Errore nel caricamento dati budget')
      }
    } catch (err) {
      console.error('Error loading simulatore data:', err)
      setError('Errore di connessione al server')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const tabs = [
    { id: 'cessioni' as const, label: 'Simulazione Cessioni', icon: '\uD83D\uDCC9' },
    { id: 'budget' as const, label: 'Analisi Budget', icon: '\uD83D\uDCB0' },
  ]

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation onNavigate={onNavigate} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => onNavigate('strategie-rubata')}
              className="text-dark-100 hover:text-white transition-colors"
              title="Torna a Strategie"
            >
              {'\u2190'} Strategie
            </button>
          </div>
          <h1 className="text-2xl font-bold text-white">Simulatore</h1>
          <p className="text-dark-100 mt-1">
            Simula cessioni e analizza l'impatto sul budget
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-dark-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary-400 border-primary-400'
                  : 'text-dark-100 border-transparent hover:text-white hover:border-dark-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-dark-100">Caricamento dati...</p>
            </div>
          </div>
        ) : (
          <div className="bg-dark-200 rounded-xl p-6 border border-dark-100">
            {activeTab === 'cessioni' && leagueId && (
              <SimulatoreCessioni
                leagueId={leagueId}
                cessioni={cessioni}
              />
            )}

            {activeTab === 'budget' && budget && (
              <SimulatoreBudget budget={budget} />
            )}

            {activeTab === 'budget' && !budget && (
              <div className="text-center py-12 text-dark-100">
                <p>Impossibile caricare i dati del budget.</p>
                <button
                  onClick={loadData}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Riprova
                </button>
              </div>
            )}
          </div>
        )}

        {/* Help section */}
        <div className="mt-6 bg-dark-200 rounded-xl p-6 border border-dark-100">
          <h3 className="text-lg font-bold text-white mb-3">Come usare il Simulatore</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-dark-100">
            <div>
              <h4 className="font-medium text-primary-400 mb-2">Simulazione Cessioni</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Visualizza tutti i tuoi giocatori con contratto</li>
                <li>Ordina per impatto sul budget per trovare i tagli convenienti</li>
                <li>Espandi ogni giocatore per vedere possibili sostituti</li>
                <li>Il match score indica quanto un sostituto e simile</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-primary-400 mb-2">Analisi Budget</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>Visualizza la situazione attuale del budget</li>
                <li>Considera l'impatto dei rinnovi in bozza</li>
                <li>Controlla la disponibilita slot per ruolo</li>
                <li>Pianifica gli acquisti in base al budget proiettato</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Simulatore
