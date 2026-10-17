import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportButton } from '@/features/social/ReportDialog'
import { TERMS_VERSION } from '@shared/legal'
import { AlphaBadge } from './AlphaBadge'
import { legalApi } from './legalApi'
import { TermsGate } from './TermsGate'

afterEach(() => vi.restoreAllMocks())

describe('terms gate (D-271)', () => {
  it('asks an account without the current terms to accept them and declare its age', async () => {
    vi.spyOn(legalApi, 'terms').mockResolvedValue({ current: TERMS_VERSION, accepted: null })
    const accept = vi.spyOn(legalApi, 'acceptTerms').mockResolvedValue({
      current: TERMS_VERSION,
      accepted: { version: TERMS_VERSION, at: 1, age: '15+' },
    })
    const user = userEvent.setup()
    render(
      <TermsGate userId="u1">
        <p>Campagnes</p>
      </TermsGate>,
    )
    await screen.findByTestId('terms-gate')
    expect(screen.queryByText('Campagnes')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByText('Indique ton âge pour créer ton compte.')).toBeVisible()
    expect(
      screen.getByText('Accepte les conditions d’utilisation pour créer ton compte.'),
    ).toBeVisible()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
    expect(accept).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: 'J’ai 15 ans ou plus' }))
    await user.click(
      screen.getByRole('checkbox', { name: /J’accepte les conditions d’utilisation/ }),
    )
    expect(screen.getByRole('link', { name: /conditions d’utilisation/ })).toHaveAttribute(
      'href',
      '/cgu',
    )
    expect(screen.getByRole('link', { name: /politique de confidentialité/ })).toHaveAttribute(
      'href',
      '/confidentialite',
    )
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(accept).toHaveBeenCalledWith('15+')
    expect(await screen.findByText('Campagnes')).toBeVisible()
  })

  it('asks again when the terms changed', async () => {
    vi.spyOn(legalApi, 'terms').mockResolvedValue({
      current: TERMS_VERSION,
      accepted: { version: '2000-01-01', at: 1, age: '15+' },
    })
    render(
      <TermsGate userId="u1">
        <p>Campagnes</p>
      </TermsGate>,
    )
    expect(await screen.findByText(/ont changé/)).toBeVisible()
  })

  it('never blocks Codex while the server cannot be reached', async () => {
    const check = vi.spyOn(legalApi, 'terms').mockRejectedValue(new Error('offline'))
    render(
      <TermsGate userId="u1">
        <p>Campagnes</p>
      </TermsGate>,
    )
    expect(screen.getByText('Campagnes')).toBeVisible()
    await vi.waitFor(() => expect(check).toHaveBeenCalled())
    expect(screen.getByText('Campagnes')).toBeVisible()
  })
})

describe('reporting a profile (DSA art. 16)', () => {
  it('needs an explanation and good faith, and allows anonymity only for child abuse', async () => {
    const report = vi
      .spyOn(legalApi, 'report')
      .mockResolvedValue({ id: 'r1', reference: 'ABCD1234', receivedAt: 1 })
    const user = userEvent.setup()
    render(<ReportButton userId="u-bran" name="Bran" />)
    await user.click(screen.getByRole('button', { name: 'Signaler' }))
    const send = await screen.findByRole('button', { name: 'Envoyer le signalement' })
    expect(screen.queryByLabelText(/Ne pas transmettre mon identité/)).toBeNull()

    await user.click(send)
    expect(screen.getByText(/Explique en 10 caractères au moins/)).toBeVisible()
    expect(screen.getByText('Confirme que tu signales de bonne foi.')).toBeVisible()
    expect(report).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Motif'), 'childAbuse')
    expect(screen.getByText(/internet-signalement\.gouv\.fr/)).toBeVisible()
    await user.click(screen.getByLabelText(/Ne pas transmettre mon identité/))
    await user.type(screen.getByLabelText(/Explique pourquoi/), 'Image choquante sur la bannière.')
    await user.click(screen.getByLabelText(/Je déclare de bonne foi/))
    await user.click(send)
    expect(report).toHaveBeenCalledWith({
      targetId: 'u-bran',
      category: 'childAbuse',
      explanation: 'Image choquante sur la bannière.',
      anonymous: true,
    })
  })
})

describe('alpha badge', () => {
  it('links to the alpha section of the terms', () => {
    render(<AlphaBadge />)
    expect(screen.getByTestId('alpha-badge')).toHaveAttribute('href', '/cgu#alpha')
  })
})
