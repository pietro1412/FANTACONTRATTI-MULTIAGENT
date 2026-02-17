import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface Session {
  id: string
  type: string
  status: string
  currentPhase: string
  phaseStartedAt: string | null
}

interface AdminBannerProps {
  leagueStatus: string
  isAdmin: boolean
  activeSession: Session | null
  isFirstMarketCompleted: boolean
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
  onOpenAuctionClick: () => void
}

const PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta Primo Mercato',
  PREMI: 'Assegnazione Premi Budget',
  OFFERTE_PRE_RINNOVO: 'Scambi e Offerte',
  CONTRATTI: 'Rinnovo Contratti',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Asta Svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Scambi Finali',
}

function getPhaseNavTarget(phase: string, sessionId: string, leagueId: string): { page: string; params: Record<string, string> } {
  switch (phase) {
    case 'ASTA_LIBERA': return { page: 'auction', params: { sessionId, leagueId } }
    case 'PREMI': return { page: 'prizes', params: { leagueId } }
    case 'OFFERTE_PRE_RINNOVO':
    case 'OFFERTE_POST_ASTA_SVINCOLATI': return { page: 'trades', params: { leagueId } }
    case 'ASTA_SVINCOLATI': return { page: 'svincolati', params: { leagueId } }
    case 'RUBATA': return { page: 'rubata', params: { leagueId } }
    case 'CONTRATTI': return { page: 'contracts', params: { leagueId } }
    default: return { page: 'auction', params: { sessionId, leagueId } }
  }
}

const PHASE_CONFIG: Record<string, { icon: string; color: string; adminOnly?: boolean }> = {
  ASTA_LIBERA: { icon: '\uD83D\uDD28', color: 'secondary' },
  PREMI: { icon: '\uD83C\uDFC6', color: 'warning', adminOnly: true },
  OFFERTE_PRE_RINNOVO: { icon: '\uD83D\uDD04', color: 'primary' },
  CONTRATTI: { icon: '\uD83D\uDCDD', color: 'accent' },
  RUBATA: { icon: '\uD83C\uDFAF', color: 'warning' },
  ASTA_SVINCOLATI: { icon: '\uD83D\uDCCB', color: 'success' },
  OFFERTE_POST_ASTA_SVINCOLATI: { icon: '\uD83D\uDD04', color: 'primary' },
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  secondary: { bg: 'from-secondary-600/30 to-secondary-500/20', border: 'border-secondary-500/50', text: 'text-secondary-400', iconBg: 'bg-secondary-500/30' },
  primary: { bg: 'from-primary-600/30 to-primary-500/20', border: 'border-primary-500/50', text: 'text-primary-400', iconBg: 'bg-primary-500/30' },
  accent: { bg: 'from-accent-600/30 to-accent-500/20', border: 'border-accent-500/50', text: 'text-accent-400', iconBg: 'bg-accent-500/30' },
  warning: { bg: 'from-warning-600/30 to-warning-500/20', border: 'border-warning-500/50', text: 'text-warning-400', iconBg: 'bg-warning-500/30' },
  success: { bg: 'from-green-600/30 to-green-500/20', border: 'border-green-500/50', text: 'text-green-400', iconBg: 'bg-green-500/30' },
}

export function AdminBanner({
  leagueStatus,
  isAdmin,
  activeSession,
  isFirstMarketCompleted,
  leagueId,
  onNavigate,
  onOpenAuctionClick,
}: AdminBannerProps) {
  // DRAFT state - direct to admin panel
  if (leagueStatus === 'DRAFT') {
    return (
      <div className="bg-gradient-to-r from-primary-600/20 to-primary-500/10 border-2 border-primary-500/40 rounded-2xl p-4 sm:p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl sm:text-3xl">{'\uD83D\uDCCB'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg sm:text-xl font-bold text-primary-400">Creazione Lega</h2>
              {isAdmin && <Badge variant="warning" size="sm">ADMIN</Badge>}
            </div>
            <p className="text-gray-300 text-sm">
              {isAdmin
                ? 'Attiva la Lega dal Pannello Admin per avviare le aste'
                : "In attesa che l'admin attivi la lega"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button size="lg" onClick={() => { onNavigate('admin', { leagueId }); }} className="flex-shrink-0">
            Pannello Admin
          </Button>
        )}
      </div>
    )
  }

  // ACTIVE, no session - waiting for market
  if (leagueStatus === 'ACTIVE' && !activeSession) {
    return (
      <div className="bg-gradient-to-r from-primary-600/20 to-primary-500/10 border-2 border-primary-500/40 rounded-2xl p-4 sm:p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl sm:text-3xl">{isFirstMarketCompleted ? '\uD83D\uDD04' : '\u23F3'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg sm:text-xl font-bold text-primary-400">
                {isFirstMarketCompleted ? 'In Attesa del Mercato Ricorrente' : 'In Attesa del Primo Mercato'}
              </h2>
            </div>
            <p className="text-gray-300 text-sm">
              {isAdmin
                ? isFirstMarketCompleted
                  ? 'Avvia la sessione per iniziare il mercato ricorrente (Scambi, Rinnovi, Rubata, Svincolati).'
                  : "Avvia la sessione d'asta per iniziare il primo mercato."
                : isFirstMarketCompleted
                  ? "In attesa che l'admin avvii il mercato ricorrente."
                  : "In attesa che l'admin avvii la sessione d'asta."}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button size="lg" onClick={onOpenAuctionClick} className="flex-shrink-0">
            {isFirstMarketCompleted ? 'Avvia Mercato Ricorrente' : 'Avvia Primo Mercato'}
          </Button>
        )}
      </div>
    )
  }

  // Active session - clickable phase banner
  if (activeSession) {
    const phase = activeSession.currentPhase || 'ASTA_LIBERA'
    const isFirstMarket = activeSession.type === 'PRIMO_MERCATO'
    const config = PHASE_CONFIG[phase] || { icon: '\uD83D\uDD28', color: 'secondary' }
    const colors = COLOR_MAP[config.color] || COLOR_MAP.secondary
    const nav = getPhaseNavTarget(phase, activeSession.id, leagueId)
    const showButton = !(config.adminOnly && !isAdmin)

    const phaseTitle = phase === 'ASTA_LIBERA' && isFirstMarket ? 'Asta Primo Mercato' : (PHASE_LABELS[phase] || phase)

    return (
      <button
        onClick={() => { onNavigate(nav.page, nav.params); }}
        className={`bg-gradient-to-r ${colors.bg} border-2 ${colors.border} rounded-2xl p-4 sm:p-6 flex items-center justify-between w-full text-left cursor-pointer hover:translate-x-1 hover:border-primary-500/50 transition-all duration-200 group`}
        role="link"
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${colors.iconBg} flex items-center justify-center animate-pulse flex-shrink-0`}>
            <span className="text-2xl sm:text-3xl">{config.icon}</span>
          </div>
          <div className="min-w-0">
            <h2 className={`text-lg sm:text-xl font-bold ${colors.text}`}>{phaseTitle}</h2>
            <p className="text-gray-300 text-sm sm:text-base">
              {isFirstMarket && phase === 'ASTA_LIBERA'
                ? 'Costruisci la tua rosa! Entra in asta e acquista i tuoi giocatori.'
                : `Fase attiva - clicca per entrare`}
            </p>
            <span className={`text-xs ${colors.text} font-medium mt-1 inline-block md:hidden`}>
              Vai alla fase &rarr;
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {showButton && (
            <span className="hidden md:inline-block">
              <span className={`inline-flex items-center justify-center font-semibold rounded-lg px-5 py-2.5 text-base min-h-[48px] bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg`}>
                Entra nella Fase
              </span>
            </span>
          )}
          <svg className={`w-5 h-5 ${colors.text} group-hover:translate-x-1 transition-transform duration-200`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    )
  }

  return null
}
