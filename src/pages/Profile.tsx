import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/Button'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'
import { NotificationPreferences } from '@/components/profile/NotificationPreferences'
import { MyTeamsList, type ProfileLeagueMembership } from '@/components/profile/MyTeamsList'
import { userApi } from '@/services/api'

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
  leagueMemberships: ProfileLeagueMembership[]
}

interface IdentityCardProps {
  username: string
  email: string
  emailVerified: boolean
  currentPhoto?: string | null
  onChanged: () => void
}

/** Identità utente consolidata: avatar + nome + email in un unico blocco (no ripetizioni). */
function IdentityCard({ username, email, emailVerified, currentPhoto, onChanged }: IdentityCardProps) {
  const { confirm: confirmDialog } = useConfirmDialog()
  const { toast } = useToast()

  const { fileInputRef, openPicker, handleFileChange, isReading } = usePhotoUpload({
    onError: (message) => { toast.error(message) },
    onPhotoReady: async (base64) => {
      const result = await userApi.updateProfilePhoto(base64)
      if (result.success) {
        toast.success('Foto profilo aggiornata!')
        onChanged()
      } else {
        toast.error(result.message || "Errore nell'aggiornamento della foto")
      }
    },
  })

  async function handleRemovePhoto() {
    const ok = await confirmDialog({
      title: 'Rimuovi foto',
      message: 'Sei sicuro di voler rimuovere la foto profilo?',
      confirmLabel: 'Rimuovi',
      variant: 'danger',
    })
    if (!ok) return

    const result = await userApi.removeProfilePhoto()
    if (result.success) {
      toast.success('Foto profilo rimossa')
      onChanged()
    } else {
      toast.error(result.message || 'Errore nella rimozione della foto')
    }
  }

  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={openPicker}
            disabled={isReading}
            className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-surface-50/30 hover:border-primary-500/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Cambia foto profilo"
          >
            {currentPhoto ? (
              <img src={currentPhoto} alt="Foto profilo" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-display font-extrabold">
                {username[0]?.toUpperCase() || '?'}
              </span>
            )}
          </button>
          {isReading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold text-white truncate">{username}</h1>
          <div className="flex items-center gap-1.5 text-[12.5px] text-gray-500">
            <span className="truncate">{email}</span>
            <Lock size={11} className="flex-shrink-0 text-gray-500" aria-hidden="true" />
          </div>
          {emailVerified && (
            <span className="inline-flex items-center gap-1.5 mt-1.5 micro-label text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2 py-0.5">
              ✓ Email verificata
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-surface-50/20">
        <button
          type="button"
          onClick={openPicker}
          disabled={isReading}
          className="min-h-[44px] px-4 rounded-lg border border-surface-50/30 bg-surface-300 text-sm font-semibold text-white hover:bg-surface-100 transition-colors disabled:opacity-50"
        >
          Cambia foto
        </button>
        {currentPhoto && (
          <button
            type="button"
            onClick={() => void handleRemovePhoto()}
            disabled={isReading}
            className="min-h-[44px] px-4 rounded-lg border border-danger-500/40 bg-danger-500/10 text-sm font-semibold text-danger-400 hover:bg-danger-500/20 transition-colors disabled:opacity-50"
          >
            Rimuovi foto
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">PNG/JPG, max 500KB</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
      />
    </section>
  )
}

export function Profile({ onNavigate }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    const result = await userApi.getProfile()
    if (result.success && result.data) {
      setProfile(result.data as UserProfile)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const username = profile?.username ?? ''
  const email = profile?.email ?? ''

  return (
    <div className="min-h-screen">
      <Navigation currentPage="profile" onNavigate={onNavigate} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
        <IdentityCard
          username={username}
          email={email}
          emailVerified={profile?.emailVerified ?? false}
          currentPhoto={profile?.profilePhoto}
          onChanged={() => void loadProfile()}
        />

        <ChangePasswordForm />

        <NotificationPreferences />

        {profile?.leagueMemberships && (
          <MyTeamsList
            memberships={profile.leagueMemberships}
            onOpenLeague={(leagueId) => { onNavigate('leagueDetail', { leagueId }) }}
          />
        )}

        <div className="pt-2 text-center">
          <Button variant="outline" onClick={() => { onNavigate('dashboard') }}>
            Torna alla Dashboard
          </Button>
        </div>
      </main>
    </div>
  )
}
