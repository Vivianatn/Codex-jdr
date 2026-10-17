import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { withOwner } from '@/domain/familiars'
import { addGroup, addMember, type PlayState } from '@/domain/turns'
import { useOnlineStore } from '@/online/onlineStore'
import { configuredRules, startLocalGame } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

const rules = configuredRules()
const store = () => useCampaignStore.getState()

beforeEach(async () => {
  await store().unload()
  useUiStore.setState({
    quickId: null,
    playSheetId: null,
    play: { rail: true, partyCompact: false, quickTab: 'items', playerSheet: true },
  })
  useOnlineStore.setState({ peers: [] })
  campaignHistory.getState().clear()
  await Promise.all([activeDb().campaigns.clear(), activeDb().entities.clear()])
})

async function table() {
  const c = await campaignRepository.create({ name: 'Table' })
  const lyra = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' }, hpRoll: 10 })
  lyra.details = { ...lyra.details, color: 'azure' } as typeof lyra.details
  const gorak = createEntity('player', c.id, rules, { identity: { pseudo: 'Gorak' }, hpRoll: 10 })
  const gob = createEntity('enemy', c.id, rules, { identity: { pseudo: 'Gobelin' }, hpRoll: 4 })
  const owl = withOwner(
    createEntity('familiar', c.id, rules, { identity: { pseudo: 'Hibou' }, hpMax: 6 }),
    lyra.id,
  )
  await activeDb().entities.bulkAdd([lyra, gorak, gob, owl])
  await startLocalGame(c.id)
  const app = renderApp(`/c/${c.id}/play`)
  await screen.findByRole('region', { name: 'Tours de jeu' })
  return { ...app, lyra, gorak, gob, owl }
}

/** One group with these members, in this order. */
function heroes(...ids: string[]) {
  store().updatePlay((p: PlayState) => {
    const withGroup = addGroup(p, 'Héros')
    const id = withGroup.groups[0]!.id
    return ids.reduce((acc, m) => addMember(acc, id, m), withGroup)
  }, 'setup')
}

describe('party strip (D-272)', () => {
  it('shows every player character in its colour, with HP, turn and familiars', async () => {
    const { user, lyra, gorak } = await table()
    const strip = await screen.findByRole('region', { name: 'Joueurs à la table' })
    // Players only; enemies stay out of it.
    expect(within(strip).queryByText('Gobelin')).toBeNull()
    expect(within(strip).getByRole('button', { name: /^Gorak : / })).toBeInTheDocument()
    const lyraCard = within(strip).getByRole('button', { name: /^Lyra : \d+ \/ \d+ PV/ })
    expect(lyraCard.closest('li')).toHaveAttribute('data-player-color', 'azure')
    // Familiars joined to their master.
    expect(
      within(strip).getByRole('button', { name: /^Hibou, familier de Lyra/ }),
    ).toBeInTheDocument()

    heroes(gorak.id, lyra.id)
    await user.click(screen.getByRole('button', { name: 'Commencer les tours' }))
    expect(within(strip).getByRole('button', { name: /^Gorak : .*à son tour/ })).toBeInTheDocument()

    // A tap opens the quick panel.
    await user.click(lyraCard)
    expect(
      await screen.findByRole('complementary', { name: 'Manipulation rapide : Lyra' }),
    ).toBeInTheDocument()
  })

  it('says which players are connected to an online game', async () => {
    const { lyra } = await table()
    store().updatePlay(
      (p: PlayState) => ({ ...p, live: p.live ? { ...p.live, mode: 'online' as const } : p.live }),
      'online',
    )
    useOnlineStore.setState({
      peers: [
        {
          id: 'acc-1',
          name: 'Agathe',
          role: 'player',
          status: 'connected',
          characterIds: [lyra.id],
        },
      ],
    })
    const strip = await screen.findByRole('region', { name: 'Joueurs à la table' })
    expect(
      await within(strip).findByRole('button', { name: /^Lyra : .*, en ligne/ }),
    ).toBeInTheDocument()
    expect(within(strip).getByRole('button', { name: /^Gorak : .*hors ligne/ })).toBeInTheDocument()
  })

  it('folds to portraits, remembered on this device', async () => {
    const { user } = await table()
    await user.click(screen.getByRole('button', { name: 'Réduire la bande des joueurs' }))
    expect(useUiStore.getState().play.partyCompact).toBe(true)
    expect(screen.getByRole('button', { name: 'Déplier la bande des joueurs' })).toBeInTheDocument()
  })
})

describe('turns rail (D-272)', () => {
  it('folds away and comes back, remembered on this device', async () => {
    const { user } = await table()
    expect(screen.getByRole('complementary', { name: 'Accès rapide' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Masquer les tours et groupes' }))
    expect(screen.queryByRole('complementary', { name: 'Accès rapide' })).toBeNull()
    expect(useUiStore.getState().play.rail).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Afficher les tours et groupes' }))
    expect(screen.getByRole('complementary', { name: 'Accès rapide' })).toBeInTheDocument()
  })

  it('orders and removes a member from its row menu', async () => {
    const { user, lyra, gorak } = await table()
    heroes(gorak.id, lyra.id)
    const card = await screen.findByRole('region', { name: 'Héros' })
    await user.click(within(card).getByRole('button', { name: 'Plateau et tours : Lyra' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Monter Lyra' }))
    expect(store().play.groups[0]!.memberIds).toEqual([lyra.id, gorak.id])

    await user.click(within(card).getByRole('button', { name: 'Plateau et tours : Gorak' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Retirer Gorak du groupe' }))
    expect(store().play.groups[0]!.memberIds).toEqual([lyra.id])

    // Group order and deletion sit in the group menu.
    await user.click(within(card).getByRole('button', { name: 'Actions du groupe Héros' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer le groupe Héros' }))
    expect(store().play.groups).toEqual([])
  })
})

describe('quick panel sections (D-272)', () => {
  it('shows items or conditions, one at a time, the choice remembered', async () => {
    const { user } = await table()
    await user.click(screen.getByRole('button', { name: 'Manipuler Gobelin' }))
    const panel = await screen.findByRole('complementary', {
      name: 'Manipulation rapide : Gobelin',
    })
    // Tests and characteristics share one grid.
    expect(
      within(panel).getByRole('button', { name: 'Tester Force pour Gobelin' }),
    ).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Ajouter 1 en Force' })).toBeInTheDocument()
    expect(within(panel).getByLabelText('Nouvel objet')).toBeInTheDocument()

    await user.click(within(panel).getByRole('radio', { name: 'États' }))
    expect(within(panel).queryByLabelText('Nouvel objet')).toBeNull()
    expect(within(panel).getByRole('region', { name: 'États' })).toHaveTextContent('Aucun état')
    expect(useUiStore.getState().play.quickTab).toBe('conditions')
  })
})
