import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { withOwner } from '@/domain/familiars'
import { newMap } from '@/domain/maps'
import { configuredRules, startLocalGame } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

const rules = configuredRules()
const store = () => useCampaignStore.getState()

beforeEach(async () => {
  await store().unload()
  useUiStore.setState({ quickId: null, playSheetId: null })
  campaignHistory.getState().clear()
  await Promise.all([activeDb().campaigns.clear(), activeDb().entities.clear()])
})

async function playScreen() {
  const c = await campaignRepository.create({ name: 'Tours' })
  const lyra = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' }, hpRoll: 10 })
  const gorak = createEntity('player', c.id, rules, { identity: { pseudo: 'Gorak' }, hpRoll: 10 })
  const gob = createEntity('enemy', c.id, rules, { identity: { pseudo: 'Gobelin 1' }, hpRoll: 4 })
  await activeDb().entities.bulkAdd([lyra, gorak, gob])
  await startLocalGame(c.id)
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
      name: 'Manipulation rapide : Gobelin 1',
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

describe('familiars and the GM’s board in play (D-269)', () => {
  async function withFamiliars() {
    const c = await campaignRepository.create({ name: 'Familiers' })
    const lyra = createEntity('player', c.id, rules, { identity: { pseudo: 'Lyra' }, hpRoll: 10 })
    const gob = createEntity('enemy', c.id, rules, { identity: { pseudo: 'Gobelin' }, hpRoll: 4 })
    const guard = createEntity('ally', c.id, rules, { identity: { pseudo: 'Garde' }, hpRoll: 4 })
    const owl = withOwner(
      createEntity('familiar', c.id, rules, { identity: { pseudo: 'Hibou' }, hpMax: 6 }),
      lyra.id,
    )
    const rat = withOwner(
      createEntity('familiar', c.id, rules, { identity: { pseudo: 'Rat' }, hpMax: 3 }),
      gob.id,
    )
    const dog = withOwner(
      createEntity('familiar', c.id, rules, { identity: { pseudo: 'Chien' }, hpMax: 5 }),
      guard.id,
    )
    const stray = createEntity('familiar', c.id, rules, { identity: { pseudo: 'Chat errant' } })
    await activeDb().entities.bulkAdd([lyra, gob, guard, owl, rat, dog, stray])
    await startLocalGame(c.id)
    const app = renderApp(`/c/${c.id}/play`)
    await screen.findByRole('region', { name: 'Tours de jeu' })
    return { ...app, campaign: c, lyra, gob, guard, owl, rat, dog, stray }
  }

  it('a familiar is listed under its master and plays at its turn', async () => {
    const { user, lyra } = await withFamiliars()
    // Not offered as a member of its own: it follows its master.
    await createGroup(user, 'Héros', ['Lyra (Joueur)'])
    const card = screen.getByRole('region', { name: 'Héros' })
    const options = within(card)
      .queryAllByRole('option')
      .map((o) => o.textContent)
    expect(options).not.toContain('Hibou (Familier)')
    expect(within(card).getByRole('list', { name: 'Joue au tour de Lyra' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Commencer les tours' }))
    expect(store().play.turn).toMatchObject({ memberId: lyra.id })
    const banner = screen.getByRole('region', { name: 'Tours de jeu' })
    expect(
      within(banner).getByRole('button', { name: 'Manipuler Hibou — Joue au tour de Lyra' }),
    ).toBeInTheDocument()
    // One tap to roll for each actor.
    const actors = within(banner).getByRole('list', { name: 'Qui joue' })
    await user.click(within(actors).getByRole('button', { name: 'Lancer les dés pour Hibou' }))
    const panel = await screen.findByRole('complementary', {
      name: 'Manipulation rapide : Hibou',
    })
    expect(within(panel).getByText('Familier de Lyra')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Tester Dextérité pour Hibou' }))
    expect(store().play.groups[0]!.memberIds).toEqual([lyra.id])
  })

  it('adds only the familiars of player characters and enemies, next to their master', async () => {
    const { user, campaign, lyra, owl } = await withFamiliars()
    const map = newMap(campaign.id, { name: 'Crypte', cols: 8, rows: 8 })
    map.tokens = [{ id: 'tk-lyra', entityId: lyra.id, col: 3, row: 3, size: 1, hidden: false }]
    store().addMap(map, 'map')
    store().updatePlay((p) => ({ ...p, mapId: map.id }), 'map')

    const section = await screen.findByRole('region', { name: 'Ajouter un familier' })
    // A rare gesture: folded until the GM opens it (D-272).
    expect(within(section).queryByText('Rat')).toBeNull()
    await user.click(within(section).getByRole('button', { name: 'Ajouter un familier' }))
    expect(within(section).queryByText('Chien')).toBeNull()
    expect(within(section).queryByText('Chat errant')).toBeNull()
    expect(within(section).getByText('Rat')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Placer Hibou' }))
    const placed = store().maps[map.id]!.tokens.find((tk) => tk.entityId === owl.id)!
    expect(Math.max(Math.abs(placed.col - 3), Math.abs(placed.row - 3))).toBe(1)
    expect(within(section).getByText('déjà sur le plateau')).toBeInTheDocument()
  })

  it('the GM deletes an enemy after confirming, and takes a player off the board', async () => {
    const { user, campaign, lyra, gob } = await withFamiliars()
    const map = newMap(campaign.id, { name: 'Crypte', cols: 8, rows: 8 })
    map.tokens = [
      { id: 'tk-lyra', entityId: lyra.id, col: 3, row: 3, size: 1, hidden: false },
      { id: 'tk-gob', entityId: gob.id, col: 5, row: 5, size: 1, hidden: false },
    ]
    store().addMap(map, 'map')
    store().updatePlay((p) => ({ ...p, mapId: map.id }), 'map')

    await user.click(await screen.findByRole('button', { name: 'Manipuler Gobelin' }))
    const panel = await screen.findByRole('complementary', {
      name: 'Manipulation rapide : Gobelin',
    })
    await user.click(within(panel).getByRole('button', { name: 'Supprimer l’ennemi' }))
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer Gobelin ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    expect(store().entities[gob.id]).toBeUndefined()
    expect(store().maps[map.id]!.tokens.map((tk) => tk.id)).toEqual(['tk-lyra'])

    await user.click(screen.getByRole('button', { name: 'Plateau et tours : Lyra' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Retirer du plateau' }))
    expect(store().maps[map.id]!.tokens).toEqual([])
    expect(store().entities[lyra.id]).toBeDefined()
  })

  it('the GM teleports one character from its menu, and several from the panel (D-276)', async () => {
    const { user, campaign, lyra, gob, owl } = await withFamiliars()
    const hall = newMap(campaign.id, { name: 'Hall', cols: 8, rows: 8 })
    hall.tokens = [
      { id: 'tk-lyra', entityId: lyra.id, col: 3, row: 3, size: 1, hidden: false },
      { id: 'tk-owl', entityId: owl.id, col: 4, row: 3, size: 1, hidden: false },
      { id: 'tk-gob', entityId: gob.id, col: 5, row: 5, size: 1, hidden: false },
    ]
    const crypt = newMap(campaign.id, { name: 'Crypte', cols: 8, rows: 8 })
    const cave = newMap(campaign.id, { name: 'Cave', cols: 8, rows: 8 })
    store().addMap(hall, 'map')
    store().addMap(crypt, 'map')
    store().addMap(cave, 'map')
    store().updatePlay((p) => ({ ...p, mapId: hall.id }), 'map')
    const where = (id: string) =>
      Object.values(store().maps).find((m) => m.tokens.some((tk) => tk.entityId === id))?.name

    // Quick path: one click in the character's menu; its familiar follows.
    await user.click(await screen.findByRole('button', { name: 'Plateau et tours : Lyra' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Téléporter Lyra vers…' }))
    // Radix closes a submenu when the pointer leaves its trigger in jsdom: pick by keyboard.
    ;(await screen.findByRole('menuitem', { name: 'Crypte' })).focus()
    await user.keyboard('{Enter}')
    expect(where(lyra.id)).toBe('Crypte')
    expect(where(owl.id)).toBe('Crypte')
    expect(store().play.mapId).toBe(hall.id)

    // Multi path: tick, pick each destination, go.
    await user.click(screen.getByRole('button', { name: 'Téléporter des personnages' }))
    const panel = await screen.findByRole('dialog', { name: 'Téléporter des personnages' })
    await user.click(within(panel).getByRole('button', { name: 'Ennemis' }))
    expect(within(panel).getByRole('checkbox', { name: /Gobelin/ })).toBeChecked()
    expect(within(panel).getByRole('checkbox', { name: /Lyra/ })).not.toBeChecked()
    await user.click(within(panel).getByRole('checkbox', { name: /Lyra/ }))
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Tout envoyer vers' }),
      'Cave',
    )
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Destination de Gobelin' }),
      'Crypte',
    )
    await user.click(within(panel).getByRole('button', { name: 'Téléporter (2)' }))
    expect(where(lyra.id)).toBe('Cave')
    expect(where(owl.id)).toBe('Cave')
    expect(where(gob.id)).toBe('Crypte')
    expect(campaignHistory.getState().past.at(-1)?.label).toBe('2 personnages téléportés')
  })
})
