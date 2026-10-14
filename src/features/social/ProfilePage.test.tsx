import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/online/server/api'
import { initialServerState, useServerStore } from '@/online/server/serverStore'
import { renderApp } from '@/test/renderApp'
import type { AdventurerProfile, FriendsList } from '@shared/sync'
import { relationIn } from './socialState'

const profile: AdventurerProfile = {
  id: 'test-user',
  displayName: 'MJ',
  avatar: null,
  bio: 'Toujours un pas devant le dragon.',
  banner: null,
  since: Date.UTC(2026, 0, 5),
  relation: 'self',
  friendCount: 1,
  together: [],
  code: 'K7QFM2XA',
}

const person = (id: string, displayName: string) => ({ id, displayName, avatar: null, bio: '' })

const friends: FriendsList = {
  friends: [{ ...person('u-bran', 'Bran'), since: 1, online: true }],
  incoming: [{ ...person('u-lyra', 'Lyra'), at: Date.UTC(2026, 9, 1) }],
  outgoing: [],
  suggestions: [{ ...person('u-ilan', 'Ilan'), campaign: 'Ombreval' }],
}

beforeEach(() => {
  useServerStore.setState({
    user: { id: 'test-user', email: 'mj@exemple.fr', displayName: 'MJ' },
    status: 'online',
    profile,
    friends,
  })
  // The page reads the server again when it opens: answer with the same lists.
  vi.spyOn(server, 'profile').mockResolvedValue({ profile })
  vi.spyOn(server, 'friends').mockResolvedValue(friends)
})
afterEach(() => {
  vi.restoreAllMocks()
  useServerStore.setState(initialServerState)
})

describe('profile and adventurers (D-267)', () => {
  it('shows the profile, the code, the lists, and reaches it from the top bar', async () => {
    const { user, router } = renderApp('/')
    const button = await screen.findByTestId('profile-button')
    expect(button).toHaveAccessibleName('Ouvrir mon profil (MJ)')
    expect(button).toHaveTextContent('1')
    await user.click(button)
    expect(router.state.location.pathname).toBe('/profil')

    const card = await screen.findByTestId('profile-card')
    expect(within(card).getByRole('heading', { name: 'MJ' })).toBeVisible()
    expect(card).toHaveTextContent('Toujours un pas devant le dragon.')
    expect(card).toHaveTextContent('1 aventurier')
    expect(screen.getByTestId('adventurer-code')).toHaveTextContent('K7QF-M2XA')
    expect(screen.getByTestId('adventurers-friends')).toHaveTextContent('1 en ligne')
    expect(screen.getByRole('link', { name: 'Voir le profil de Bran' })).toHaveTextContent(
      'Bran · En ligne',
    )
    expect(screen.getByTestId('adventurers-suggestions')).toHaveTextContent('dans « Ombreval »')

    const accept = vi.spyOn(server, 'befriend').mockResolvedValue({ relation: 'friend' })
    await user.click(
      within(screen.getByTestId('adventurers-incoming')).getByRole('button', {
        name: 'Accepter Lyra comme aventurier',
      }),
    )
    expect(accept).toHaveBeenCalledWith('u-lyra')

    const ask = vi.spyOn(server, 'befriend').mockResolvedValue({ relation: 'sent' })
    await user.click(screen.getByRole('button', { name: 'Ajouter Ilan comme aventurier' }))
    expect(ask).toHaveBeenCalledWith('u-ilan')
  })

  it('opens the account tab', async () => {
    const { user } = renderApp('/profil')
    await user.click(await screen.findByRole('tab', { name: 'Compte' }))
    expect(await screen.findByTestId('account-section')).toBeVisible()
  })

  it('tells the relation from the lists', () => {
    expect(relationIn(friends, 'test-user', 'test-user')).toBe('self')
    expect(relationIn(friends, 'test-user', 'u-bran')).toBe('friend')
    expect(relationIn(friends, 'test-user', 'u-lyra')).toBe('received')
    expect(relationIn(friends, 'test-user', 'u-ilan')).toBe('none')
    expect(relationIn(null, 'test-user', 'u-bran')).toBe('none')
  })
})
