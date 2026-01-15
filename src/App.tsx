import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { CreateLeague } from './pages/CreateLeague'
import { Profile } from './pages/Profile'
import { LeagueDetail } from './pages/LeagueDetail'
import { AuctionRoom } from './pages/AuctionRoom'
import { Rose } from './pages/Rose'
import { Contracts } from './pages/Contracts'
import { Trades } from './pages/Trades'
import { Rubata } from './pages/Rubata'
import { StrategieRubata } from './pages/StrategieRubata'
import { Svincolati } from './pages/Svincolati'
import { AllPlayers } from './pages/AllPlayers'
import { ManagerDashboard } from './pages/ManagerDashboard'
import { AdminPanel } from './pages/AdminPanel'
import { Movements } from './pages/Movements'
import { History } from './pages/History'
import Prophecies from './pages/Prophecies'
import { SuperAdmin } from './pages/SuperAdmin'
import { PrizePhasePage } from './pages/PrizePhasePage'
import LatencyTest from './pages/LatencyTest'
import { useCallback } from 'react'

// Loading component
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
    else navigate('/' + page)
  }, [navigate])
  return <CreateLeague onNavigate={onNavigate} />
}

function ProfileWrapper() {
  const navigate = useNavigate()
  const onNavigate = useCallback((page: string, params?: Record<string, string>) => {
    if (page === 'dashboard') navigate('/dashboard')
    else if (page === 'leagueDetail' && params?.leagueId) navigate(`/leagues/${params.leagueId}`)
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
      case 'auction': navigate(`/leagues/${lid}/auction/${params?.sessionId}`); break
      case 'rose': navigate(`/leagues/${lid}/rose`); break
      // Keep backward compatibility for old routes
      case 'roster': navigate(`/leagues/${lid}/rose`); break
      case 'allRosters':
      case 'rosters': navigate(`/leagues/${lid}/rose`); break
      case 'contracts': navigate(`/leagues/${lid}/contracts`); break
      case 'trades': navigate(`/leagues/${lid}/trades`); break
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

function TradesWrapper() {
  const navigate = useNavigate()
  const { leagueId } = useParams<{ leagueId: string }>()
  const onNavigate = useCallback(createLeagueNavigator(navigate, leagueId), [navigate, leagueId])

  if (!leagueId) return <Navigate to="/dashboard" replace />
  return <Trades leagueId={leagueId} onNavigate={onNavigate} />
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

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginWrapper /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterWrapper /></PublicRoute>} />
      <Route path="/test-latency" element={<LatencyTest />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfileWrapper /></ProtectedRoute>} />
      <Route path="/leagues/new" element={<ProtectedRoute><CreateLeagueWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId" element={<ProtectedRoute><LeagueDetailWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/auction/:sessionId" element={<ProtectedRoute><AuctionRoomWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/rose" element={<ProtectedRoute><RoseWrapper /></ProtectedRoute>} />
      {/* Backward compatibility redirects for old routes */}
      <Route path="/leagues/:leagueId/roster" element={<Navigate to="../rose" replace />} />
      <Route path="/leagues/:leagueId/rosters" element={<Navigate to="../rose" replace />} />
      <Route path="/leagues/:leagueId/contracts" element={<ProtectedRoute><ContractsWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/trades" element={<ProtectedRoute><TradesWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/rubata" element={<ProtectedRoute><RubataWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/strategie-rubata" element={<ProtectedRoute><StrategieRubataWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/svincolati" element={<ProtectedRoute><SvincolatiWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/players" element={<ProtectedRoute><AllPlayersWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/manager" element={<ProtectedRoute><ManagerDashboardWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/admin" element={<ProtectedRoute><AdminPanelWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/movements" element={<ProtectedRoute><MovementsWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/history" element={<ProtectedRoute><HistoryWrapper /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/prophecies" element={<ProtectedRoute><Prophecies /></ProtectedRoute>} />
      <Route path="/leagues/:leagueId/prizes" element={<ProtectedRoute><PrizePhasePageWrapper /></ProtectedRoute>} />

      {/* Superadmin */}
      <Route path="/superadmin" element={<ProtectedRoute><SuperAdminWrapper /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <SpeedInsights />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
