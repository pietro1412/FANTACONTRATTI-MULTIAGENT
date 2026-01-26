import { useState, useEffect } from 'react'
import { leagueApi, auctionApi, superadminApi } from '../services/api'
import { Button } from '../components/ui/Button'
import { Navigation } from '../components/Navigation'

interface LeagueDetailProps {
  leagueId: string
  onNavigate: (page: string, params?: Record<string, string>) => void
}

interface League {
  id: string
  name: string
  description?: string
  minParticipants: number
  maxParticipants: number
  initialBudget: number
  status: string
  goalkeeperSlots: number
  defenderSlots: number
  midfielderSlots: number
  forwardSlots: number
  members: Array<{
    id: string
    role: string
    status: string
    currentBudget: number
    teamName?: string
    user: { id: string; username: string; profilePhoto?: string }
  }>
}

interface Session {
  id: string
  type: string
  status: string
  currentPhase: string
  createdAt: string
  startsAt: string | null
  phaseStartedAt: string | null
}

// Mapping fasi a nomi user-friendly
const PHASE_LABELS: Record<string, string> = {
  ASTA_LIBERA: 'Asta Primo Mercato',
  PREMI: 'Assegnazione Premi Budget',
  OFFERTE_PRE_RINNOVO: 'Scambi e Offerte',
  CONTRATTI: 'Rinnovo Contratti',
  RUBATA: 'Rubata',
  ASTA_SVINCOLATI: 'Asta Svincolati',
  OFFERTE_POST_ASTA_SVINCOLATI: 'Scambi Finali',
}

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  P: { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-amber-400' },
  D: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-blue-400' },
  C: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-emerald-400' },
  A: { bg: 'bg-gradient-to-r from-red-500 to-red-600', text: 'text-red-400' },
}

export function LeagueDetail({ leagueId, onNavigate }: LeagueDetailProps) {
  const [league, setLeague] = useState<League | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembership, setUserMembership] = useState<{ id: string; currentBudget: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLeaving, setIsLeaving] = useState(false)
  const [showAuctionConfirm, setShowAuctionConfirm] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkSuperAdmin() {
      const response = await superadminApi.getStatus()
      if (response.success && response.data) {
        const data = response.data as { isSuperAdmin: boolean }
        setIsSuperAdmin(data.isSuperAdmin)
        if (data.isSuperAdmin) {
          // Redirect superadmins away - they shouldn't access league details
          onNavigate('dashboard')
          return
        }
      } else {
        setIsSuperAdmin(false)
      }
      // Only load league data if not superadmin
      loadLeague()
      loadSessions()
    }
    checkSuperAdmin()
  }, [leagueId, onNavigate])

  async function loadLeague() {
    const result = await leagueApi.getById(leagueId)
    if (result.success && result.data) {
      const data = result.data as { league: League; isAdmin: boolean; userMembership: { id: string; currentBudget: number } }
      setLeague(data.league)
      setIsAdmin(data.isAdmin)
      setUserMembership(data.userMembership)
    }
    setIsLoading(false)
  }

  async function loadSessions() {
    const result = await auctionApi.getSessions(leagueId)
    if (result.success && result.data) {
      setSessions(result.data as Session[])
    }
  }

  function handleOpenAuctionClick() {
    setShowAuctionConfirm(true)
  }

  async function handleConfirmCreateSession() {
    setError('')
    setIsCreatingSession(true)
    // Se il primo mercato è completato, crea un mercato ricorrente
    const isRegularMarket = isFirstMarketCompleted()
    const result = await auctionApi.createSession(leagueId, isRegularMarket)
    if (result.success) {
      setShowAuctionConfirm(false)
      loadSessions()
    } else {
      setError(result.message || 'Errore nella creazione della sessione')
    }
    setIsCreatingSession(false)
  }

  async function handleLeaveLeague() {
    if (!confirm('Sei sicuro di voler abbandonare questa lega?')) return

    setIsLeaving(true)
    const result = await leagueApi.leave(leagueId)
    if (result.success) {
      onNavigate('dashboard')
    } else {
      setError(result.message || 'Errore nell\'abbandono della lega')
    }
    setIsLeaving(false)
  }

  function getActiveSession() {
    return sessions.find(s => s.status === 'ACTIVE')
  }

  function isFirstMarketCompleted() {
    return sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
  }

  // Show loading while checking superadmin status
  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">Caricamento lega...</p>
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl text-danger-400">Lega non trovata</p>
          <Button variant="outline" className="mt-4" onClick={() => onNavigate('dashboard')}>
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const activeSession = getActiveSession()
  const activeMembers = league.members.filter(m => m.status === 'ACTIVE')

  return (
    <div className="min-h-screen bg-dark-300">
      <Navigation currentPage="leagueDetail" leagueId={leagueId} isLeagueAdmin={isAdmin} onNavigate={onNavigate} />

      {/* League Header */}
      <div className="bg-gradient-to-r from-dark-200 via-surface-200 to-dark-200 border-b border-surface-50/20">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
                <span className="text-3xl">🏟️</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{league.name}</h1>
                <p className="text-gray-400 mt-1">
                  {league.status === 'DRAFT' ? '📋 In preparazione' : league.status === 'ACTIVE' ? '🔥 Primo Mercato' : league.status}
                </p>
              </div>
            </div>
            <div className="text-right bg-surface-200 rounded-xl px-6 py-4 border border-surface-50/20">
              <p className="text-sm text-gray-400 uppercase tracking-wide">Il tuo Budget</p>
              <p className="text-4xl font-bold text-accent-400">{userMembership?.currentBudget || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {error && (
          <div className="bg-danger-500/20 border border-danger-500/50 text-danger-400 p-4 rounded-xl mb-6 text-base">
            {error}
          </div>
        )}

        {/* Waiting for Market Banner - shown when league is ACTIVE but no session */}
        {!activeSession && league.status === 'ACTIVE' && (() => {
          const firstMarketDone = isFirstMarketCompleted()
          return (
            <div className="bg-gradient-to-r from-primary-600/20 to-primary-500/10 border-2 border-primary-500/40 rounded-2xl p-6 mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <span className="text-3xl">{firstMarketDone ? '🔄' : '⏳'}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-400">
                    {firstMarketDone ? 'In Attesa del Mercato Ricorrente' : 'In Attesa del Primo Mercato'}
                  </h2>
                  <p className="text-gray-300">
                    {isAdmin
                      ? firstMarketDone
                        ? 'Avvia la sessione per iniziare il mercato ricorrente (Scambi, Rinnovi, Rubata, Svincolati).'
                        : 'Avvia la sessione d\'asta per iniziare il primo mercato.'
                      : firstMarketDone
                        ? 'In attesa che l\'admin avvii il mercato ricorrente.'
                        : 'In attesa che l\'admin avvii la sessione d\'asta.'}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button size="lg" onClick={handleOpenAuctionClick}>
                  {firstMarketDone ? 'Avvia Mercato Ricorrente' : 'Avvia Primo Mercato'}
                </Button>
              )}
            </div>
          )
        })()}

        {/* Active Session Banner */}
        {activeSession && (() => {
          const isFirstMarket = activeSession.type === 'PRIMO_MERCATO'
          const phaseConfig: Record<string, { icon: string; title: string; description: string; buttonText: string; color: string; adminOnly?: boolean }> = {
            ASTA_LIBERA: {
              icon: '🔨',
              title: isFirstMarket ? 'Asta Primo Mercato' : 'Asta Libera',
              description: isFirstMarket ? 'Costruisci la tua rosa! Entra in asta e acquista i tuoi giocatori.' : "L'asta è in corso, entra subito!",
              buttonText: isFirstMarket ? 'Entra in Asta Primo Mercato' : "Entra nell'Asta",
              color: 'secondary'
            },
            PREMI: {
              icon: '🏆',
              title: 'Assegnazione Premi Budget',
              description: isAdmin ? 'Assegna i premi budget ai manager per i risultati del campionato.' : 'L\'admin sta assegnando i premi budget per i risultati del campionato.',
              buttonText: 'Gestisci Premi',
              color: 'warning',
              adminOnly: true
            },
            OFFERTE_PRE_RINNOVO: { icon: '🔄', title: 'Fase Scambi Pre-Rinnovo', description: 'Proponi scambi e offerte agli altri DG prima di rinnovare i contratti.', buttonText: 'Effettua Scambi', color: 'primary' },
            CONTRATTI: { icon: '📝', title: 'Rinnovo Contratti', description: 'È il momento di rinnovare i contratti dei tuoi giocatori in scadenza.', buttonText: 'Rinnova Contratti', color: 'accent' },
            RUBATA: { icon: '🎯', title: 'Fase Rubata', description: 'Prova a strappare giocatori dalle rose avversarie!', buttonText: 'Partecipa alla Rubata', color: 'warning' },
            ASTA_SVINCOLATI: { icon: '📋', title: 'Asta Svincolati', description: 'Acquista giocatori senza contratto per completare la tua rosa.', buttonText: 'Partecipa all\'Asta Svincolati', color: 'success' },
            OFFERTE_POST_ASTA_SVINCOLATI: { icon: '🔄', title: 'Fase Scambi Finale', description: 'Ultima opportunità per proporre scambi prima della chiusura del mercato.', buttonText: 'Effettua Scambi Finali', color: 'primary' },
          }
          const phase = activeSession.currentPhase || 'ASTA_LIBERA'
          const defaultConfig = { icon: '🔨', title: 'Sessione Attiva', description: 'Sessione di mercato in corso', buttonText: 'Entra', color: 'secondary', adminOnly: false }
          const config = phaseConfig[phase] ?? defaultConfig
          const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
            secondary: { bg: 'from-secondary-600/30 to-secondary-500/20', border: 'border-secondary-500/50', text: 'text-secondary-400', iconBg: 'bg-secondary-500/30' },
            primary: { bg: 'from-primary-600/30 to-primary-500/20', border: 'border-primary-500/50', text: 'text-primary-400', iconBg: 'bg-primary-500/30' },
            accent: { bg: 'from-accent-600/30 to-accent-500/20', border: 'border-accent-500/50', text: 'text-accent-400', iconBg: 'bg-accent-500/30' },
            warning: { bg: 'from-warning-600/30 to-warning-500/20', border: 'border-warning-500/50', text: 'text-warning-400', iconBg: 'bg-warning-500/30' },
            success: { bg: 'from-green-600/30 to-green-500/20', border: 'border-green-500/50', text: 'text-green-400', iconBg: 'bg-green-500/30' },
          }
          const defaultColors = { bg: 'from-secondary-600/30 to-secondary-500/20', border: 'border-secondary-500/50', text: 'text-secondary-400', iconBg: 'bg-secondary-500/30' }
          const colors = colorClasses[config.color] || defaultColors

          // Determine navigation target based on phase
          const getNavTarget = () => {
            switch (phase) {
              case 'ASTA_LIBERA': return () => onNavigate('auction', { sessionId: activeSession.id, leagueId })
              case 'PREMI': return () => onNavigate('prizes', { leagueId })
              case 'OFFERTE_PRE_RINNOVO':
              case 'OFFERTE_POST_ASTA_SVINCOLATI': return () => onNavigate('trades', { leagueId })
              case 'ASTA_SVINCOLATI': return () => onNavigate('svincolati', { leagueId })
              case 'RUBATA': return () => onNavigate('rubata', { leagueId })
              case 'CONTRATTI': return () => onNavigate('contracts', { leagueId })
              default: return () => onNavigate('auction', { sessionId: activeSession.id, leagueId })
            }
          }

          // Check if button should be shown (hide for non-admin when adminOnly)
          const showButton = !(config.adminOnly && !isAdmin)

          return (
            <div className={`bg-gradient-to-r ${colors.bg} border-2 ${colors.border} rounded-2xl p-6 mb-8 flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full ${colors.iconBg} flex items-center justify-center animate-pulse`}>
                  <span className="text-3xl">{config.icon}</span>
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${colors.text}`}>{config.title}</h2>
                  <p className="text-gray-300">{config.description}</p>
                </div>
              </div>
              {showButton && (
                <Button
                  size="lg"
                  variant={config.color === 'secondary' ? 'secondary' : 'primary'}
                  onClick={getNavTarget()}
                >
                  {config.buttonText}
                </Button>
              )}
            </div>
          )
        })()}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* League Info */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20 flex items-center gap-3">
              <span className="text-xl">📊</span>
              <h3 className="text-xl font-bold text-white">Info Lega</h3>
            </div>
            <div className="p-5">
              {league.description && (
                <p className="text-gray-300 mb-5 text-base">{league.description}</p>
              )}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-surface-50/10">
                  <span className="text-gray-400">Fase</span>
                  <span className={`font-semibold ${
                    league.status === 'ACTIVE' ? 'text-secondary-400' :
                    league.status === 'DRAFT' ? 'text-primary-400' : 'text-gray-400'
                  }`}>
                    {league.status === 'DRAFT' ? 'Creazione Lega' : league.status === 'ACTIVE' ? 'Primo Mercato' : league.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-surface-50/10">
                  <span className="text-gray-400">Partecipanti</span>
                  <span className="font-semibold text-white">{activeMembers.length}/{league.maxParticipants}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-surface-50/10">
                  <span className="text-gray-400">Budget iniziale</span>
                  <span className="font-semibold text-accent-400">{league.initialBudget}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400">Codice invito</span>
                  <span className="font-mono text-primary-400 bg-surface-300 px-3 py-1 rounded">{league.id.slice(0, 8)}</span>
                </div>
              </div>

              {/* Roster Slots */}
              <div className="mt-6 pt-5 border-t border-surface-50/20">
                <p className="text-sm text-gray-400 mb-4 uppercase tracking-wide">Slot Rosa</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { pos: 'P', slots: league.goalkeeperSlots, label: 'POR' },
                    { pos: 'D', slots: league.defenderSlots, label: 'DIF' },
                    { pos: 'C', slots: league.midfielderSlots, label: 'CEN' },
                    { pos: 'A', slots: league.forwardSlots, label: 'ATT' },
                  ].map(({ pos, slots, label }) => (
                    <div key={pos} className="text-center bg-surface-300 rounded-lg p-3">
                      <div className={`w-10 h-10 mx-auto rounded-full ${POSITION_COLORS[pos]?.bg ?? 'bg-gray-500'} flex items-center justify-center text-white font-bold mb-2`}>
                        {pos}
                      </div>
                      <p className={`text-xs ${POSITION_COLORS[pos]?.text ?? 'text-gray-400'} font-medium`}>{label}</p>
                      <p className="text-lg font-bold text-white">{slots}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave League Button */}
              {!isAdmin && league.status === 'DRAFT' && (
                <div className="mt-6 pt-5 border-t border-surface-50/20">
                  <Button
                    variant="outline"
                    className="w-full border-danger-500/50 text-danger-400 hover:bg-danger-500/10"
                    onClick={handleLeaveLeague}
                    disabled={isLeaving}
                  >
                    {isLeaving ? 'Abbandono...' : 'Abbandona Lega'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Puoi abbandonare solo prima che la lega sia avviata
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">👔</span>
                <h3 className="text-xl font-bold text-white">Presidenti</h3>
              </div>
              <span className="bg-surface-300 px-3 py-1 rounded-full text-sm text-gray-400">{activeMembers.length}</span>
            </div>
            <div className="divide-y divide-surface-50/10">
              {activeMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-surface-300/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {member.user.profilePhoto ? (
                      <img
                        src={member.user.profilePhoto}
                        alt={member.user.username}
                        className="w-10 h-10 rounded-full object-cover border-2 border-surface-50/30"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        member.role === 'ADMIN' ? 'bg-gradient-to-br from-accent-500 to-accent-700' : 'bg-gradient-to-br from-primary-500 to-primary-700'
                      }`}>
                        {member.user.username[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-base">
                          {member.teamName || member.user.username}
                        </span>
                        {member.role === 'ADMIN' && (
                          <span className="text-xs bg-accent-500/20 text-accent-400 px-2 py-0.5 rounded-full border border-accent-500/40 font-medium">
                            Presidente
                          </span>
                        )}
                      </div>
                      {member.teamName && (
                        <p className="text-xs text-gray-400">{member.user.username}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-accent-400">{member.currentBudget}</span>
                    <span className="text-xs text-gray-500 ml-1">crediti</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STATO */}
          <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden">
            <div className="p-5 border-b border-surface-50/20 flex items-center gap-3">
              <span className="text-xl">📊</span>
              <h3 className="text-xl font-bold text-white">STATO</h3>
            </div>
            <div className="p-5">
              {league.status === 'DRAFT' && (
                <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                  <p className="text-primary-400 font-semibold text-base mb-1">Creazione Lega</p>
                  <p className="text-sm text-gray-400">
                    {isAdmin
                      ? 'Passa al Primo Mercato dal Pannello Admin per avviare le aste'
                      : 'In attesa che l\'admin passi al Primo Mercato'}
                  </p>
                </div>
              )}

              {league.status === 'ACTIVE' && !activeSession && (
                <div className="space-y-4">
                  <div className="p-4 bg-surface-300 rounded-xl">
                    <p className="text-gray-400 font-medium mb-1">Nessuna sessione attiva</p>
                    <p className="text-sm text-gray-500">
                      {sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
                        ? 'In attesa del prossimo Mercato Ricorrente'
                        : 'In attesa del Primo Mercato'}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button size="lg" onClick={handleOpenAuctionClick} className="w-full">
                      {sessions.some(s => s.type === 'PRIMO_MERCATO' && s.status === 'COMPLETED')
                        ? 'Avvia Mercato Ricorrente'
                        : 'Avvia Primo Mercato'}
                    </Button>
                  )}
                </div>
              )}

              {activeSession && (
                <div className="space-y-4">
                  {/* Tipo sessione */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Sessione</span>
                    <span className="font-semibold text-white">
                      {activeSession.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                    </span>
                  </div>

                  {/* Fase corrente - cliccabile */}
                  <button
                    onClick={() => {
                      const phase = activeSession.currentPhase
                      switch (phase) {
                        case 'ASTA_LIBERA': onNavigate('auction', { sessionId: activeSession.id, leagueId }); break
                        case 'PREMI': onNavigate('prizes', { leagueId }); break
                        case 'OFFERTE_PRE_RINNOVO':
                        case 'OFFERTE_POST_ASTA_SVINCOLATI': onNavigate('trades', { leagueId }); break
                        case 'ASTA_SVINCOLATI': onNavigate('svincolati', { leagueId }); break
                        case 'RUBATA': onNavigate('rubata', { leagueId }); break
                        case 'CONTRATTI': onNavigate('contracts', { leagueId }); break
                        default: break
                      }
                    }}
                    className="w-full p-4 bg-primary-500/20 border border-primary-500/40 rounded-xl text-left hover:bg-primary-500/30 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fase Corrente</p>
                        <p className="text-xl font-bold text-primary-400 group-hover:text-primary-300 transition-colors">
                          {PHASE_LABELS[activeSession.currentPhase] || activeSession.currentPhase}
                        </p>
                        {activeSession.phaseStartedAt && (
                          <p className="text-sm text-gray-400 mt-2">
                            Iniziata: {new Date(activeSession.phaseStartedAt).toLocaleString('it-IT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <span className="text-primary-500 group-hover:text-primary-400 transition-colors text-xl">→</span>
                    </div>
                  </button>

                  {/* Sessione iniziata */}
                  {activeSession.startsAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Sessione iniziata</span>
                      <span className="text-gray-400">
                        {new Date(activeSession.startsAt).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Storico sessioni completate */}
              {sessions.filter(s => s.status === 'COMPLETED').length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-50/20">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Sessioni Completate</p>
                  <div className="space-y-2">
                    {sessions.filter(s => s.status === 'COMPLETED').map(session => (
                      <button
                        key={session.id}
                        onClick={() => onNavigate('history', { leagueId })}
                        className="w-full flex justify-between items-center text-sm p-2 -mx-2 rounded-lg hover:bg-surface-300/50 transition-colors group"
                      >
                        <span className="text-gray-400 group-hover:text-primary-400 transition-colors">
                          {session.type === 'PRIMO_MERCATO' ? 'Primo Mercato' : 'Mercato Ricorrente'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">
                            {session.startsAt && new Date(session.startsAt).toLocaleDateString('it-IT')}
                          </span>
                          <span className="text-gray-600 group-hover:text-primary-400 transition-colors">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Modal conferma apertura asta */}
      {showAuctionConfirm && (() => {
        const isRegularMarket = isFirstMarketCompleted()
        return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-200 rounded-2xl p-8 max-w-md w-full border border-surface-50/20 shadow-2xl">
            <div className="text-center mb-6">
              <div className={`w-20 h-20 rounded-full ${isRegularMarket ? 'bg-gradient-to-br from-primary-500 to-primary-700' : 'bg-gradient-to-br from-secondary-500 to-secondary-700'} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                <span className="text-4xl">{isRegularMarket ? '🔄' : '🏁'}</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                {isRegularMarket ? 'Avvia Mercato Ricorrente' : 'Avvia Sessione d\'Asta'}
              </h3>
              <p className={`${isRegularMarket ? 'text-primary-400' : 'text-secondary-400'} font-medium mt-1`}>
                {isRegularMarket ? 'Fase: Mercato Ricorrente' : 'Fase: Primo Mercato'}
              </p>
            </div>

            <div className="bg-surface-300 rounded-xl p-5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400">DG partecipanti</span>
                <span className={`text-3xl font-bold ${isRegularMarket ? 'text-primary-400' : 'text-secondary-400'}`}>{activeMembers.length}</span>
              </div>
              <div className="text-center pt-3 border-t border-surface-50/20">
                <p className="text-sm text-gray-400">
                  {isRegularMarket
                    ? 'Il mercato inizierà con la fase Scambi e Offerte'
                    : `L'asta partirà con ${activeMembers.length} DG`}
                </p>
              </div>
            </div>

            <p className="text-base text-gray-300 mb-6 text-center">
              {isRegularMarket
                ? 'Sei sicuro di voler avviare il mercato ricorrente?'
                : 'Sei sicuro di voler avviare la sessione d\'asta?'}
            </p>

            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setShowAuctionConfirm(false)}
                disabled={isCreatingSession}
              >
                Annulla
              </Button>
              <Button
                size="lg"
                variant={isRegularMarket ? 'primary' : 'secondary'}
                className="flex-1"
                onClick={handleConfirmCreateSession}
                disabled={isCreatingSession}
              >
                {isCreatingSession ? 'Creazione...' : (isRegularMarket ? 'Avvia Mercato' : 'Avvia Asta')}
              </Button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
