import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InfoTooltip } from '../components/ui/InfoTooltip'
import { GlossaryButton, GLOSSARY } from '../components/help/Glossary'

describe('InfoTooltip (P3)', () => {
  it('mostra il contenuto su hover e lo nasconde all\'uscita', async () => {
    const user = userEvent.setup()
    render(<InfoTooltip content="Spiegazione del concetto" label="Budget" />)
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.hover(screen.getByRole('button', { name: /Info: Budget/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Spiegazione del concetto')

    await user.unhover(screen.getByRole('button', { name: /Info: Budget/ }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('Glossary (P3)', () => {
  it('definisce i concetti dinastici core con relazioni chiave', () => {
    expect(GLOSSARY.bilancio!.long).toMatch(/Budget − Monte Ingaggi/)
    expect(GLOSSARY.prezzoRubata!.long).toMatch(/Clausola \+ Ingaggio/)
    expect(Object.keys(GLOSSARY)).toEqual(
      expect.arrayContaining(['budget', 'monteIngaggi', 'bilancio', 'clausola', 'ingaggio', 'durata', 'prezzoRubata']),
    )
  })

  it('GlossaryButton apre lo sheet con le voci del glossario', async () => {
    const user = userEvent.setup()
    render(<GlossaryButton />)
    expect(screen.queryByText(/come funziona una stagione/)).toBeNull()

    await user.click(screen.getByTestId('glossary-button'))
    expect(screen.getByText(/come funziona una stagione/)).toBeInTheDocument()
    expect(screen.getByText('Clausola rescissoria')).toBeInTheDocument()
    expect(screen.getByText('Prezzo rubata')).toBeInTheDocument()
  })
})
