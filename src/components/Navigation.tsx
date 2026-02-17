import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { superadminApi } from '../services/api'
import { Button } from './ui/Button'
import { Notifications } from './Notifications'
import { PendingInvites } from './PendingInvites'
import { FeedbackBadge } from './FeedbackBadge'
import { pusherClient } from '../services/pusher.client'
import {
  Home, Settings, User, Users, UserPlus, Clock, Lightbulb,
  ArrowLeft, Trophy, CircleUserRound, BookOpen, CloudUpload,
  CircleDollarSign, ChevronRight, ChevronDown, ShieldCheck,
  BarChart3, FileText, MessageSquare, Menu, X, Star, LogOut,
} from 'lucide-react'

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

// Icons for menu items — using lucide-react (tree-shakeable)
const ICON_SIZE = 16 // w-4 h-4
const MenuIcons = {
  dashboard: <Home size={ICON_SIZE} />,
  admin: <Settings size={ICON_SIZE} />,
  roster: <User size={ICON_SIZE} />,
  allRosters: <Users size={ICON_SIZE} />,
  svincolati: <UserPlus size={ICON_SIZE} />,
  history: <Clock size={ICON_SIZE} />,
  prophecy: <Lightbulb size={ICON_SIZE} />,
  back: <ArrowLeft size={ICON_SIZE} />,
  leagues: <Trophy size={ICON_SIZE} />,
  profile: <CircleUserRound size={ICON_SIZE} />,
  rules: <BookOpen size={ICON_SIZE} />,
  upload: <CloudUpload size={ICON_SIZE} />,
  players: <Users size={ICON_SIZE} />,
  users: <Users size={ICON_SIZE} />,
  home: <Home size={ICON_SIZE} />,
  financials: <CircleDollarSign size={ICON_SIZE} />,
  chevronRight: <ChevronRight size={12} className="text-gray-500" />,
  strategy: <ShieldCheck size={ICON_SIZE} />,
  stats: <BarChart3 size={ICON_SIZE} />,
  patchNotes: <FileText size={ICON_SIZE} />,
  feedbackHub: <MessageSquare size={ICON_SIZE} />,
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
    return () => { document.removeEventListener('mousedown', handleClickOutside); }
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
    return () => { document.removeEventListener('mousedown', handleClickOutside); }
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
    return () => { document.removeEventListener('keydown', handleEscape); }
  }, [])

  // Listen for BottomNavBar "Menu" tap (custom event)
  useEffect(() => {
    const handleOpenMobileMenu = () => { setMobileMenuOpen(true); }
    window.addEventListener('open-mobile-menu', handleOpenMobileMenu)
    return () => { window.removeEventListener('open-mobile-menu', handleOpenMobileMenu); }
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
              className="lg:hidden text-gray-400 hover:text-white p-2 w-11 h-11 flex items-center justify-center hover:bg-surface-300/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); }}
              data-testid="mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            >
              {mobileMenuOpen ? (
                <X size={24} className={`transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`} />
              ) : (
                <Menu size={24} className="transition-transform duration-300" />
              )}
            </button>

            {/* Logo */}
            <button
              onClick={() => { onNavigate('dashboard'); }}
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
                  <p className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]" title={__GIT_COMMIT_MESSAGE__}>
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
                  <Star size={14} className="text-accent-400" fill="currentColor" />
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

          {/* T-023: Mobile breadcrumbs - compact, shown only on small screens */}
          {leagueId && leagueName && currentPage !== 'leagueDetail' && (
            <nav className="flex md:hidden items-center gap-1 text-[11px] mt-1" aria-label="Mobile breadcrumb">
              <button
                onClick={() => { onNavigate('leagueDetail', { leagueId }); }}
                className="text-gray-500 hover:text-primary-300 transition-colors truncate max-w-[100px]"
                title={leagueName}
              >
                {leagueName}
              </button>
              {MenuIcons.chevronRight}
              <span className="text-primary-300 font-medium truncate max-w-[100px]">{getPageDisplayName(currentPage)}</span>
            </nav>
          )}

          {/* Breadcrumbs - shown on medium screens only (hidden on lg where menu is visible) */}
          {leagueId && leagueName && (
            <nav className="hidden md:flex lg:hidden items-center gap-1.5 text-xs" aria-label="Breadcrumb" data-testid="breadcrumbs">
              <button
                onClick={() => { onNavigate('dashboard'); }}
                className="flex items-center gap-1 text-gray-400 hover:text-primary-300 transition-colors duration-200"
              >
                {MenuIcons.home}
                <span>Home</span>
              </button>
              {MenuIcons.chevronRight}
              <button
                onClick={() => { onNavigate('leagueDetail', { leagueId }); }}
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
                  onClick={() => { onNavigate(item.key, { leagueId }); }}
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
                    onClick={() => { onNavigate('superadmin', { tab: 'upload' }); }}
                    accent
                    large
                    iconKey="upload"
                  />
                  <NavButton
                    label="Giocatori"
                    active={activeTab === 'players'}
                    onClick={() => { onNavigate('superadmin', { tab: 'players' }); }}
                    accent
                    large
                    iconKey="players"
                  />
                  <NavButton
                    label="Leghe"
                    active={activeTab === 'leagues'}
                    onClick={() => { onNavigate('superadmin', { tab: 'leagues' }); }}
                    accent
                    large
                    iconKey="leagues"
                  />
                  <NavButton
                    label="Utenti"
                    active={activeTab === 'users'}
                    onClick={() => { onNavigate('superadmin', { tab: 'users' }); }}
                    accent
                    large
                    iconKey="users"
                  />
                  <NavButton
                    label="Stats API"
                    active={activeTab === 'stats'}
                    onClick={() => { onNavigate('superadmin', { tab: 'stats' }); }}
                    accent
                    large
                    iconKey="stats"
                  />
                </>
              ) : (
                <NavButton
                  label="Le Mie Leghe"
                  active={isActive('dashboard')}
                  onClick={() => { onNavigate('dashboard'); }}
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

            {/* Pending Invites - shown globally */}
            <PendingInvites onNavigate={onNavigate} />

            {/* Feedback Badge - shown globally */}
            <FeedbackBadge onNavigate={onNavigate} />

            {leagueId && (
              <>
                {/* Notifications with enhanced badge */}
                <Notifications leagueId={leagueId} isAdmin={isLeagueAdmin} onNavigate={onNavigate} />
                <button
                  onClick={() => { onNavigate('dashboard'); }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-surface-300/50 hover:bg-surface-300 rounded-lg transition-all duration-200 hover:shadow-md group"
                  data-testid="back-to-leagues"
                >
                  <ArrowLeft size={16} className="transform group-hover:-translate-x-0.5 transition-transform duration-200" />
                  Leghe
                </button>
              </>
            )}

            {/* User Profile Dropdown */}
            <div className="relative hidden sm:block" ref={profileDropdownRef}>
              <button
                onClick={() => { setProfileDropdownOpen(!profileDropdownOpen); }}
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
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
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
                    <LogOut size={16} />
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

    {/* Mobile Navigation - FUORI dall'header per evitare vincoli di altezza */}
    {mobileMenuOpen && (
      <div
        className="lg:hidden fixed inset-0 z-50"
        data-testid="mobile-menu"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => { setMobileMenuOpen(false); }}
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
              onClick={() => { setMobileMenuOpen(false); }}
              className="p-2 text-gray-400 hover:text-white rounded-lg bg-white/10"
              aria-label="Chiudi menu"
            >
              <X size={24} />
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

            {/* Mobile Logout */}
            <div className="border-t my-3 pt-3 border-gray-600">
              <button
                onClick={() => { handleLogout(); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-danger-400 hover:bg-danger-500/10 transition-colors"
                data-testid="mobile-logout"
              >
                <LogOut size={20} />
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
        <Star size={14} fill="currentColor" className="transition-transform duration-200 group-hover:scale-110" />
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
      return <ArrowLeft size={20} />
    }
    if ((highlight || isAdmin) && !iconElement) {
      return <Star size={20} fill="currentColor" />
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
