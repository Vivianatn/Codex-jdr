import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasActiveDb, setActiveDb } from '@/db/db'
import type * as CryptoModule from '@/security/crypto'
import { sessionKey, useSessionStore } from '@/security/session'
import { renderApp } from '@/test/renderApp'

// Real iteration count is covered by the crypto tests; keep this UI test fast.
vi.mock('@/security/crypto', async (original) => ({
  ...(await original<typeof CryptoModule>()),
  DEFAULT_ITERATIONS: 1000,
}))

const PASSWORD = 'lanterne verte sous le pont de grès'
// Unlocking opens a database: give transitions room when the whole suite runs in parallel.
const SLOW = { timeout: 15_000 }

/** Waits for the text, then for the page transition to finish fading it in. */
async function shows(text: string) {
  const element = await screen.findByText(text, {}, SLOW)
  await waitFor(() => expect(element).toBeVisible(), SLOW)
}

beforeEach(() => {
  setActiveDb(null)
  useSessionStore.setState({ status: 'locked', account: null, delegated: false })
})

describe('lock screen (D-241)', () => {
  it('creates an account, shows the recovery code once, locks and unlocks', async () => {
    const { user } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
    expect(hasActiveDb()).toBe(false)

    await user.type(screen.getByLabelText(/Nom du compte/), 'Agathe')
    await user.type(screen.getByLabelText(/^Mot de passe/), PASSWORD)
    await user.type(screen.getByLabelText('Confirme le mot de passe'), 'autre chose encore là')
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect(await screen.findByText('Les deux mots de passe ne sont pas identiques.')).toBeVisible()

    await user.clear(screen.getByLabelText('Confirme le mot de passe'))
    await user.type(screen.getByLabelText('Confirme le mot de passe'), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }))

    const code = await screen.findByTestId('recovery-code', {}, { timeout: 15_000 })
    expect(code.textContent).toMatch(/^(\w{4}-){7}\w{4}$/)
    const proceed = screen.getByRole('button', { name: 'Continuer' })
    expect(proceed).toBeDisabled()
    await user.click(screen.getByLabelText(/J’ai rangé ce code/))
    await user.click(proceed)

    await shows('Ta bibliothèque est vide')
    expect(hasActiveDb()).toBe(true)
    expect(sessionKey()).toHaveLength(32)

    const key = sessionKey()!
    await user.click(screen.getByRole('button', { name: 'Verrouiller' }))
    await shows('Codex est verrouillé')
    expect(hasActiveDb()).toBe(false)
    expect(sessionKey()).toBeNull()
    // The key was overwritten in memory, not just dropped.
    expect(key.every((byte) => byte === 0)).toBe(true)

    await user.type(screen.getByLabelText(/^Mot de passe/), 'pas le bon mot de passe')
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }))
    expect(
      await screen.findByText('Mot de passe incorrect.', {}, { timeout: 15_000 }),
    ).toBeVisible()

    await user.clear(screen.getByLabelText(/^Mot de passe/))
    await user.type(screen.getByLabelText(/^Mot de passe/), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }))
    await waitFor(() => expect(useSessionStore.getState().status).toBe('unlocked'), {
      timeout: 15_000,
    })
    await shows('Ta bibliothèque est vide')
  }, 90_000)
})
