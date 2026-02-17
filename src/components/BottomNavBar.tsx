import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Zap, Users, CircleDollarSign, Menu, ArrowLeftRight, Target } from 'lucide-react'

/**
 * Mobile bottom navigation bar — visible only <768px.
 * 5 tabs: Home, Asta, Rosa, Finanze, Menu.
 * Hides on scroll-down, shows on scroll-up.
 * Only renders inside a league context (/leagues/:leagueId/...).
 */
interface BottomNavBarProps {
  onMenuOpen: () => void
  leaguePhase?: string
}

export function BottomNavBar({ onMenuOpen, leaguePhase }: BottomNavBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)

  // Extract leagueId from URL
  const leagueMatch = location.pathname.match(/^\/leagues\/([^/]+)/)
  const leagueId = leagueMatch?.[1]

  // Detect current page from URL
  const pathAfterLeague = leagueMatch ? location.pathname.slice(leagueMatch[0].length) : ''
  const currentTab = getActiveTab(pathAfterLeague)

  // Detect auction
  const isInAuction = pathAfterLeague.startsWith('/auction')

  // Scroll hide/show
  const handleScroll = useCallback(() => {
    const currentY = window.scrollY
    if (currentY > lastScrollY.current + 10 && currentY > 100) {
      setVisible(false) // scrolling down
    } else if (currentY < lastScrollY.current - 10) {
      setVisible(true) // scrolling up
    }
    lastScrollY.current = currentY
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => { window.removeEventListener('scroll', handleScroll); }
  }, [handleScroll])

  // Always show on route change
  useEffect(() => {
    setVisible(true)
  }, [location.pathname])

  // Only show inside league context
  if (!leagueId) return null

  // Dynamic middle tab based on league phase
  const phaseTab = getPhaseTab(leaguePhase, leagueId)

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', icon: Home, path: `/leagues/${leagueId}` },
    { key: 'asta', label: 'Asta', icon: Zap, path: `/leagues/${leagueId}/auction`, badge: isInAuction ? 'LIVE' : undefined },
    phaseTab,
    { key: 'finanze', label: 'Finanze', icon: CircleDollarSign, path: `/leagues/${leagueId}/financials` },
    { key: 'menu', label: 'Menu', icon: Menu, path: '' },
  ]

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-200/95 backdrop-blur-md border-t border-surface-50/20 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navigazione principale"
    >
      <div className="flex items-stretch justify-around h-14">
        {tabs.map((tab) => {
          const isActive = tab.key === currentTab
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'menu') {
                  onMenuOpen()
                } else {
                  navigate(tab.path)
                }
              }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-primary-400'
                  : 'text-gray-500 active:text-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={20} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-3 px-1 py-0 text-[8px] font-bold bg-danger-500 text-white rounded-full leading-tight animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

interface TabDef {
  key: string
  label: string
  icon: React.ComponentType<{ size: number }>
  path: string
  badge?: string
}

/** Dynamic middle tab based on current league phase */
function getPhaseTab(phase: string | undefined, leagueId: string): TabDef {
  switch (phase) {
    case 'SCAMBI':
      return { key: 'phase', label: 'Scambi', icon: ArrowLeftRight, path: `/leagues/${leagueId}/trades` }
    case 'RUBATA':
      return { key: 'phase', label: 'Rubata', icon: Target, path: `/leagues/${leagueId}/rubata` }
    default:
      return { key: 'rosa', label: 'Rosa', icon: Users, path: `/leagues/${leagueId}/strategie-rubata` }
  }
}

/** Map URL path segment to active tab key */
function getActiveTab(pathAfterLeague: string): string {
  if (!pathAfterLeague || pathAfterLeague === '/') return 'home'
  if (pathAfterLeague.startsWith('/auction') || pathAfterLeague.startsWith('/svincolati')) return 'asta'
  if (pathAfterLeague.startsWith('/trades') || pathAfterLeague.startsWith('/rubata')) return 'phase'
  if (pathAfterLeague.startsWith('/strategie-rubata') || pathAfterLeague.startsWith('/rose') || pathAfterLeague.startsWith('/all-players')) return 'rosa'
  if (pathAfterLeague.startsWith('/financials') || pathAfterLeague.startsWith('/contracts') || pathAfterLeague.startsWith('/movements') || pathAfterLeague.startsWith('/history')) return 'finanze'
  return 'home' // default
}

export default BottomNavBar
