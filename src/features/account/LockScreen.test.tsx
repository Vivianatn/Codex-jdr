import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasActiveDb, setActiveDb } from '@/db/db'
import type * as CryptoModule from '@/security/crypto'
import { accounts } from '@/security/accounts'
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

describe('lock screen (D-241, online only D-266)', () => {
  it('first asks a new visitor whether to create an account or sign in', async () => {
    const { user } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Bienvenue dans Codex' })).toBeVisible()
    expect(hasActiveDb()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'J’ai déjà un compte' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeVisible()
    expect(screen.getByLabelText(/Adresse e-mail/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retour' }))

    await user.click(await screen.findByRole('button', { name: 'Créer un compte' }))
    expect(await screen.findByRole('heading', { name: 'Créer un compte' })).toBeVisible()
    expect(screen.getByLabelText(/Nom affiché/)).toBeVisible()
  })

  it('unlocks the copy of an online account, locks and unlocks again', async () => {
    const { account } = await accounts.create({ username: 'Agathe', password: PASSWORD })
    await accounts.setOnline(account.id, {
      userId: 'u1',
      email: 'agathe@exemple.fr',
      displayName: 'Agathe',
    })
    const { user } = renderApp('/')
    await shows('Codex est verrouillé')

    await user.type(screen.getByLabelText(/^Mot de passe/), 'pas le bon mot de passe')
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }))
    expect(
      await screen.findByText('Mot de passe incorrect.', {}, { timeout: 15_000 }),
    ).toBeVisible()
    await user.clear(screen.getByLabelText(/^Mot de passe/))
    await user.type(screen.getByLabelText(/^Mot de passe/), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }))
    await shows('Ta bibliothèque est vide')
    expect(hasActiveDb()).toBe(true)

    const key = sessionKey()!
    await user.click(screen.getByRole('button', { name: 'Verrouiller' }))
    await shows('Codex est verrouillé')
    expect(sessionKey()).toBeNull()
    // The key was overwritten in memory, not just dropped.
    expect(key.every((byte) => byte === 0)).toBe(true)
  }, 90_000)

  it('an account of this device alone must be linked online before anything else', async () => {
    await accounts.create({ username: 'Ancien', password: PASSWORD })
    const { user } = renderApp('/')
    await user.type(await screen.findByLabelText(/^Mot de passe/, {}, SLOW), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Déverrouiller' }))
    await shows('Relie ton compte pour continuer')
    expect(screen.queryByText('Ta bibliothèque est vide')).toBeNull()
  }, 90_000)
})
