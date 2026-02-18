import { useState, useEffect, type FormEvent } from 'react'
import { leagueApi, superadminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NumberStepper } from '../components/ui/NumberStepper'
import { Navigation } from '../components/Navigation'

interface CreateLeagueProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface FieldErrors {
  name?: string
  teamName?: string
  description?: string
  maxParticipants?: string
  initialBudget?: string
  goalkeeperSlots?: string
  defenderSlots?: string
  midfielderSlots?: string
  forwardSlots?: string
}

export function CreateLeague({ onNavigate }: CreateLeagueProps) {
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkSuperAdmin() {
      const response = await superadminApi.getStatus()
      if (response.success && response.data) {
        const data = response.data as { isSuperAdmin: boolean }
        setIsSuperAdmin(data.isSuperAdmin)
        if (data.isSuperAdmin) {
          // Redirect superadmins away from this page
          onNavigate('dashboard')
        }
      } else {
        setIsSuperAdmin(false)
      }
    }
    void checkSuperAdmin()
  }, [onNavigate])
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [initialBudget, setInitialBudget] = useState(500)
  const [goalkeeperSlots, setGoalkeeperSlots] = useState(3)
  const [defenderSlots, setDefenderSlots] = useState(8)
  const [midfielderSlots, setMidfielderSlots] = useState(8)
  const [forwardSlots, setForwardSlots] = useState(6)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setSuccess('')
    setIsLoading(true)

    const response = await leagueApi.create({
      name,
      description: description || undefined,
      maxParticipants,
      initialBudget,
      goalkeeperSlots,
      defenderSlots,
      midfielderSlots,
      forwardSlots,
      teamName,
    })

    if (response.success && response.data) {
      const data = response.data as { inviteCode?: string }
      setSuccess('Lega creata con successo!')
      setInviteCode(data.inviteCode || '')
    } else {
      // Parse validation errors from API response
      if (response.errors && response.errors.length > 0) {
        const newFieldErrors: FieldErrors = {}
        response.errors.forEach(err => {
          const field = err.path?.[0] as keyof FieldErrors
          if (field && !newFieldErrors[field]) {
            newFieldErrors[field] = err.message
          }
        })
        setFieldErrors(newFieldErrors)

        // If no field-specific errors, show generic message
        if (Object.keys(newFieldErrors).length === 0) {
          setError(response.message || 'Errore durante la creazione')
        }
      } else {
        setError(response.message || 'Errore durante la creazione')
      }
    }

    setIsLoading(false)
  }

  const totalSlots = goalkeeperSlots + defenderSlots + midfielderSlots + forwardSlots

  // Show loading while checking superadmin status
  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation currentPage="create-league" onNavigate={onNavigate} />

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
          {/* Card Header */}
          <div className="p-4 sm:p-6 md:p-8 border-b border-surface-50/20 bg-gradient-to-r from-surface-300 to-surface-200">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow-gold">
                <span className="text-3xl">🏆</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Crea una Nuova Lega</h1>
                <p className="text-gray-400 mt-1">Configura la tua lega fantasy</p>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-4 sm:p-6 md:p-8">
            {success ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-secondary-500 to-secondary-700 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-5xl">🎉</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Lega Creata!</h2>
                <p className="text-secondary-400 text-lg mb-6">{success}</p>
                {inviteCode && (
                  <div className="bg-surface-300 p-6 rounded-xl mb-8 max-w-sm mx-auto border border-surface-50/20">
                    <p className="text-sm text-gray-400 mb-2 uppercase tracking-wide">Codice Invito</p>
                    <p className="font-mono text-2xl font-bold text-primary-400">{inviteCode}</p>
                    <p className="text-xs text-gray-500 mt-2">Condividi questo codice con i tuoi amici</p>
                  </div>
                )}
                <Button size="xl" onClick={() => { onNavigate('dashboard'); }}>
                  Vai alla Dashboard
                </Button>
              </div>
            ) : (
              <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-8">
                {error && (
                  <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl text-base">
                    {error}
                  </div>
                )}

                {/* Section: Info Lega */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl">📋</span>
                    <h3 className="text-xl font-bold text-white">Informazioni Lega</h3>
                  </div>

                  <Input
                    label="Nome Lega"
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); }}
                    placeholder="Lega Amici 2025"
                    required
                    minLength={3}
                    maxLength={50}
                    error={fieldErrors.name}
                  />

                  <Input
                    label="Nome della tua Squadra"
                    type="text"
                    value={teamName}
                    onChange={e => { setTeamName(e.target.value); }}
                    placeholder="I Campioni FC"
                    required
                    minLength={2}
                    maxLength={30}
                    error={fieldErrors.teamName}
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
                      Descrizione (opzionale)
                    </label>
                    <textarea
                      value={description}
                      onChange={e => { setDescription(e.target.value); }}
                      placeholder="Una breve descrizione della lega..."
                      className="w-full px-4 py-3 text-base bg-surface-300 border-2 border-surface-50/30 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all duration-200"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                </div>

                {/* Section: Configurazione */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl">⚙️</span>
                    <h3 className="text-xl font-bold text-white">Configurazione</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="bg-surface-300 rounded-xl p-5 border border-surface-50/20">
                      <NumberStepper
                        label="Max Partecipanti"
                        value={maxParticipants}
                        onChange={setMaxParticipants}
                        min={2}
                        max={20}
                        error={fieldErrors.maxParticipants}
                      />
                    </div>

                    <div className="bg-surface-300 rounded-xl p-5 border border-surface-50/20">
                      <NumberStepper
                        label="Budget Iniziale"
                        value={initialBudget}
                        onChange={setInitialBudget}
                        min={100}
                        max={10000}
                        step={50}
                        error={fieldErrors.initialBudget}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Slot Rosa */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl">👥</span>
                    <h3 className="text-xl font-bold text-white">Slot Rosa</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-surface-300 rounded-xl p-5 border border-amber-500/30 text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                        P
                      </div>
                      <NumberStepper
                        value={goalkeeperSlots}
                        onChange={setGoalkeeperSlots}
                        min={1}
                        max={5}
                        size="sm"
                      />
                      <p className="text-xs text-amber-400 mt-2">Portieri</p>
                    </div>

                    <div className="bg-surface-300 rounded-xl p-5 border border-blue-500/30 text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                        D
                      </div>
                      <NumberStepper
                        value={defenderSlots}
                        onChange={setDefenderSlots}
                        min={3}
                        max={12}
                        size="sm"
                      />
                      <p className="text-xs text-blue-400 mt-2">Difensori</p>
                    </div>

                    <div className="bg-surface-300 rounded-xl p-5 border border-emerald-500/30 text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                        C
                      </div>
                      <NumberStepper
                        value={midfielderSlots}
                        onChange={setMidfielderSlots}
                        min={3}
                        max={12}
                        size="sm"
                      />
                      <p className="text-xs text-emerald-400 mt-2">Centrocampisti</p>
                    </div>

                    <div className="bg-surface-300 rounded-xl p-5 border border-red-500/30 text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg">
                        A
                      </div>
                      <NumberStepper
                        value={forwardSlots}
                        onChange={setForwardSlots}
                        min={2}
                        max={8}
                        size="sm"
                      />
                      <p className="text-xs text-red-400 mt-2">Attaccanti</p>
                    </div>
                  </div>

                  <div className="bg-surface-300 rounded-lg p-4 text-center border border-surface-50/20">
                    <span className="text-gray-400">Totale slot rosa: </span>
                    <span className="text-2xl font-bold text-accent-400">{totalSlots}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => { onNavigate('dashboard'); }}
                  >
                    Annulla
                  </Button>
                  <Button type="submit" size="lg" variant="accent" className="flex-1" isLoading={isLoading}>
                    Crea Lega
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
