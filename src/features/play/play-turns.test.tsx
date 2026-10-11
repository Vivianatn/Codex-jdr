import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { db } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { configuredRules } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

const rules = configuredRules()
const store = () => useCampaignStore.getState()

beforeEach(async () => {
  await store().unload()
  useUiStore.setState({ quickId: null, playSheetId: null })
  campaignHistory.getState().clear()
  await Promise.all([db.campaigns.clear(), db.entities.clear()])
})

async function playScreen() {
  const c = await campaignRepository.create({ name: 'Tours' })
  const lyra = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' }, hpRoll: 10 })
  const gorak = createEntity('player', c.id, rules, { identity: { pseudo: 'Gorak' }, hpRoll: 10 })
  const gob = createEntity('enemy', c.id, rules, { identity: { pseudo: 'Gobelin 1' }, hpRoll: 4 })
  await db.entities.bulkAdd([lyra, gorak, gob])
  const app = renderApp(`/c/${c.id}/play`)
  await screen.findByRole('region', { name: 'Tours de jeu' })
  return { ...app, lyra, gorak, gob }
}

async function createGroup(
  user: ReturnType<typeof renderApp>['user'],
  name: string,
  members: string[],
) {
  await user.type(screen.getByLabelText('Nouveau groupe'), name)
  await user.click(screen.getByRole('button', { name: 'Créer le groupe' }))
  const card = await screen.findByRole('region', { name })
  for (const m of members) {
    await user.selectOptions(
      within(card).getByRole('combobox', { name: `Ajouter au groupe ${name}` }),
      m,
    )
    await user.click(within(card).getByRole('button', { name: `Ajouter au groupe ${name}` }))
  }
}

describe('turns by groups (D-226)', () => {
  it('groups play in order, then the GM; the GM resumes the next round', async () => {
    const { user, lyra, gorak, gob } = await playScreen()
    expect(screen.getByRole('button', { name: 'Commencer les tours' })).toBeDisabled()

    await createGroup(user, 'Héros', ['Lyra (Joueur)', 'Gorak (Joueur)'])
    await createGroup(user, 'Gobelins', ['Gobelin 1 (Ennemi)'])
    await user.click(screen.getByRole('button', { name: 'Commencer les tours' }))

    const banner = () => screen.getByRole('region', { name: 'Tours de jeu' })
    expect(within(banner()).getByText('Round 1')).toBeInTheDocument()
    expect(within(banner()).getByText('Au tour du groupe : Héros')).toBeInTheDocument()
    expect(store().play.turn).toMatchObject({ memberId: lyra.id })

    const next = () => user.click(within(banner()).getByRole('button', { name: 'Tour suivant' }))
    await next()
    expect(store().play.turn).toMatchObject({ memberId: gorak.id })
    await next()
    expect(store().play.turn).toMatchObject({ groupId: expect.any(String), memberId: gob.id })
    await next()
    expect(within(banner()).getByText('Tour du MJ')).toBeInTheDocument()
    expect(within(banner()).queryByRole('button', { name: 'Tour suivant' })).toBeNull()

    await user.click(within(banner()).getByRole('button', { name: 'Reprendre' }))
    expect(within(banner()).getByText('Round 2')).toBeInTheDocument()
    expect(store().play.turn).toMatchObject({ round: 2, memberId: lyra.id })

    // Each step is one undo: back to the GM's turn of round 1.
    campaignHistory.getState().undo()
    expect(store().play.turn).toEqual({ status: 'gm', round: 1 })
  })

  it('a character starting its turn gets its start-of-turn effects', async () => {
    const { user, lyra } = await playScreen()
    store().updateEntity(
      lyra.id,
      (e) => ({
        ...e,
        conditions: [
          {
            id: 'c',
            templateId: null,
            name: 'Brûlure',
            note: '',
            icon: 'flame',
            color: 'orange',
            modifiers: [],
            perTurn: { kind: 'damage', expression: '3' },
            save: null,
            concentration: false,
            remaining: null,
          },
        ],
      }),
      'setup',
    )
    await createGroup(user, 'Héros', ['Lyra (Joueur)'])
    await user.click(screen.getByRole('button', { name: 'Commencer les tours' }))
    expect(store().entities[lyra.id]!.hp.current).toBe(21 - 3)
  })
})

describe('quick panel (D-227)', () => {
  it('changes stats, adds and removes a weapon, in a few clicks', async () => {
    const { user, gob } = await playScreen()
    await user.click(screen.getByRole('button', { name: 'Manipuler Gobelin 1' }))
    const panel = await screen.findByRole('complementary', {
      name: 'Manipulation rapide — Gobelin 1',
    })

    await user.click(within(panel).getByRole('button', { name: 'Ajouter 1 en Force' }))
    await user.click(within(panel).getByRole('button', { name: 'Ajouter 1 en Force' }))
    await user.click(within(panel).getByRole('button', { name: 'Retirer 1 en Dextérité' }))
    expect(store().entities[gob.id]!.stats).toMatchObject({ strength: 12, dexterity: 9 })

    await user.type(within(panel).getByLabelText('Nouvel objet'), 'Cimeterre')
    await user.click(within(panel).getByLabelText('Arme'))
    await user.type(within(panel).getByLabelText('Dégâts'), '1d6')
    await user.click(within(panel).getByRole('button', { name: 'Ajouter l’objet' }))
    const [blade] = store().entities[gob.id]!.inventory
    expect(blade).toMatchObject({
      name: 'Cimeterre',
      type: 'weapon',
      damage: '1d6',
      slot: 'mainHand',
    })

    await user.click(within(panel).getByRole('button', { name: 'Déséquiper Cimeterre' }))
    expect(store().entities[gob.id]!.inventory[0]!.slot).toBeNull()
    await user.click(within(panel).getByRole('button', { name: 'Retirer Cimeterre' }))
    expect(store().entities[gob.id]!.inventory).toEqual([])

    await user.type(within(panel).getByLabelText('Modifier les PV de Gobelin 1'), '-5{Enter}')
    expect(store().entities[gob.id]!.hp.current).toBe(10)
  })
})
