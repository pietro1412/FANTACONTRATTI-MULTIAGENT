import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

// Mock the API module
vi.mock('./services/api', () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({ success: false }),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
}))

describe('App', () => {
  it('renders login page when not authenticated', async () => {
    render(<App />)

    // Wait for loading to finish
    const loginText = await screen.findByText(/Accedi al tuo account/i)
    expect(loginText).toBeInTheDocument()
  })

  it('shows login form', async () => {
    render(<App />)

    const emailInput = await screen.findByLabelText(/Email o Username/i)
    const passwordInput = await screen.findByLabelText(/Password/i)
    const submitButton = await screen.findByRole('button', { name: /Accedi/i })

    expect(emailInput).toBeInTheDocument()
    expect(passwordInput).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
  })

  it('has link to register page', async () => {
    render(<App />)

    const registerLink = await screen.findByText(/Registrati/i)
    expect(registerLink).toBeInTheDocument()
  })
})
