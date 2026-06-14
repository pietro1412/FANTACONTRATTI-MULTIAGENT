import { useState, useEffect } from 'react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/Button'
import { ProfilePhotoSection } from '@/components/profile/ProfilePhotoSection'
import { AccountInfo } from '@/components/profile/AccountInfo'
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
        {/* Testata profilo */}
        <header className="flex items-center gap-4 bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
          <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-surface-50/30">
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="Foto profilo" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-display font-extrabold">
                {username[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-white truncate">{username}</h1>
            <p className="text-[12.5px] text-gray-500 truncate">{email}</p>
            {profile?.emailVerified && (
              <span className="inline-flex items-center gap-1.5 mt-1.5 micro-label text-secondary-400 bg-secondary-500/10 border border-secondary-500/35 rounded-full px-2 py-0.5">
                ✓ Email verificata
              </span>
            )}
          </div>
        </header>

        <ProfilePhotoSection
          username={username}
          currentPhoto={profile?.profilePhoto}
          onChanged={() => void loadProfile()}
        />

        <AccountInfo username={username} email={email} />

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
