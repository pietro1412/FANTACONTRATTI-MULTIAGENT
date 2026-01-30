import { lazy, Suspense, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './contexts/ThemeContext'

// Pagine critiche - import statico (usate al primo caricamento)
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'

// Pagine lazy loaded - caricate on-demand
const CreateLeague = lazy(() => import('./pages/CreateLeague').then(m => ({ default: m.CreateLeague })))
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })))
const LeagueDetail = lazy(() => import('./pages/LeagueDetail').then(m => ({ default: m.LeagueDetail })))
const AuctionRoom = lazy(() => import('./pages/AuctionRoom').then(m => ({ default: m.AuctionRoom })))
const Rose = lazy(() => import('./pages/Rose').then(m => ({ default: m.Rose })))
const Contracts = lazy(() => import('./pages/Contracts').then(m => ({ default: m.Contracts })))
const Indemnity = lazy(() => import('./pages/Indemnity').then(m => ({ default: m.Indemnity })))
const Trades = lazy(() => import('./pages/Trades').then(m => ({ default: m.Trades })))
const Rubata = lazy(() => import('./pages/Rubata').then(m => ({ default: m.Rubata })))
const StrategieRubata = lazy(() => import('./pages/StrategieRubata').then(m => ({ default: m.StrategieRubata })))
const Svincolati = lazy(() => import('./pages/Svincolati').then(m => ({ default: m.Svincolati })))
const AllPlayers = lazy(() => import('./pages/AllPlayers').then(m => ({ default: m.AllPlayers })))
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })))
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })))
const Movements = lazy(() => import('./pages/Movements').then(m => ({ default: m.Movements })))
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })))
const Prophecies = lazy(() => import('./pages/Prophecies').then(m => ({ default: m.Prophecies })))
const PlayerStats = lazy(() => import('./pages/PlayerStats'))
const LeagueFinancials = lazy(() => import('./pages/LeagueFinancials'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin').then(m => ({ default: m.SuperAdmin })))
const PrizePhasePage = lazy(() => import('./pages/PrizePhasePage').then(m => ({ default: m.PrizePhasePage })))
const LatencyTest = lazy(() => import('./pages/LatencyTest'))
const TestStrategyFormats = lazy(() => import('./pages/TestStrategyFormats'))
const ApiFootballTest = lazy(() => import('./pages/ApiFootballTest'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })))
const InviteDetail = lazy(() => import('./pages/InviteDetail').then(m => ({ default: m.InviteDetail })))
const Rules = lazy(() => import('./pages/Rules').then(m => ({ default: m.Rules })))

// Loading component per autenticazione
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">⚽</div>
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4">Caricamento...</p>
      </div>
    </div>
  )
}

// Page loader per Suspense fallback (lazy loading)
function PageLoader() {
  return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
    </div>
  )
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public route wrapper (redirect to dashboard if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// Wrapper components to handle navigation and params
function LoginWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string) => {
    if (page === 'register') navigate('/register')
    else if (page === 'dashboard') navigate('/dashboard')
    else navigate('/' + page)
  }, [navigate])
  return <Login onNavigate={onNavigate} />
}

function RegisterWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string) => {
    if (page === 'login') navigate('/login')
    else if (page === 'dashboard') navigate('/dashboard')
    else navigate('/' + page)
  }, [navigate])
  return <Register onNavigate={onNavigate} />
}

function DashboardWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'create-league') navigate('/leagues/new')
    else if (page === 'profile') navigate('/profile')
    else if (page === 'leagueDetail' && params?.leagueId) navigate(`/leagues/${params.leagueId}`)
    else if (page === 'inviteDetail' && params?.token) navigate(`/invite/${params.token}`)
    else if (page === 'login') navigate('/login')
    else if (page === 'superadmin') {
      if (params?.tab) navigate(`/superadmin?tab=${params.tab}`)
      else navigate('/superadmin')
    }
    else navigate('/' + page)
  }, [navigate])
  return <Dashboard onNavigate={onNavigate} />
}

function CreateLeagueWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'dashboard') navigate('/dashboard')
    else if (page === 'profile') navigate('/profile')
    else if (page === 'leagueDetail' && params?.leagueId) navigate(`/leagues/${params.leagueId}`)
    else if (page === 'inviteDetail' && params?.token) navigate(`/invite/${params.token}`)
    else navigate('/' + page)
  }, [navigate])
  return <CreateLeague onNavigate={onNavigate} />
}

function ProfileWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'dashboard') navigate('/dashboard')
    else if (page === 'leagueDetail' && params?.leagueId) navigate(`/leagues/${params.leagueId}`)
    else if (page === 'inviteDetail' && params?.token) navigate(`/invite/${params.token}`)
    else if (page === 'superadmin') {
      if (params?.tab) navigate(`/superadmin?tab=${params.tab}`)
      else navigate('/superadmin')
    }
    else navigate('/' + page)
  }, [navigate])
  return <Profile onNavigate={onNavigate} />
}

// Shared navigation handler for all league pages
function createLeagueNavigator(navigate: ReturnType<typeof useNavigate>, leagueId: string | undefined) {
  return (page: string, params?: Record<string, string>) => {
    const lid = params?.leagueId || leagueId
    switch (page) {
      case 'dashboard': navigate('/dashboard'); break
      case 'profile': navigate('/profile'); break
      case 'leagueDetail': navigate(`/leagues/${lid}`); break
      case 'inviteDetail': navigate(`/invite/${params?.token}`); break
      case 'auction': navigate(`/leagues/${lid}/auction/${params?.sessionId}`); break
      case 'rose': navigate(`/leagues/${lid}/rose`); break
      // Keep backward compatibility for old routes
      case 'roster': navigate(`/leagues/${lid}/rose`); break
      case 'allRosters':
      case 'rosters': navigate(`/leagues/${lid}/rose`); break
      case 'contracts': navigate(`/leagues/${lid}/contracts`); break
      case 'trades':
        if (params?.highlight) {
          navigate(`/leagues/${lid}/trades`, { state: { highlight: params.highlight } })
        } else {
          navigate(`/leagues/${lid}/trades`)
        }
        break
      case 'rubata': navigate(`/leagues/${lid}/rubata`); break
      case 'strategie-rubata': navigate(`/leagues/${lid}/strategie-rubata`); break
      case 'svincolati': navigate(`/leagues/${lid}/svincolati`); break
      case 'prizes': navigate(`/leagues/${lid}/prizes`); break
      case 'allPlayers': navigate(`/leagues/${lid}/players`); break
      case 'manager-dashboard': navigate(`/leagues/${lid}/manager`); break
      case 'admin':
      case 'adminPanel':
        if (params?.tab) navigate(`/leagues/${lid}/admin?tab=${params.tab}`)
        else navigate(`/leagues/${lid}/admin`)
        break
      case 'movements': navigate(`/leagues/${lid}/movements`); break
      case 'history': navigate(`/leagues/${lid}/history`); break
      case 'prophecies': navigate(`/leagues/${lid}/prophecies`); break
      case 'playerStats': navigate(`/leagues/${lid}/stats`); break
      case 'financials': navigate(`/leagues/${lid}/financials`); break
      case 'superadmin':
        if (params?.tab) navigate(`/superadmin?tab=${params.tab}`)
        else navigate('/superadmin')
        break
      default: navigate('/' + page)
    }
  }
}

function LeagueDetailWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <LeagueDetail leagueId={leagueId} onNavigate={onNavigate} />
}

function AuctionRoomWrapper() {
  const navigate = useNavigate()
  const { leagueId, sessionId } = useParams<{ leagueId: string; sessionId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId || !sessionId) return <Navigate to="/dashboard" replace />
  return <AuctionRoom sessionId={sessionId} leagueId={leagueId} onNavigate={onNavigate} />
}

function RoseWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Rose onNavigate={onNavigate} />
}

function ContractsWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Contracts leagueId={leagueId} onNavigate={onNavigate} />
}

function IndemnityWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Indemnity leagueId={leagueId} onNavigate={onNavigate} />
}

function TradesWrapper() {
  const navigate = useNavigate()
  const location = useLocation()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  // Extract highlight parameter from location state
  const highlightOfferId = (location.state as { highlight?: string } | null)?.highlight

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Trades leagueId={leagueId} onNavigate={onNavigate} highlightOfferId={highlightOfferId} />
}

function RubataWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Rubata leagueId={leagueId} onNavigate={onNavigate} />
}

function StrategieRubataWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <StrategieRubata onNavigate={onNavigate} />
}

function SvincolatiWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Svincolati leagueId={leagueId} onNavigate={onNavigate} />
}

function AllPlayersWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <AllPlayers leagueId={leagueId} onNavigate={onNavigate} />
}

function ManagerDashboardWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <ManagerDashboard leagueId={leagueId} onNavigate={onNavigate} />
}

function AdminPanelWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || undefined
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <AdminPanel leagueId={leagueId} initialTab={initialTab} onNavigate={onNavigate} />
}

function MovementsWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Movements leagueId={leagueId} onNavigate={onNavigate} />
}

function HistoryWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <History leagueId={leagueId} onNavigate={onNavigate} />
}

function PrizePhasePageWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <PrizePhasePage leagueId={leagueId} onNavigate={onNavigate} />
}

function PropheciesWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Prophecies leagueId={leagueId} onNavigate={onNavigate} />
}

function PlayerStatsWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <PlayerStats leagueId={leagueId} onNavigate={onNavigate} />
}

function SuperAdminWrapper() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as 'upload' | 'players' | 'leagues' | 'users' | null

  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'dashboard') navigate('/dashboard')
    else if (page === 'superadmin' && params?.tab) {
      navigate(`/superadmin?tab=${params.tab}`)
    }
    else navigate('/' + page)
  }, [navigate])

  return <SuperAdmin onNavigate={onNavigate} initialTab={tabParam || undefined} />
}

function InviteDetailWrapper() {
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'dashboard') navigate('/dashboard')
    else if (page === 'leagueDetail' && params?.leagueId) navigate(`/leagues/${params.leagueId}`)
    else navigate('/' + page)
  }, [navigate])

  if (!token) return <Navigate to="/dashboard" replace />
  return <InviteDetail token={token} onNavigate={onNavigate} />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - Login/Register sono import statici */}
      <Route path="/login" element={<PublicRoute><LoginWrapper /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterWrapper /></PublicRoute>} />
      <Route path="/forgot-password" element={
        <PublicRoute>
          <Suspense fallback={<PageLoader />}>
            <ForgotPassword />
          </Suspense>
        </PublicRoute>
      } />
      <Route path="/reset-password" element={
        <Suspense fallback={<PageLoader />}>
          <ResetPassword />
        </Suspense>
      } />
      <Route path="/test-latency" element={
        <Suspense fallback={<PageLoader />}>
          <LatencyTest />
        </Suspense>
      } />
      <Route path="/test-strategy-formats" element={
        <Suspense fallback={<PageLoader />}>
          <TestStrategyFormats />
        </Suspense>
      } />
      <Route path="/api-football-test" element={
        <Suspense fallback={<PageLoader />}>
          <ApiFootballTest />
        </Suspense>
      } />

      {/* Public page - accessible to everyone */}
      <Route path="/rules" element={
        <Suspense fallback={<PageLoader />}>
          <Rules />
        </Suspense>
      } />

      {/* Protected routes - Dashboard e' import statico */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />

      {/* Protected routes - lazy loaded */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <ProfileWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/new" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <CreateLeagueWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <LeagueDetailWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/auction/:sessionId" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <AuctionRoomWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/rose" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <RoseWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      {/* Backward compatibility redirects for old routes */}
      <Route path="/leagues/:leagueId/roster" element={<Navigate to="../rose" replace />} />
      <Route path="/leagues/:leagueId/rosters" element={<Navigate to="../rose" replace />} />
      <Route path="/leagues/:leagueId/contracts" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <ContractsWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/indemnity" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <IndemnityWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/trades" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <TradesWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/rubata" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <RubataWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/strategie-rubata" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <StrategieRubataWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/svincolati" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <SvincolatiWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/players" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <AllPlayersWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/manager" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <ManagerDashboardWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/admin" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <AdminPanelWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/movements" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <MovementsWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/history" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <HistoryWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/prophecies" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <PropheciesWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/stats" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <PlayerStatsWrapper />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/financials" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <LeagueFinancials />
          </Suspense>
        </ProtectedRoute>
      } />
      <Route path="/leagues/:leagueId/prizes" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <PrizePhasePageWrapper />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Superadmin */}
      <Route path="/superadmin" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <SuperAdminWrapper />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Invite Detail */}
      <Route path="/invite/:token" element={
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <InviteDetailWrapper />
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <SpeedInsights />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
