import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react'
import { userApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'

interface ProfileProps {
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface UserProfile {
  id: string
  email: string
  username: string
  profilePhoto?: string
  emailVerified: boolean
  createdAt: string
  leagueMemberships: Array<{
    id: string
    role: string
    teamName?: string
    status: string
    currentBudget: number
    league: { id: string; name: string; status: string }
  }>
}

export function Profile({ onNavigate }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const result = await userApi.getProfile()
    if (result.success && result.data) {
      setProfile(result.data as UserProfile)
    }
    setIsLoading(false)
  }

  function handlePhotoClick() {
    fileInputRef.current?.click()
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine valido')
      return
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      setError('L\'immagine deve essere inferiore a 500KB')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setPhotoPreview(base64)

      // Upload immediately
      setIsSaving(true)
      setError('')
      const result = await userApi.updateProfilePhoto(base64)
      if (result.success) {
        setSuccess('Foto profilo aggiornata!')
        loadProfile()
      } else {
        setError(result.message || 'Errore nell\'aggiornamento della foto')
        setPhotoPreview(null)
      }
      setIsSaving(false)
    }
    reader.readAsDataURL(file)
  }

  async function handleRemovePhoto() {
    if (!confirm('Sei sicuro di voler rimuovere la foto profilo?')) return

    setIsSaving(true)
    setError('')
    const result = await userApi.removeProfilePhoto()
    if (result.success) {
      setSuccess('Foto profilo rimossa')
      setPhotoPreview(null)
      loadProfile()
    } else {
      setError(result.message || 'Errore nella rimozione della foto')
    }
    setIsSaving(false)
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
      setPasswordError('Tutti i campi sono obbligatori')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('La nuova password deve essere di almeno 6 caratteri')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setPasswordError('Le password non corrispondono')
      return
    }

    setIsChangingPassword(true)
    const result = await userApi.changePassword(passwordData)

    if (result.success) {
      setPasswordSuccess('Password modificata con successo!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setShowPasswordForm(false)
    } else {
      setPasswordError(result.message || 'Errore nel cambio password')
    }
    setIsChangingPassword(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  const currentPhoto = photoPreview || profile?.profilePhoto

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="profile" onNavigate={onNavigate} />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-surface-200 rounded-2xl border border-surface-50/20 overflow-hidden">
          {/* Header */}
          <div className="p-8 border-b border-surface-50/20 bg-gradient-to-r from-surface-300 to-surface-200">
            <h1 className="text-3xl font-bold text-white">Il tuo Profilo</h1>
            <p className="text-gray-400 mt-1">Gestisci le impostazioni del tuo account</p>
          </div>

          <div className="p-8">
            {error && (
              <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-4 rounded-xl mb-6">
                {success}
              </div>
            )}

            {/* Profile Photo Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Foto Profilo</h3>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div
                    onClick={handlePhotoClick}
                    className="w-24 h-24 rounded-full cursor-pointer overflow-hidden border-4 border-surface-50/30 hover:border-primary-500/50 transition-colors"
                  >
                    {currentPhoto ? (
                      <img
                        src={currentPhoto}
                        alt="Foto profilo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-bold">
                        {profile?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  {isSaving && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={handlePhotoClick} disabled={isSaving}>
                    Cambia Foto
                  </Button>
                  {currentPhoto && (
                    <Button variant="ghost" size="sm" onClick={handleRemovePhoto} disabled={isSaving} className="text-danger-400 hover:bg-danger-500/10">
                      Rimuovi Foto
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Formati supportati: JPG, PNG, GIF. Dimensione massima: 500KB.
              </p>
            </div>

            {/* Account Info */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Informazioni Account</h3>
              <div className="space-y-4">
                <div className="bg-surface-300 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Username</p>
                  <p className="text-lg font-semibold text-white">{profile?.username}</p>
                </div>
                <div className="bg-surface-300 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p className="text-lg font-semibold text-white">{profile?.email}</p>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Password</h3>
                {!showPasswordForm && (
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                    Cambia Password
                  </Button>
                )}
              </div>

              {passwordError && (
                <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-3 rounded-lg mb-4 text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-secondary-500/20 border border-secondary-500/50 text-secondary-400 p-3 rounded-lg mb-4 text-sm">
                  {passwordSuccess}
                </div>
              )}

              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="bg-surface-300 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Password Attuale</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-400 border border-surface-50/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      placeholder="Inserisci la password attuale"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nuova Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-400 border border-surface-50/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      placeholder="Minimo 6 caratteri"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Conferma Nuova Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmNewPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmNewPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-400 border border-surface-50/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                      placeholder="Ripeti la nuova password"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword ? 'Salvataggio...' : 'Salva Password'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false)
                        setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
                        setPasswordError('')
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </form>
              )}

              {!showPasswordForm && (
                <p className="text-sm text-gray-500">
                  Per motivi di sicurezza, ti consigliamo di cambiare la password periodicamente.
                </p>
              )}
            </div>

            {/* Team Names in Leagues */}
            {profile?.leagueMemberships && profile.leagueMemberships.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Le tue Squadre</h3>
                <div className="space-y-3">
                  {profile.leagueMemberships.map(membership => (
                    <div key={membership.id} className="bg-surface-300 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white">{membership.teamName || 'Squadra senza nome'}</p>
                        <p className="text-sm text-gray-400">{membership.league.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent-400">{membership.currentBudget}</p>
                        <p className="text-xs text-gray-500">crediti</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            Torna alla Dashboard
          </Button>
        </div>
      </main>
    </div>
  )
}
