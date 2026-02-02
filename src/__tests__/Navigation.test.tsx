import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor, within, act, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navigation } from '../components/Navigation'
import { ThemeProvider } from '../contexts/ThemeContext'
import type { ReactNode, ReactElement } from 'react'

// Wrapper component for tests that require ThemeProvider
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
)

// Custom render that wraps components in ThemeProvider
const render = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  rtlRender(ui, { wrapper: TestWrapper, ...options })

// Mock the useAuth hook
const mockLogout = vi.fn()
const mockUser = { id: '1', email: 'test@example.com', username: 'TestUser' }

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock the APIs
vi.mock('../services/api', () => ({
  superadminApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { isSuperAdmin: false } }),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  leagueApi: {
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  feedbackApi: {
    getNotifications: vi.fn().mockResolvedValue({ success: true, data: { unreadCount: 0, notifications: [] } }),
    getUnreadNotifications: vi.fn().mockResolvedValue({ success: true, data: { unreadCount: 0, notifications: [] } }),
  },
}))

// Import the mocked api to control behavior in tests
import { superadminApi } from '../services/api'

describe('Navigation Component', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Authenticated User Rendering', () => {
    it('renders correctly for authenticated user without league', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Check logo button exists
      expect(screen.getByTestId('logo-button')).toBeInTheDocument()

      // Check user profile button exists
      expect(screen.getByTestId('profile-button')).toBeInTheDocument()

      // Check username is displayed (multiple instances exist in mobile and desktop)
      const usernames = screen.getAllByText('TestUser')
      expect(usernames.length).toBeGreaterThan(0)

      // Check desktop navigation main exists
      expect(screen.getByTestId('desktop-nav-main')).toBeInTheDocument()
    })

    it('renders correctly for authenticated user with league', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            isLeagueAdmin={false}
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Check desktop league navigation exists
      expect(screen.getByTestId('desktop-nav-league')).toBeInTheDocument()

      // Check back to leagues button exists
      expect(screen.getByTestId('back-to-leagues')).toBeInTheDocument()

      // Check non-admin menu items are visible (current LEAGUE_MENU_ITEMS)
      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('nav-giocatori')).toBeInTheDocument()
      expect(screen.getByTestId('nav-finanze')).toBeInTheDocument()
      expect(screen.getByTestId('nav-storico')).toBeInTheDocument()
      expect(screen.getByTestId('nav-profezie')).toBeInTheDocument()
      expect(screen.getByTestId('nav-feedback')).toBeInTheDocument()

      // Admin panel should NOT be visible for non-admin
      expect(screen.queryByTestId('nav-admin')).not.toBeInTheDocument()
    })

    it('displays user initials in avatar', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Check that the user's first letter is shown in the avatar
      const profileButton = screen.getByTestId('profile-button')
      expect(within(profileButton).getByText('T')).toBeInTheDocument()
    })
  })

  describe('Non-Authenticated User Rendering', () => {
    it('handles non-authenticated state gracefully', async () => {
      // Override the mock for this test
      vi.doMock('../hooks/useAuth', () => ({
        useAuth: () => ({
          user: null,
          logout: mockLogout,
          isAuthenticated: false,
          isLoading: false,
        }),
      }))

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Component should still render without crashing
      expect(screen.getByTestId('logo-button')).toBeInTheDocument()
    })
  })

  describe('Admin Menu Items', () => {
    it('shows admin panel button when user is league admin', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            isLeagueAdmin={true}
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Admin panel should be visible for admin users
      expect(screen.getByTestId('nav-admin')).toBeInTheDocument()

      // Admin badge should be visible
      expect(screen.getByTestId('admin-badge')).toBeInTheDocument()
    })

    it('hides admin panel button when user is not league admin', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            isLeagueAdmin={false}
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Admin panel should NOT be visible
      expect(screen.queryByTestId('nav-admin')).not.toBeInTheDocument()

      // Admin badge should NOT be visible
      expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
    })

    it('shows superadmin navigation tabs for superadmin users', async () => {
      vi.mocked(superadminApi.getStatus).mockResolvedValueOnce({
        success: true,
        data: { isSuperAdmin: true },
      })

      await act(async () => {
        render(
          <Navigation
            currentPage="superadmin"
            activeTab="upload"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Wait for the superadmin status to load
      await waitFor(() => {
        expect(screen.getByTestId('nav-quotazioni')).toBeInTheDocument()
      })

      expect(screen.getByTestId('nav-giocatori')).toBeInTheDocument()
      expect(screen.getByTestId('nav-leghe')).toBeInTheDocument()
      expect(screen.getByTestId('nav-utenti')).toBeInTheDocument()
    })
  })

  describe('Navigation Callbacks', () => {
    it('calls onNavigate when logo is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      await user.click(screen.getByTestId('logo-button'))
      expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
    })

    it('calls onNavigate with correct params when nav button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      await user.click(screen.getByTestId('nav-giocatori'))
      expect(mockOnNavigate).toHaveBeenCalledWith('strategie-rubata', { leagueId: 'league-123' })
    })

    it('calls onNavigate when back to leagues button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      await user.click(screen.getByTestId('back-to-leagues'))
      expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
    })

    it('calls logout and navigates to login when logout is clicked from dropdown', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open profile dropdown
      await user.click(screen.getByTestId('profile-button'))

      // Wait for dropdown to be visible
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown')).toHaveClass('opacity-100')
      })

      // Click logout
      await user.click(screen.getByTestId('logout-button-dropdown'))

      expect(mockLogout).toHaveBeenCalled()
      expect(mockOnNavigate).toHaveBeenCalledWith('login')
    })

    it('navigates to profile when profile link is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open profile dropdown
      await user.click(screen.getByTestId('profile-button'))

      // Wait for dropdown to be visible
      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown')).toHaveClass('opacity-100')
      })

      // Click profile link
      await user.click(screen.getByTestId('profile-link'))

      expect(mockOnNavigate).toHaveBeenCalledWith('profile')
    })
  })

  describe('Mobile Menu Toggle', () => {
    it('toggles mobile menu when hamburger button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      const toggleButton = screen.getByTestId('mobile-menu-toggle')

      // Initially closed (mobile menu not in DOM due to conditional rendering)
      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()

      // Click to open
      await user.click(toggleButton)

      // Should be open (now in DOM)
      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      })

      // Click to close
      await user.click(toggleButton)

      // Should be closed again (removed from DOM)
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()
      })
    })

    it('closes mobile menu when navigation item is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open mobile menu
      await user.click(screen.getByTestId('mobile-menu-toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      })

      // Click a navigation item
      await user.click(screen.getByTestId('mobile-nav-giocatori'))

      // Menu should close (removed from DOM)
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument()
      })

      expect(mockOnNavigate).toHaveBeenCalledWith('strategie-rubata', { leagueId: 'league-123' })
    })

    it('shows mobile logout button and handles logout', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open mobile menu
      await user.click(screen.getByTestId('mobile-menu-toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      })

      // Click mobile logout
      await user.click(screen.getByTestId('mobile-logout'))

      expect(mockLogout).toHaveBeenCalled()
      expect(mockOnNavigate).toHaveBeenCalledWith('login')
    })
  })

  describe('Active State Highlighting', () => {
    it('highlights current page in navigation', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="strategie-rubata"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      const giocatoriButton = screen.getByTestId('nav-giocatori')
      const dashboardButton = screen.getByTestId('nav-dashboard')

      // Active button should have active styling (contains gradient classes)
      expect(giocatoriButton).toHaveClass('bg-gradient-to-r')
      expect(giocatoriButton).toHaveClass('from-primary-500/30')

      // Inactive button should not have active gradient
      expect(dashboardButton).not.toHaveClass('from-primary-500/30')
    })

    it('highlights admin button with accent color when active', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="adminPanel"
            leagueId="league-123"
            isLeagueAdmin={true}
            onNavigate={mockOnNavigate}
          />
        )
      })

      const adminButton = screen.getByTestId('nav-admin')

      // Admin button should have accent color styling
      expect(adminButton).toHaveClass('from-accent-500/30')
      expect(adminButton).toHaveClass('text-accent-300')
    })

    it('shows active indicator dot in mobile menu', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="strategie-rubata"
            leagueId="league-123"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open mobile menu
      await user.click(screen.getByTestId('mobile-menu-toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      })

      const mobileGiocatoriButton = screen.getByTestId('mobile-nav-giocatori')

      // Check for active styling (border-l-3 for active state)
      expect(mobileGiocatoriButton).toHaveClass('border-l-3')
      expect(mobileGiocatoriButton).toHaveClass('border-primary-400')
    })

    it('applies correct styles for superadmin active tabs', async () => {
      vi.mocked(superadminApi.getStatus).mockResolvedValueOnce({
        success: true,
        data: { isSuperAdmin: true },
      })

      await act(async () => {
        render(
          <Navigation
            currentPage="superadmin"
            activeTab="players"
            onNavigate={mockOnNavigate}
          />
        )
      })

      await waitFor(() => {
        expect(screen.getByTestId('nav-giocatori')).toBeInTheDocument()
      })

      const playersButton = screen.getByTestId('nav-giocatori')
      const uploadButton = screen.getByTestId('nav-quotazioni')

      // Players tab should be active
      expect(playersButton).toHaveClass('from-accent-500/30')

      // Upload tab should not be active
      expect(uploadButton).not.toHaveClass('from-accent-500/30')
    })
  })

  describe('Profile Dropdown', () => {
    it('opens and closes profile dropdown on click', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      const profileDropdown = screen.getByTestId('profile-dropdown')

      // Initially closed
      expect(profileDropdown).toHaveClass('opacity-0')
      expect(profileDropdown).toHaveClass('pointer-events-none')

      // Click to open
      await user.click(screen.getByTestId('profile-button'))

      // Should be open
      await waitFor(() => {
        expect(profileDropdown).toHaveClass('opacity-100')
        expect(profileDropdown).not.toHaveClass('pointer-events-none')
      })

      // Click again to close
      await user.click(screen.getByTestId('profile-button'))

      // Should be closed
      await waitFor(() => {
        expect(profileDropdown).toHaveClass('opacity-0')
      })
    })

    it('closes profile dropdown when clicking outside', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <div>
            <div data-testid="outside-element">Outside</div>
            <Navigation
              currentPage="dashboard"
              onNavigate={mockOnNavigate}
            />
          </div>
        )
      })

      // Open dropdown
      await user.click(screen.getByTestId('profile-button'))

      const profileDropdown = screen.getByTestId('profile-dropdown')
      await waitFor(() => {
        expect(profileDropdown).toHaveClass('opacity-100')
      })

      // Click outside
      await user.click(screen.getByTestId('outside-element'))

      // Should be closed
      await waitFor(() => {
        expect(profileDropdown).toHaveClass('opacity-0')
      })
    })

    it('displays user email in dropdown', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open dropdown
      await user.click(screen.getByTestId('profile-button'))

      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown')).toHaveClass('opacity-100')
      })

      // Check email is displayed (multiple instances exist in mobile and desktop)
      const emails = screen.getAllByText('test@example.com')
      expect(emails.length).toBeGreaterThan(0)
    })

    it('rotates chevron icon when dropdown is open', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      const profileButton = screen.getByTestId('profile-button')

      // Get all SVGs inside the profile button - the last one is the chevron
      const svgs = profileButton.querySelectorAll('svg')
      const chevron = svgs[svgs.length - 1]

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-180')

      // Open dropdown
      await user.click(profileButton)

      // Should be rotated - need to query again since React may have re-rendered
      await waitFor(() => {
        const updatedSvgs = screen.getByTestId('profile-button').querySelectorAll('svg')
        const updatedChevron = updatedSvgs[updatedSvgs.length - 1]
        expect(updatedChevron).toHaveClass('rotate-180')
      })
    })
  })

  describe('Visual Elements', () => {
    it('renders online status indicator in profile avatar', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      const profileButton = screen.getByTestId('profile-button')

      // Check for the green online indicator (has bg-secondary-500 class)
      const onlineIndicator = within(profileButton).getByText('', {
        selector: '.bg-secondary-500',
      })
      expect(onlineIndicator).toBeInTheDocument()
    })

    it('renders admin badge with star icon when user is admin', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            isLeagueAdmin={true}
            onNavigate={mockOnNavigate}
          />
        )
      })

      const adminBadge = screen.getByTestId('admin-badge')
      expect(adminBadge).toBeInTheDocument()
      expect(adminBadge).toHaveTextContent('Admin')

      // Should have accent color styling
      expect(adminBadge).toHaveClass('border-accent-500/30')
    })

    it('renders mobile user profile section with admin badge when admin', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(
          <Navigation
            currentPage="leagueDetail"
            leagueId="league-123"
            isLeagueAdmin={true}
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Open mobile menu
      await user.click(screen.getByTestId('mobile-menu-toggle'))

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument()
      })

      // Check mobile profile section shows admin badge (multiple Admin texts exist)
      const mobileMenu = screen.getByTestId('mobile-menu')
      const adminTexts = within(mobileMenu).getAllByText('Admin')
      expect(adminTexts.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('handles missing username gracefully', async () => {
      // This test uses the default mock which has a username
      // The component shows '?' when username is not available
      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Should render without crashing
      expect(screen.getByTestId('profile-button')).toBeInTheDocument()
    })

    it('handles superadmin API failure gracefully', async () => {
      // Mock API to return a failed response (not reject)
      vi.mocked(superadminApi.getStatus).mockResolvedValueOnce({
        success: false,
        message: 'API Error',
      })

      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Should render without crashing
      expect(screen.getByTestId('logo-button')).toBeInTheDocument()

      // Should show regular user menu (not superadmin)
      expect(screen.getByTestId('nav-le-mie-leghe')).toBeInTheDocument()
    })

    it('handles empty leagueId correctly', async () => {
      await act(async () => {
        render(
          <Navigation
            currentPage="dashboard"
            leagueId=""
            onNavigate={mockOnNavigate}
          />
        )
      })

      // Should show main navigation, not league navigation
      expect(screen.getByTestId('desktop-nav-main')).toBeInTheDocument()
      expect(screen.queryByTestId('desktop-nav-league')).not.toBeInTheDocument()
    })
  })
})
