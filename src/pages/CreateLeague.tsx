import { useState, useEffect, useRef, type FormEvent } from 'react'
import { leagueApi, superadminApi, inviteApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
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
  // Default: lega privata (isPublic = false) -> accessibile solo su invito
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Logo lega (opzionale) scelto in fase di creazione
  const [logo, setLogo] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Invita manager (step di successo): riusa inviteApi.create sulla lega appena creata (DRAFT)
  const [createdLeagueId, setCreatedLeagueId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [sentInvites, setSentInvites] = useState<string[]>([])

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
      isPublic,
      imageUrl: logo || undefined,
    })

    if (response.success && response.data) {
      const data = response.data as { id?: string; inviteCode?: string }
      setSuccess('Lega creata con successo!')
      setInviteCode(data.inviteCode || '')
      setCreatedLeagueId(data.id || '')
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

  async function handleInvite() {
    const value = inviteEmail.trim()
    if (!value || !createdLeagueId) return

    setInviteError('')
    setIsInviting(true)

    const res = await inviteApi.create(createdLeagueId, value)
    if (res.success) {
      setSentInvites(prev => [...prev, value])
      setInviteEmail('')
    } else {
      setInviteError(res.message || 'Errore nell\'invio dell\'invito')
    }

    setIsInviting(false)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Il file deve essere un\'immagine')
      return
    }
    if (file.size > 500 * 1024) {
      setError('Il logo deve essere inferiore a 500KB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setError('')
      setLogo(event.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
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
                <p className="text-secondary-400 text-lg mb-8">{success}</p>

                {/* Invita manager (primario): invia un invito via email/username */}
                {createdLeagueId && (
                  <div className="bg-surface-300 p-6 rounded-xl mb-6 max-w-md mx-auto border border-surface-50/20 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">✉️</span>
                      <h3 className="font-bold text-white">Invita manager</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      Inserisci l&apos;email o lo username di un manager: riceverà un invito a unirsi alla lega.
                    </p>

                    {inviteError && (
                      <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg text-sm mb-3">
                        {inviteError}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      <div className="flex-1">
                        <Input
                          label="Email o username"
                          type="text"
                          value={inviteEmail}
                          onChange={e => { setInviteEmail(e.target.value); }}
                          placeholder="manager@email.it"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void handleInvite()
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => { void handleInvite() }}
                        isLoading={isInviting}
                        disabled={!inviteEmail.trim()}
                      >
                        Invia invito
                      </Button>
                    </div>

                    {sentInvites.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Inviti inviati</p>
                        <ul className="space-y-1">
                          {sentInvites.map((inv, i) => (
                            <li key={`${inv}-${i}`} className="text-sm text-secondary-400 flex items-center gap-2">
                              <span aria-hidden="true">✅</span> {inv}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Codice invito (secondario): condivisione manuale */}
                {inviteCode && (
                  <div className="bg-surface-300 p-5 rounded-xl mb-8 max-w-md mx-auto border border-surface-50/20">
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Oppure condividi il codice invito</p>
                    <p className="font-mono text-xl font-bold text-primary-400">{inviteCode}</p>
                    <p className="text-xs text-gray-500 mt-2">Chi ha il codice può unirsi dalla pagina di partecipazione.</p>
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

                  {/* Logo lega (opzionale) */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      title={logo ? 'Cambia logo' : 'Carica logo della lega'}
                      className="group relative w-16 h-16 rounded-xl overflow-hidden bg-surface-300 border-2 border-dashed border-surface-50/40 flex items-center justify-center flex-shrink-0 hover:border-primary-500/60 transition-colors"
                    >
                      {logo ? (
                        <img src={logo} alt="Logo lega" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl opacity-70">🏆</span>
                      )}
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-gray-300">Logo della lega <span className="text-gray-500 font-normal">(opzionale)</span></p>
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="text-xs font-medium text-primary-400 hover:text-primary-300"
                        >
                          📷 {logo ? 'Cambia logo' : 'Carica logo'}
                        </button>
                        {logo && (
                          <button
                            type="button"
                            onClick={() => { setLogo('') }}
                            className="text-xs text-danger-400 hover:text-danger-300"
                          >
                            Rimuovi
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">PNG/JPG, max 500KB. Potrai cambiarlo anche dopo dal Pannello Admin.</p>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
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
                    <Textarea
                      value={description}
                      onChange={e => { setDescription(e.target.value); }}
                      placeholder="Una breve descrizione della lega..."
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
                        min={6}
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

                {/* Section: Visibilità */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl">🔒</span>
                    <h3 className="text-xl font-bold text-white">Visibilità</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => { setIsPublic(false); }}
                      aria-pressed={!isPublic}
                      className={`text-left rounded-xl p-5 border-2 transition-all duration-200 ${
                        !isPublic
                          ? 'border-primary-500 bg-primary-500/10 shadow-glow'
                          : 'border-surface-50/20 bg-surface-300 hover:border-surface-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔒</span>
                        <span className="font-bold text-white">Privata</span>
                        {!isPublic && (
                          <span className="ml-auto text-xs font-medium text-primary-400">Selezionata</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        Accessibile solo su invito tramite codice. Non compare nella ricerca pubblica.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsPublic(true); }}
                      aria-pressed={isPublic}
                      className={`text-left rounded-xl p-5 border-2 transition-all duration-200 ${
                        isPublic
                          ? 'border-secondary-500 bg-secondary-500/10 shadow-glow'
                          : 'border-surface-50/20 bg-surface-300 hover:border-surface-50/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🌐</span>
                        <span className="font-bold text-white">Pubblica</span>
                        {isPublic && (
                          <span className="ml-auto text-xs font-medium text-secondary-400">Selezionata</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        Ricercabile da tutti: chiunque può trovarla e richiedere di unirsi.
                      </p>
                    </button>
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
                        min={3}
                        max={5}
                        size="sm"
                        error={fieldErrors.goalkeeperSlots}
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
                        min={8}
                        max={12}
                        size="sm"
                        error={fieldErrors.defenderSlots}
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
                        min={8}
                        max={12}
                        size="sm"
                        error={fieldErrors.midfielderSlots}
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
                        min={6}
                        max={8}
                        size="sm"
                        error={fieldErrors.forwardSlots}
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
