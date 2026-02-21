import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Offline from '../pages/Offline'

describe('Offline Page', () => {
  it('renders the offline message and heading', () => {
    render(<Offline />)

    expect(screen.getByText('Sei offline')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Non è possibile raggiungere il server. Controlla la tua connessione internet e riprova.'
      )
    ).toBeInTheDocument()
  })

  it('renders the retry button', () => {
    render(<Offline />)

    const retryButton = screen.getByRole('button', { name: /riprova/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('calls window.location.reload when retry button is clicked', async () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    })

    const user = userEvent.setup()
    render(<Offline />)

    await user.click(screen.getByRole('button', { name: /riprova/i }))
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('shows the cache info text', () => {
    render(<Offline />)

    expect(
      screen.getByText(
        'I dati già caricati potrebbero essere disponibili nella cache del browser.'
      )
    ).toBeInTheDocument()
  })
})
