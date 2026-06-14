import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { leagueApi, superadminApi, inviteApi } from '@/services/api'
import { useApiFieldErrors } from '@/hooks/useApiFieldErrors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { AuthError } from '@/components/auth/AuthError'
import { AuthSuccessCard } from '@/components/auth/AuthSuccessCard'
import { PlayerRoleBadge } from '@/components/players/PlayerRoleBadge'
import { POSITION_TEXT_COLORS } from '@/components/ui/PositionBadge'
import { Navigation } from '@/components/Navigation'

interface CreateLeagueProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

type CreateLeagueField =
  | 'name'
  | 'teamName'
  | 'description'
  | 'maxParticipants'
  | 'initialBudget'
  | 'goalkeeperSlots'
  | 'defenderSlots'
  | 'midfielderSlots'
  | 'forwardSlots'

/** Card di sezione del form (header a .micro-label + tile icona a token). */
function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="bg-surface-300 rounded-2xl border border-surface-50/20 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="w-7 h-7 rounded-lg bg-surface-200 border border-surface-50/20 flex items-center justify-center text-sm"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3 className="micro-label">{title}</h3>
      </div>
      {children}
    </section>
  )
}

const SLOT_CONFIG: Array<{
  position: 'P' | 'D' | 'C' | 'A'
  label: string
  min: number
  max: number
}> = [
  { position: 'P', label: 'Portieri', min: 3, max: 5 },
  { position: 'D', label: 'Difensori', min: 8, max: 12 },
  { position: 'C', label: 'Centrocampisti', min: 8, max: 12 },
  { position: 'A', label: 'Attaccanti', min: 6, max: 8 },
]

export function CreateLeague({ onNavigate }: CreateLeagueProps) {
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
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
  const [success, setSuccess] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Logo lega (opzionale) scelto in fase di creazione
  const [logo, setLogo] = useState('')
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Invita manager (step di successo): riusa inviteApi.create sulla lega appena creata (DRAFT)
  const [createdLeagueId, setCreatedLeagueId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [sentInvites, setSentInvites] = useState<string[]>([])
  const [codeCopied, setCodeCopied] = useState(false)

  const { fieldErrors, generalError, applyApiErrors, clearFieldError, resetErrors } =
    useApiFieldErrors<CreateLeagueField>()

  const slotSetters: Record<CreateLeagueField, ((value: number) => void) | undefined> = {
    name: undefined,
    teamName: undefined,
    description: undefined,
    maxParticipants: setMaxParticipants,
    initialBudget: setInitialBudget,
    goalkeeperSlots: setGoalkeeperSlots,
    defenderSlots: setDefenderSlots,
    midfielderSlots: setMidfielderSlots,
    forwardSlots: setForwardSlots,
  }
  const slotValues: Record<'P' | 'D' | 'C' | 'A', { value: number; field: CreateLeagueField }> = {
    P: { value: goalkeeperSlots, field: 'goalkeeperSlots' },
    D: { value: defenderSlots, field: 'defenderSlots' },
    C: { value: midfielderSlots, field: 'midfielderSlots' },
    A: { value: forwardSlots, field: 'forwardSlots' },
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    resetErrors()
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
      applyApiErrors(response, 'Errore durante la creazione')
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

  function handleCopyCode() {
    if (!inviteCode) return
    void navigator.clipboard.writeText(inviteCode).catch(() => { /* clipboard non disponibile */ })
    setCodeCopied(true)
    setTimeout(() => { setCodeCopied(false) }, 2000)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Il file deve essere un\'immagine')
      return
    }
    if (file.size > 500 * 1024) {
      setLogoError('Il logo deve essere inferiore a 500KB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoError('')
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Page header */}
        <header className="mb-6">
          <p className="micro-label mb-1.5">Nuova Lega</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Crea una Nuova Lega</h1>
          <p className="text-sm text-gray-400 mt-1">Configura la tua lega dinastica e invita i manager.</p>
        </header>

        {success ? (
          <div className="bg-surface-200 rounded-2xl border border-surface-50/20 p-5 sm:p-8">
            <AuthSuccessCard
              icon="✓"
              title="Lega Creata!"
              message={
                <>
                  <b className="text-white">{name || 'La tua lega'}</b> è pronta. Invita i manager per iniziare.
                </>
              }
            />

            {/* Invita manager (primario): invia un invito via email/username */}
            {createdLeagueId && (
              <div className="bg-surface-300 p-5 rounded-xl mt-6 border border-surface-50/20 text-left">
                <h3 className="micro-label mb-2">Invita manager</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Inserisci l&apos;email o lo username di un manager: riceverà un invito a unirsi alla lega.
                </p>

                {inviteError && (
                  <div className="mb-3">
                    <AuthError message={inviteError} />
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
                    <p className="micro-label mb-2">Inviti inviati</p>
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
              <div className="bg-surface-300 border border-dashed border-surface-50/30 rounded-xl p-4 mt-4">
                <p className="micro-label mb-2">Oppure condividi il codice invito</p>
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-mono text-xl font-bold text-primary-400 tracking-wider break-all">
                    {inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="shrink-0 min-h-[44px] px-4 text-sm font-semibold text-gray-100 bg-surface-200 border border-surface-50/20 rounded-lg hover:bg-surface-100 transition-colors"
                  >
                    {codeCopied ? '✓ Copiato' : '📋 Copia'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Chi ha il codice può unirsi dalla pagina di partecipazione.</p>
              </div>
            )}

            <div className="mt-6">
              <Button size="xl" variant="accent" className="w-full" onClick={() => { onNavigate('dashboard'); }}>
                Vai alla Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
            {generalError && <AuthError message={generalError} />}

            {/* Section: Info Lega */}
            <FormSection icon="📋" title="Informazioni Lega">
              {/* Logo lega (opzionale) */}
              <div className="flex items-center gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  title={logo ? 'Cambia logo' : 'Carica logo della lega'}
                  className="group relative w-14 h-14 rounded-xl overflow-hidden bg-surface-200 border-2 border-dashed border-surface-50/40 flex items-center justify-center flex-shrink-0 hover:border-primary-500/60 transition-colors"
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
                        onClick={() => { setLogo(''); setLogoError('') }}
                        className="text-xs text-danger-400 hover:text-danger-300"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">PNG/JPG, max 500KB · modificabile dopo dal Pannello Admin.</p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>

              {logoError && (
                <div className="mb-4">
                  <AuthError message={logoError} />
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Nome Lega"
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); clearFieldError('name') }}
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
                  onChange={e => { setTeamName(e.target.value); clearFieldError('teamName') }}
                  placeholder="I Campioni FC"
                  required
                  minLength={2}
                  maxLength={30}
                  error={fieldErrors.teamName}
                />

                <Textarea
                  label="Descrizione (opzionale)"
                  value={description}
                  onChange={e => { setDescription(e.target.value); }}
                  placeholder="Una breve descrizione della lega..."
                  rows={2}
                  maxLength={500}
                  error={fieldErrors.description}
                />
              </div>
            </FormSection>

            {/* Section: Configurazione */}
            <FormSection icon="⚙️" title="Configurazione">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-200 rounded-xl p-4 border border-surface-50/20">
                  <NumberStepper
                    label="Max Partecipanti"
                    value={maxParticipants}
                    onChange={setMaxParticipants}
                    min={6}
                    max={20}
                    error={fieldErrors.maxParticipants}
                  />
                </div>

                <div className="bg-surface-200 rounded-xl p-4 border border-surface-50/20">
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
            </FormSection>

            {/* Section: Visibilità */}
            <FormSection icon="🔒" title="Visibilità">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setIsPublic(false); }}
                  aria-pressed={!isPublic}
                  className={`text-left rounded-xl p-4 border-2 transition-all duration-200 ${
                    !isPublic
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-surface-50/20 bg-surface-200 hover:border-surface-50/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">🔒</span>
                    <span className="font-display font-bold text-white">Privata</span>
                    {!isPublic && (
                      <span className="ml-auto text-[10px] font-mono font-bold uppercase tracking-wider text-primary-400 border border-primary-500/40 rounded px-1.5 py-0.5">
                        Scelta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Accessibile solo su invito tramite codice. Non compare nella ricerca pubblica.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsPublic(true); }}
                  aria-pressed={isPublic}
                  className={`text-left rounded-xl p-4 border-2 transition-all duration-200 ${
                    isPublic
                      ? 'border-secondary-500 bg-secondary-500/10'
                      : 'border-surface-50/20 bg-surface-200 hover:border-surface-50/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">🌐</span>
                    <span className="font-display font-bold text-white">Pubblica</span>
                    {isPublic && (
                      <span className="ml-auto text-[10px] font-mono font-bold uppercase tracking-wider text-secondary-400 border border-secondary-500/40 rounded px-1.5 py-0.5">
                        Scelta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Ricercabile da tutti: chiunque può trovarla e richiedere di unirsi.
                  </p>
                </button>
              </div>
            </FormSection>

            {/* Section: Slot Rosa */}
            <FormSection icon="👥" title="Slot Rosa">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SLOT_CONFIG.map(({ position, label, min, max }) => {
                  const { value, field } = slotValues[position]
                  const setter = slotSetters[field]
                  return (
                    <div
                      key={position}
                      className="bg-surface-200 rounded-xl p-4 border border-surface-50/20 text-center"
                    >
                      <PlayerRoleBadge position={position} className="mx-auto mb-3" />
                      <NumberStepper
                        value={value}
                        onChange={setter ?? (() => {})}
                        min={min}
                        max={max}
                        size="sm"
                        error={fieldErrors[field]}
                      />
                      <p className={`text-xs mt-2 ${POSITION_TEXT_COLORS[position] ?? 'text-gray-400'}`}>{label}</p>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-surface-50/20">
                <span className="micro-label">Totale slot rosa</span>
                <span className="stat-number text-3xl text-accent-400">{totalSlots}</span>
              </div>
            </FormSection>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
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
      </main>
    </div>
  )
}
