import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Users, CircleDollarSign, Menu, Zap, ArrowLeftRight, Target, FileSignature, UserPlus } from 'lucide-react'
import { getPhaseNavItem } from '../lib/navItems'

/**
 * Mobile bottom navigation bar — visible only <768px.
 * 5 tab: Home, [voce-di-fase], Giocatori, Finanze, Menu.
 * La voce centrale è derivata dalla FASE CORRENTE della lega (stessa logica
 * di Navigation, via getPhaseNavItem). Quando non c'è una fase con sezione
 * dedicata, la voce centrale ricade su "Rosa".
 * Si nasconde scrollando in giù, riappare scrollando in su.
 * Renderizza solo dentro una lega (/leagues/:leagueId/...).
 */
interface BottomNavBarProps {
  onMenuOpen: () => void
  /** currentPhase della sessione attiva (enum MarketPhase) — fornita da App. */
  leaguePhase?: string | null
  /** id sessione attiva: serve per aprire l'asta (route /auction/:sessionId). */
  activeSessionId?: string | null
}

export function BottomNavBar({ onMenuOpen, leaguePhase, activeSessionId }: BottomNavBarProps) {
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

  // Voce centrale derivata dalla fase (stessa sorgente di Navigation)
  const phaseTab = getPhaseTab(leaguePhase, leagueId, activeSessionId)

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', icon: Home, path: `/leagues/${leagueId}` },
    phaseTab,
    { key: 'giocatori', label: 'Giocatori', icon: UserPlus, path: `/leagues/${leagueId}/players` },
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
                  void navigate(tab.path)
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

// Icone per le voci di fase (coerenti con MenuIcons di Navigation)
const PHASE_TAB_ICONS: Record<string, React.ComponentType<{ size: number }>> = {
  auction: Zap,
  trades: ArrowLeftRight,
  contracts: FileSignature,
  rubata: Target,
  svincolati: UserPlus,
}

/**
 * Voce centrale derivata dalla fase corrente. Usa getPhaseNavItem (sorgente unica).
 * Nessuna fase con sezione dedicata (es. PREMI / nessuna sessione) → "Rosa".
 */
function getPhaseTab(
  phase: string | null | undefined,
  leagueId: string,
  activeSessionId: string | null | undefined,
): TabDef {
  const item = getPhaseNavItem(phase)
  if (!item) {
    return { key: 'rosa', label: 'Rosa', icon: Users, path: `/leagues/${leagueId}/rose` }
  }

  const icon = PHASE_TAB_ICONS[item.key] ?? Users

  // Mappa la chiave della voce sul path reale della sezione
  const pathByKey: Record<string, string> = {
    auction: `/leagues/${leagueId}/auction/${activeSessionId ?? ''}`,
    trades: `/leagues/${leagueId}/trades`,
    contracts: `/leagues/${leagueId}/contracts`,
    rubata: `/leagues/${leagueId}/rubata`,
    svincolati: `/leagues/${leagueId}/svincolati`,
  }

  const isAuctionLive =
    (item.key === 'auction' || item.key === 'svincolati' || item.key === 'rubata')

  return {
    key: 'phase',
    label: item.label,
    icon,
    path: pathByKey[item.key] ?? `/leagues/${leagueId}`,
    badge: isAuctionLive ? 'LIVE' : undefined,
  }
}

/** Map URL path segment to active tab key */
function getActiveTab(pathAfterLeague: string): string {
  if (!pathAfterLeague || pathAfterLeague === '/') return 'home'
  if (
    pathAfterLeague.startsWith('/auction') ||
    pathAfterLeague.startsWith('/svincolati') ||
    pathAfterLeague.startsWith('/trades') ||
    pathAfterLeague.startsWith('/rubata') ||
    pathAfterLeague.startsWith('/contracts')
  ) return 'phase'
  if (pathAfterLeague.startsWith('/rose')) return 'rosa'
  if (
    pathAfterLeague.startsWith('/players') ||
    pathAfterLeague.startsWith('/strategie-rubata')
  ) return 'giocatori'
  if (
    pathAfterLeague.startsWith('/financials') ||
    pathAfterLeague.startsWith('/movements') ||
    pathAfterLeague.startsWith('/history')
  ) return 'finanze'
  return 'home' // default
}

export default BottomNavBar
