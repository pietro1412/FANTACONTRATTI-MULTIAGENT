import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { superadminApi } from '../services/api'
import { Button } from './ui/Button'
import { Notifications } from './Notifications'

interface NavigationProps {
  currentPage: string
  leagueId?: string
  isLeagueAdmin?: boolean
  activeTab?: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// League menu items configuration
const LEAGUE_MENU_ITEMS = [
  { key: 'leagueDetail', label: 'Dashboard', adminOnly: false },
  { key: 'adminPanel', label: 'Admin', adminOnly: true },
  { key: 'roster', label: 'La Mia Rosa', adminOnly: false },
  { key: 'allRosters', label: 'Tutte le Rose', adminOnly: false },
  { key: 'contracts', label: 'Contratti', adminOnly: false },
  { key: 'trades', label: 'Scambi', adminOnly: false },
  { key: 'rubata', label: 'Rubata', adminOnly: false },
  { key: 'svincolati', label: 'Svincolati', adminOnly: false },
  { key: 'allPlayers', label: 'Tutti i Giocatori', adminOnly: false },
  { key: 'movements', label: 'Storico', adminOnly: false },
]

export function Navigation({ currentPage, leagueId, isLeagueAdmin, activeTab, onNavigate }: NavigationProps) {
  const { user, logout } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    loadSuperAdminStatus()
  }, [])

  async function loadSuperAdminStatus() {
    const response = await superadminApi.getStatus()
    if (response.success && response.data) {
      setIsSuperAdmin((response.data as { isSuperAdmin: boolean }).isSuperAdmin)
    }
  }

  async function handleLogout() {
    await logout()
    onNavigate('login')
  }

  const isActive = (page: string) => currentPage === page

  // Filter menu items based on admin status
  const visibleMenuItems = LEAGUE_MENU_ITEMS.filter(item => !item.adminOnly || isLeagueAdmin)

  return (
    <header className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20 sticky top-0 z-40">
      <div className="max-w-full mx-auto px-4 py-2">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-lg">⚽</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white leading-tight">Fantacontratti</h1>
              </div>
            </button>
          </div>

          {/* Desktop Navigation - League Menu */}
          {leagueId && (
            <nav className="hidden lg:flex items-center gap-0.5 bg-surface-300/50 rounded-lg p-0.5 overflow-x-auto">
              {visibleMenuItems.map(item => (
                <NavButton
                  key={item.key}
                  label={item.label}
                  active={isActive(item.key)}
                  onClick={() => onNavigate(item.key, { leagueId })}
                  highlight={item.key === 'adminPanel'}
                />
              ))}
            </nav>
          )}

          {/* Desktop Navigation - No League */}
          {!leagueId && (
            <nav className={`hidden md:flex items-center bg-surface-300/50 rounded-lg ${isSuperAdmin ? 'gap-2 p-2' : 'gap-1 p-1'}`}>
              {isSuperAdmin ? (
                <>
                  <NavButton
                    label="Quotazioni"
                    active={activeTab === 'upload' || (!activeTab && isActive('superadmin'))}
                    onClick={() => onNavigate('superadmin', { tab: 'upload' })}
                    accent
                    large
                  />
                  <NavButton
                    label="Giocatori"
                    active={activeTab === 'players'}
                    onClick={() => onNavigate('superadmin', { tab: 'players' })}
                    accent
                    large
                  />
                  <NavButton
                    label="Leghe"
                    active={activeTab === 'leagues'}
                    onClick={() => onNavigate('superadmin', { tab: 'leagues' })}
                    accent
                    large
                  />
                  <NavButton
                    label="Utenti"
                    active={activeTab === 'users'}
                    onClick={() => onNavigate('superadmin', { tab: 'users' })}
                    accent
                    large
                  />
                </>
              ) : (
                <NavButton
                  label="Le Mie Leghe"
                  active={isActive('dashboard')}
                  onClick={() => onNavigate('dashboard')}
                />
              )}
            </nav>
          )}

          {/* User info & actions */}
          <div className="flex items-center gap-3">
            {leagueId && (
              <>
                {/* Notifications */}
                <Notifications leagueId={leagueId} onNavigate={onNavigate} />
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Leghe
                </button>
              </>
            )}
            <button
              onClick={() => onNavigate('profile')}
              className="hidden sm:flex items-center gap-2 hover:bg-surface-300 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">
                {user?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Profilo</p>
                <p className="text-sm font-semibold text-white">{user?.username}</p>
              </div>
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Esci
            </Button>

            {/* Mobile menu button */}
            <button
              className="lg:hidden text-gray-400 hover:text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mt-3 pt-3 border-t border-surface-50/20 space-y-1">
            {leagueId ? (
              <>
                <MobileNavButton
                  label="Torna alle Leghe"
                  active={false}
                  onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false) }}
                  icon="back"
                />
                <div className="border-t border-surface-50/10 my-2" />
                {visibleMenuItems.map(item => (
                  <MobileNavButton
                    key={item.key}
                    label={item.label}
                    active={isActive(item.key)}
                    onClick={() => { onNavigate(item.key, { leagueId }); setMobileMenuOpen(false) }}
                    highlight={item.key === 'adminPanel'}
                  />
                ))}
              </>
            ) : (
              <>
                {isSuperAdmin ? (
                  <>
                    <MobileNavButton
                      label="Quotazioni"
                      active={activeTab === 'upload' || (!activeTab && isActive('superadmin'))}
                      onClick={() => { onNavigate('superadmin', { tab: 'upload' }); setMobileMenuOpen(false) }}
                      accent
                    />
                    <MobileNavButton
                      label="Giocatori"
                      active={activeTab === 'players'}
                      onClick={() => { onNavigate('superadmin', { tab: 'players' }); setMobileMenuOpen(false) }}
                      accent
                    />
                    <MobileNavButton
                      label="Leghe"
                      active={activeTab === 'leagues'}
                      onClick={() => { onNavigate('superadmin', { tab: 'leagues' }); setMobileMenuOpen(false) }}
                      accent
                    />
                    <MobileNavButton
                      label="Utenti"
                      active={activeTab === 'users'}
                      onClick={() => { onNavigate('superadmin', { tab: 'users' }); setMobileMenuOpen(false) }}
                      accent
                    />
                    <div className="border-t border-surface-50/10 my-2" />
                    <MobileNavButton
                      label="Il Mio Profilo"
                      active={isActive('profile')}
                      onClick={() => { onNavigate('profile'); setMobileMenuOpen(false) }}
                    />
                  </>
                ) : (
                  <>
                    <MobileNavButton
                      label="Le Mie Leghe"
                      active={isActive('dashboard')}
                      onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false) }}
                    />
                    <MobileNavButton
                      label="Il Mio Profilo"
                      active={isActive('profile')}
                      onClick={() => { onNavigate('profile'); setMobileMenuOpen(false) }}
                    />
                  </>
                )}
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}

function NavButton({ label, active, onClick, accent, highlight, large }: { label: string; active: boolean; onClick: () => void; accent?: boolean; highlight?: boolean; large?: boolean }) {
  const baseClasses = large
    ? 'px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap'
    : 'px-2 py-1 text-xs rounded transition-colors whitespace-nowrap'

  if (highlight) {
    return (
      <button onClick={onClick} className={`${baseClasses} ${active ? 'bg-accent-500/30 text-accent-400 font-medium' : 'text-accent-400 hover:bg-accent-500/20'}`}>
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${
        active
          ? accent
            ? 'bg-accent-500/30 text-accent-400 font-medium'
            : 'bg-primary-500/30 text-primary-400 font-medium'
          : accent
            ? 'text-accent-400 hover:bg-accent-500/20'
            : 'text-gray-300 hover:text-white hover:bg-surface-300'
      }`}
    >
      {label}
    </button>
  )
}

function MobileNavButton({ label, active, onClick, accent, highlight, icon }: { label: string; active: boolean; onClick: () => void; accent?: boolean; highlight?: boolean; icon?: 'back' }) {
  const baseClasses = 'w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2'

  const getClasses = () => {
    if (highlight) {
      return active ? 'bg-accent-500/20 text-accent-400 font-medium' : 'text-accent-400 hover:bg-accent-500/10'
    }
    if (active) {
      return accent ? 'bg-accent-500/20 text-accent-400 font-medium' : 'bg-primary-500/20 text-primary-400 font-medium'
    }
    return accent ? 'text-accent-400 hover:bg-accent-500/10' : 'text-gray-300 hover:bg-surface-300'
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${getClasses()}`}>
      {icon === 'back' && (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      )}
      {label}
    </button>
  )
}
