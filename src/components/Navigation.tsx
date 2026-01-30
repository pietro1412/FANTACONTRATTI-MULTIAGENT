import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { superadminApi } from '../services/api'
import { Button } from './ui/Button'
import { Notifications } from './Notifications'
import { PendingInvites } from './PendingInvites'
import { FeedbackBadge } from './FeedbackBadge'
import { pusherClient } from '../services/pusher.client'
import { ThemeSelector, ThemeButton } from './ThemeSelector'

interface NavigationProps {
  currentPage: string
  leagueId?: string
  leagueName?: string
  teamName?: string
  isLeagueAdmin?: boolean
  activeTab?: string
  isInAuction?: boolean
  onNavigate: (page: string, params?: Record<string, string>) => void
}

// SVG Icons for menu items
const MenuIcons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  admin: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  roster: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  allRosters: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  svincolati: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  history: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  prophecy: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  back: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  leagues: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  profile: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rules: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  players: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  home: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  financials: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  strategy: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  stats: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  patchNotes: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  feedbackHub: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
}

// League menu items configuration
// Note: Contratti, Scambi, Rubata are phase-specific and accessible from Rose or Dashboard when active
// Note: Rose e Svincolati sono ora integrati nella pagina Strategie (renamed to Giocatori)
const LEAGUE_MENU_ITEMS = [
  { key: 'leagueDetail', label: 'Dashboard', adminOnly: false, icon: 'dashboard' },
  { key: 'adminPanel', label: 'Admin', adminOnly: true, icon: 'admin' },
  { key: 'strategie-rubata', label: 'Giocatori', adminOnly: false, icon: 'allRosters' },
  // { key: 'playerStats', label: 'Statistiche', adminOnly: false, icon: 'stats' },  // Temporarily hidden - route still works
  { key: 'financials', label: 'Finanze', adminOnly: false, icon: 'financials' },
  { key: 'history', label: 'Storico', adminOnly: false, icon: 'history' },
  { key: 'prophecies', label: 'Profezie', adminOnly: false, icon: 'prophecy' },
  { key: 'feedbackHub', label: 'Feedback', adminOnly: false, icon: 'feedbackHub' },
]

// Get page display name for breadcrumbs (should match menu labels)
function getPageDisplayName(page: string): string {
  const pageNames: Record<string, string> = {
    leagueDetail: 'Dashboard',
    adminPanel: 'Admin',
    rose: 'Rose',
    playerStats: 'Statistiche',
    svincolati: 'Svincolati',
    movements: 'Movimenti',
    history: 'Storico',
    prophecies: 'Profezie',
    auction: 'Asta',
    contracts: 'Contratti',
    trades: 'Scambi',
    rubata: 'Rubata',
    'strategie-rubata': 'Giocatori',
    financials: 'Finanze',
    patchNotes: 'Patch Notes',
    feedbackHub: 'Feedback',
  }
  return pageNames[page] || page
}

export function Navigation({ currentPage, leagueId, leagueName, teamName, isLeagueAdmin, activeTab, isInAuction, onNavigate }: NavigationProps) {
  const { user, logout } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [pusherConnected, setPusherConnected] = useState(false)
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSuperAdminStatus()
  }, [])

  // Monitor Pusher connection status
  useEffect(() => {
    const handleStateChange = (states: { current: string; previous: string }) => {
      setPusherConnected(states.current === 'connected')
    }

    // Set initial state
    setPusherConnected(pusherClient.connection.state === 'connected')

    pusherClient.connection.bind('state_change', handleStateChange)
    return () => {
      pusherClient.connection.unbind('state_change', handleStateChange)
    }
  }, [])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        // Check if click was on the toggle button
        const target = event.target as HTMLElement
        if (!target.closest('[data-testid="mobile-menu-toggle"]')) {
          setMobileMenuOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen])

  // Close mobile menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Handle keyboard navigation for profile dropdown
  const handleProfileKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setProfileDropdownOpen(!profileDropdownOpen)
    } else if (event.key === 'Escape') {
      setProfileDropdownOpen(false)
    }
  }, [profileDropdownOpen])

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
    <>
    <header className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20 sticky top-0 z-40 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="max-w-full mx-auto px-4 py-2.5">
        <div className="flex justify-between items-center">
          {/* Left side: Mobile menu button + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button - a sinistra */}
            <button
              className="lg:hidden text-gray-400 hover:text-white p-2 hover:bg-surface-300/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            >
              <svg className={`w-6 h-6 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Logo */}
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-3 group transition-all duration-300 hover:scale-[1.02]"
              data-testid="logo-button"
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center shadow-glow transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(49,151,149,0.5)]">
                <span className="text-xl transform group-hover:scale-110 transition-transform duration-300">⚽</span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/10 to-transparent" />
                {/* Pusher connection indicator */}
                {pusherConnected && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-secondary-500 rounded-full border-2 border-surface-200 shadow-sm" title="Connesso in tempo reale" />
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-white leading-tight tracking-tight group-hover:text-primary-300 transition-colors duration-300">
                  Fantacontratti
                </h1>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                      Dynasty DG
                    </p>
                    <span className="text-xs text-primary-400 font-mono font-medium px-2 py-0.5 bg-primary-500/10 border border-primary-500/20 rounded">
                      {__APP_VERSION__}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 font-mono truncate max-w-[200px]" title={__GIT_COMMIT_MESSAGE__}>
                    {__GIT_COMMIT_MESSAGE__}
                  </p>
                </div>
              </div>
            </button>

            {/* Real-time status indicators */}
            <div className="hidden sm:flex items-center gap-2">
              {/* Admin Badge - shown when user is league admin */}
              {leagueId && isLeagueAdmin && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-accent-500/20 to-accent-600/10 border border-accent-500/30 rounded-lg shadow-sm" data-testid="admin-badge">
                  <svg className="w-3.5 h-3.5 text-accent-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1l2.928 6.856L20 8.485l-5 4.428 1.325 7.087L10 16.5 3.675 20l1.325-7.087-5-4.428 7.072-.629L10 1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-wider">Admin</span>
                </div>
              )}

              {/* Live badge - shown when in auction room */}
              {isInAuction && pusherConnected && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-danger-500/20 to-danger-600/10 border border-danger-500/30 rounded-lg shadow-sm animate-pulse" data-testid="live-badge">
                  <div className="w-2 h-2 bg-danger-500 rounded-full" />
                  <span className="text-[10px] font-semibold text-danger-400 uppercase tracking-wider">Live</span>
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumbs - shown on medium screens only (hidden on lg where menu is visible) */}
          {leagueId && leagueName && (
            <nav className="hidden md:flex lg:hidden items-center gap-1.5 text-xs" aria-label="Breadcrumb" data-testid="breadcrumbs">
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-1 text-gray-400 hover:text-primary-300 transition-colors duration-200"
              >
                {MenuIcons.home}
                <span>Home</span>
              </button>
              {MenuIcons.chevronRight}
              <button
                onClick={() => onNavigate('leagueDetail', { leagueId })}
                className="text-gray-400 hover:text-primary-300 transition-colors duration-200 max-w-[120px] truncate"
                title={leagueName}
              >
                {leagueName}
              </button>
              {currentPage !== 'leagueDetail' && (
                <>
                  {MenuIcons.chevronRight}
                  <span className="text-primary-300 font-medium">{getPageDisplayName(currentPage)}</span>
                </>
              )}
            </nav>
          )}

          {/* Desktop Navigation - League Menu */}
          {leagueId && (
            <nav className="hidden lg:flex items-center gap-1 bg-surface-300/60 rounded-xl p-1 shadow-inner shadow-black/20 backdrop-blur-sm" data-testid="desktop-nav-league">
              {visibleMenuItems.map(item => (
                <NavButton
                  key={item.key}
                  label={item.label}
                  active={isActive(item.key)}
                  onClick={() => onNavigate(item.key, { leagueId })}
                  highlight={item.key === 'adminPanel'}
                  isAdmin={item.adminOnly}
                  iconKey={item.icon}
                />
              ))}
            </nav>
          )}

          {/* Desktop Navigation - No League */}
          {!leagueId && (
            <nav className={`hidden md:flex items-center bg-surface-300/60 rounded-xl shadow-inner shadow-black/20 backdrop-blur-sm ${isSuperAdmin ? 'gap-1 p-1' : 'gap-1 p-1'}`} data-testid="desktop-nav-main">
              {isSuperAdmin ? (
                <>
                  <NavButton
                    label="Quotazioni"
                    active={activeTab === 'upload' || (!activeTab && isActive('superadmin'))}
                    onClick={() => onNavigate('superadmin', { tab: 'upload' })}
                    accent
                    large
                    iconKey="upload"
                  />
                  <NavButton
                    label="Giocatori"
                    active={activeTab === 'players'}
                    onClick={() => onNavigate('superadmin', { tab: 'players' })}
                    accent
                    large
                    iconKey="players"
                  />
                  <NavButton
                    label="Leghe"
                    active={activeTab === 'leagues'}
                    onClick={() => onNavigate('superadmin', { tab: 'leagues' })}
                    accent
                    large
                    iconKey="leagues"
                  />
                  <NavButton
                    label="Utenti"
                    active={activeTab === 'users'}
                    onClick={() => onNavigate('superadmin', { tab: 'users' })}
                    accent
                    large
                    iconKey="users"
                  />
                  <NavButton
                    label="Stats API"
                    active={activeTab === 'stats'}
                    onClick={() => onNavigate('superadmin', { tab: 'stats' })}
                    accent
                    large
                    iconKey="stats"
                  />
                </>
              ) : (
                <NavButton
                  label="Le Mie Leghe"
                  active={isActive('dashboard')}
                  onClick={() => onNavigate('dashboard')}
                  iconKey="leagues"
                />
              )}
            </nav>
          )}

          {/* User info & actions */}
          <div className="flex items-center gap-2">
            {/* DEBUG: Latency Test Link - visible only in development */}
            {import.meta.env.DEV && (
              <a
                href="/test-latency"
                className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 transition-colors"
              >
                Test Latency
              </a>
            )}

            {/* Theme Selector Button */}
            <ThemeButton onClick={() => setThemeSelectorOpen(true)} />

            {/* Pending Invites - shown globally */}
            <PendingInvites onNavigate={onNavigate} />

            {/* Feedback Badge - shown globally */}
            <FeedbackBadge onNavigate={onNavigate} />

            {leagueId && (
              <>
                {/* Notifications with enhanced badge */}
                <Notifications leagueId={leagueId} isAdmin={isLeagueAdmin} onNavigate={onNavigate} />
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-surface-300/50 hover:bg-surface-300 rounded-lg transition-all duration-200 hover:shadow-md group"
                  data-testid="back-to-leagues"
                >
                  <svg className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Leghe
                </button>
              </>
            )}

            {/* User Profile Dropdown */}
            <div className="relative hidden sm:block" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                onKeyDown={handleProfileKeyDown}
                className="flex items-center gap-2.5 hover:bg-surface-300/80 rounded-xl px-3 py-2 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2 focus:ring-offset-surface-200"
                data-testid="profile-button"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
              >
                {/* Enhanced Avatar */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-primary-500/30 ring-2 ring-primary-400/30 group-hover:ring-primary-400/50 transition-all duration-200">
                    {user?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  {/* Online indicator */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-200 shadow-sm transition-colors duration-300 ${pusherConnected ? 'bg-secondary-500' : 'bg-gray-500'}`} title={pusherConnected ? 'Connesso' : 'Disconnesso'} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    {teamName ? 'DG' : 'Profilo'}
                  </p>
                  <p className="text-sm font-semibold text-white group-hover:text-primary-300 transition-colors duration-200 max-w-[100px] truncate">
                    {teamName || user?.username}
                  </p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown Menu */}
              <div
                className={`absolute right-0 mt-2 w-64 bg-surface-200 border border-surface-50/30 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 transition-all duration-200 origin-top-right ${
                  profileDropdownOpen
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                }`}
                data-testid="profile-dropdown"
                role="menu"
                aria-orientation="vertical"
              >
                {/* User info header */}
                <div className="px-4 py-3 bg-gradient-to-r from-surface-300/80 to-surface-300/40 border-b border-surface-50/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center text-white font-bold shadow-lg">
                      {user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  {/* Team info if in league */}
                  {teamName && leagueName && (
                    <div className="mt-2 pt-2 border-t border-surface-50/20">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Direttore Generale</p>
                      <p className="text-sm font-medium text-primary-300 truncate">{teamName}</p>
                      <p className="text-xs text-gray-500 truncate">{leagueName}</p>
                    </div>
                  )}
                </div>

                {/* Connection status */}
                <div className="px-4 py-2 border-b border-surface-50/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${pusherConnected ? 'bg-secondary-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-400">
                      {pusherConnected ? 'Connessione attiva' : 'Connessione non attiva'}
                    </span>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => { onNavigate('profile'); setProfileDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-300/60 transition-colors duration-150 focus:outline-none focus:bg-surface-300/60"
                    data-testid="profile-link"
                    role="menuitem"
                  >
                    {MenuIcons.profile}
                    Il Mio Profilo
                  </button>
                  <button
                    onClick={() => { onNavigate('dashboard'); setProfileDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-300/60 transition-colors duration-150 focus:outline-none focus:bg-surface-300/60"
                    role="menuitem"
                  >
                    {MenuIcons.leagues}
                    Le Mie Leghe
                  </button>
                  <button
                    onClick={() => { onNavigate('rules'); setProfileDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-300/60 transition-colors duration-150 focus:outline-none focus:bg-surface-300/60"
                    role="menuitem"
                    data-testid="rules-link"
                  >
                    {MenuIcons.rules}
                    Regole del Gioco
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-surface-50/20 py-1">
                  <button
                    onClick={() => { handleLogout(); setProfileDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 transition-colors duration-150 focus:outline-none focus:bg-danger-500/10"
                    data-testid="logout-button-dropdown"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Esci
                  </button>
                </div>
              </div>
            </div>

            {/* Logout button for smaller screens */}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex lg:hidden" data-testid="logout-button">
              Esci
            </Button>
          </div>
        </div>
      </div>

    </header>

    {/* Theme Selector Modal */}
    <ThemeSelector isOpen={themeSelectorOpen} onClose={() => setThemeSelectorOpen(false)} />

    {/* Mobile Navigation - FUORI dall'header per evitare vincoli di altezza */}
    {mobileMenuOpen && (
      <div
        className="lg:hidden fixed inset-0 z-50"
        data-testid="mobile-menu"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Slide-in Panel */}
        <div
          ref={mobileMenuRef}
          className="absolute top-0 left-0 bottom-0 w-[85vw] max-w-sm z-10 overflow-y-auto bg-surface-300"
        >
          {/* Mobile Menu Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-surface-100 border-gray-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700">
                <span className="text-xl">⚽</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Fantacontratti</h2>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Dynasty DG</p>
                    <span className="text-xs text-primary-400 font-mono font-medium px-2 py-0.5 bg-primary-500/10 border border-primary-500/20 rounded">
                      {__APP_VERSION__}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono truncate max-w-[180px]">
                    {__GIT_COMMIT_MESSAGE__}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-gray-400 hover:text-white rounded-lg bg-white/10"
              aria-label="Chiudi menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu Content */}
          <div className="p-4 space-y-3">
            {/* Mobile User Profile */}
            <div
              className="flex items-center gap-3 px-4 py-4 rounded-xl border bg-surface-100 border-gray-600"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700">
                  {user?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-300 ${pusherConnected ? 'bg-secondary-500' : 'bg-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                {teamName && (
                  <p className="text-xs mt-0.5 truncate text-primary-300">DG: {teamName}</p>
                )}
              </div>
              {isLeagueAdmin && leagueId && (
                <div className="px-2 py-0.5 rounded-full bg-accent-500/20">
                  <span className="text-[10px] font-semibold uppercase text-accent-400">Admin</span>
                </div>
              )}
            </div>

            {/* League Context Banner */}
            {leagueId && leagueName && (
              <div className="px-4 py-3 rounded-xl border bg-primary-500/10 border-primary-500/30">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Lega corrente</p>
                <p className="text-sm font-semibold truncate text-primary-300">{leagueName}</p>
              </div>
            )}

            {/* Navigation Items */}
            {leagueId ? (
              <>
                <MobileNavButton
                  label="Torna alle Leghe"
                  active={false}
                  onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false) }}
                  icon="back"
                  iconElement={MenuIcons.back}
                />
                <div className="border-t my-3 border-gray-600" />
                <p className="px-4 text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">Menu Lega</p>
                {visibleMenuItems.map(item => (
                  <MobileNavButton
                    key={item.key}
                    label={item.label}
                    active={isActive(item.key)}
                    onClick={() => { onNavigate(item.key, { leagueId }); setMobileMenuOpen(false) }}
                    highlight={item.key === 'adminPanel'}
                    isAdmin={item.adminOnly}
                    iconElement={MenuIcons[item.icon as keyof typeof MenuIcons]}
                  />
                ))}
              </>
            ) : (
              <>
                {isSuperAdmin ? (
                  <>
                    <p className="px-4 text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2">Super Admin</p>
                    <MobileNavButton
                      label="Quotazioni"
                      active={activeTab === 'upload' || (!activeTab && isActive('superadmin'))}
                      onClick={() => { onNavigate('superadmin', { tab: 'upload' }); setMobileMenuOpen(false) }}
                      accent
                      iconElement={MenuIcons.upload}
                    />
                    <MobileNavButton
                      label="Giocatori"
                      active={activeTab === 'players'}
                      onClick={() => { onNavigate('superadmin', { tab: 'players' }); setMobileMenuOpen(false) }}
                      accent
                      iconElement={MenuIcons.players}
                    />
                    <MobileNavButton
                      label="Leghe"
                      active={activeTab === 'leagues'}
                      onClick={() => { onNavigate('superadmin', { tab: 'leagues' }); setMobileMenuOpen(false) }}
                      accent
                      iconElement={MenuIcons.leagues}
                    />
                    <MobileNavButton
                      label="Utenti"
                      active={activeTab === 'users'}
                      onClick={() => { onNavigate('superadmin', { tab: 'users' }); setMobileMenuOpen(false) }}
                      accent
                      iconElement={MenuIcons.users}
                    />
                    <MobileNavButton
                      label="Stats API"
                      active={activeTab === 'stats'}
                      onClick={() => { onNavigate('superadmin', { tab: 'stats' }); setMobileMenuOpen(false) }}
                      accent
                      iconElement={MenuIcons.stats}
                    />
                    <div className="border-t my-3 border-gray-600" />
                    <MobileNavButton
                      label="Il Mio Profilo"
                      active={isActive('profile')}
                      onClick={() => { onNavigate('profile'); setMobileMenuOpen(false) }}
                      iconElement={MenuIcons.profile}
                    />
                  </>
                ) : (
                  <>
                    <MobileNavButton
                      label="Le Mie Leghe"
                      active={isActive('dashboard')}
                      onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false) }}
                      iconElement={MenuIcons.leagues}
                    />
                    <MobileNavButton
                      label="Il Mio Profilo"
                      active={isActive('profile')}
                      onClick={() => { onNavigate('profile'); setMobileMenuOpen(false) }}
                      iconElement={MenuIcons.profile}
                    />
                    <MobileNavButton
                      label="Regole del Gioco"
                      active={isActive('rules')}
                      onClick={() => { onNavigate('rules'); setMobileMenuOpen(false) }}
                      iconElement={MenuIcons.rules}
                    />
                  </>
                )}
              </>
            )}

            {/* Theme Selector for Mobile */}
            <div className="border-t my-3 pt-3 border-gray-600">
              <button
                onClick={() => { setThemeSelectorOpen(true); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-surface-300/60 hover:text-white transition-colors"
                data-testid="mobile-theme-selector"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Personalizza Tema
              </button>
            </div>

            {/* Mobile Logout */}
            <div className="border-t my-3 pt-3 border-gray-600">
              <button
                onClick={() => { handleLogout(); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger-400 hover:bg-danger-500/10 transition-colors"
                data-testid="mobile-logout"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>

            {/* Connection Status Footer */}
            <div className="px-4 py-3 mt-4 rounded-xl bg-surface-100">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pusherConnected ? 'bg-secondary-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">
                  {pusherConnected ? 'Connessione in tempo reale attiva' : 'Connessione non attiva'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

interface NavButtonProps {
  label: string
  active: boolean
  onClick: () => void
  accent?: boolean
  highlight?: boolean
  large?: boolean
  isAdmin?: boolean
  iconKey?: string
}

function NavButton({ label, active, onClick, accent, highlight, large, isAdmin, iconKey }: NavButtonProps) {
  const baseClasses = large
    ? 'relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 whitespace-nowrap group focus:outline-none focus:ring-2 focus:ring-primary-400/50'
    : 'relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 whitespace-nowrap group focus:outline-none focus:ring-2 focus:ring-primary-400/50'

  // Get icon for the nav button
  const getIcon = () => {
    if (isAdmin) {
      return (
        <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1l2.928 6.856L20 8.485l-5 4.428 1.325 7.087L10 16.5 3.675 20l1.325-7.087-5-4.428 7.072-.629L10 1z" clipRule="evenodd" />
        </svg>
      )
    }
    if (iconKey && MenuIcons[iconKey as keyof typeof MenuIcons]) {
      return <span className="transition-transform duration-200 group-hover:scale-110">{MenuIcons[iconKey as keyof typeof MenuIcons]}</span>
    }
    return null
  }

  const icon = getIcon()

  // Admin/highlight items get gold accent
  if (highlight || isAdmin) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${
          active
            ? 'bg-gradient-to-r from-accent-500/30 to-accent-600/20 text-accent-300 shadow-md shadow-accent-500/20 scale-[1.02]'
            : 'text-accent-400 hover:bg-accent-500/15 hover:text-accent-300 hover:scale-[1.02]'
        }`}
        data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {/* Active indicator - left bar instead of underline for better visibility */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/4 bg-accent-400 rounded-full" />
        )}
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${
        active
          ? accent
            ? 'bg-gradient-to-r from-accent-500/30 to-accent-600/20 text-accent-300 shadow-md shadow-accent-500/20 scale-[1.02]'
            : 'bg-gradient-to-r from-primary-500/30 to-primary-600/20 text-primary-300 shadow-md shadow-primary-500/20 scale-[1.02]'
          : accent
            ? 'text-accent-400 hover:bg-accent-500/15 hover:text-accent-300 hover:scale-[1.02]'
            : 'text-gray-300 hover:text-white hover:bg-surface-300/80 hover:scale-[1.02]'
      }`}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Active indicator - left bar for better visibility */}
      {active && (
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/4 rounded-full ${accent ? 'bg-accent-400' : 'bg-primary-400'}`} />
      )}
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  )
}

interface MobileNavButtonProps {
  label: string
  active: boolean
  onClick: () => void
  accent?: boolean
  highlight?: boolean
  icon?: 'back'
  isAdmin?: boolean
  iconElement?: React.ReactNode
}

function MobileNavButton({ label, active, onClick, accent, highlight, icon, isAdmin, iconElement }: MobileNavButtonProps) {
  const baseClasses = 'w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary-400/50'

  const getClasses = () => {
    if (highlight || isAdmin) {
      return active
        ? 'bg-gradient-to-r from-accent-500/25 to-accent-600/15 text-accent-300 shadow-md shadow-accent-500/10 border-l-3 border-accent-400 scale-[1.01]'
        : 'text-accent-400 hover:bg-accent-500/15 hover:text-accent-300 hover:translate-x-1'
    }
    if (active) {
      return accent
        ? 'bg-gradient-to-r from-accent-500/25 to-accent-600/15 text-accent-300 shadow-md shadow-accent-500/10 border-l-3 border-accent-400 scale-[1.01]'
        : 'bg-gradient-to-r from-primary-500/25 to-primary-600/15 text-primary-300 shadow-md shadow-primary-500/10 border-l-3 border-primary-400 scale-[1.01]'
    }
    return accent
      ? 'text-accent-400 hover:bg-accent-500/10 hover:translate-x-1'
      : 'text-gray-300 hover:bg-surface-300/60 hover:text-white hover:translate-x-1'
  }

  // Determine which icon to show
  const renderIcon = () => {
    if (icon === 'back' && iconElement) {
      return <span className="w-5 h-5 flex items-center justify-center">{iconElement}</span>
    }
    if (icon === 'back') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      )
    }
    if ((highlight || isAdmin) && !iconElement) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1l2.928 6.856L20 8.485l-5 4.428 1.325 7.087L10 16.5 3.675 20l1.325-7.087-5-4.428 7.072-.629L10 1z" clipRule="evenodd" />
        </svg>
      )
    }
    if (iconElement) {
      return <span className="w-5 h-5 flex items-center justify-center">{iconElement}</span>
    }
    return null
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${getClasses()}`} data-testid={`mobile-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      {renderIcon()}
      <span className="flex-1 font-medium">{label}</span>
      {active && (
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${highlight || isAdmin || accent ? 'bg-accent-400' : 'bg-primary-400'} animate-pulse`} />
        </div>
      )}
    </button>
  )
}
