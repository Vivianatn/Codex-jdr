import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { db } from '@/db/db'
import { createEntity, normalizeSkill } from '@/domain/entity'
import { newItem } from '@/domain/items'
import type { Entity } from '@/domain/types'
import { starterConditions } from '@/domain/conditions'
import { configuredRules, TEST_CONDITIONS } from '@/test/fixtures'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { useUiStore } from '@/stores/uiStore'
import { renderApp } from '@/test/renderApp'

const rules = configuredRules()
const entity = (id: string) => useCampaignStore.getState().entities[id]!

beforeEach(async () => {
  await useCampaignStore.getState().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  useUiStore.setState({ diceOpen: false, playSheetId: null })
  campaignHistory.getState().clear()
  await Promise.all([
    db.campaigns.clear(),
    db.entities.clear(),
    db.rolls.clear(),
    db.itemLibrary.clear(),
  ])
})

async function openSheet(e: Entity, tab?: string) {
  const c = await campaignRepository.create({ name: 'Test' })
  // A GM who enabled the optional mechanics and defined a condition with effects.
  await campaignRepository.updateRules(c.id, rules)
  await campaignRepository.updateLibrary(c.id, {
    conditions: [...starterConditions(), { ...TEST_CONDITIONS.stunned, id: 'stunned-1-turn' }],
    macros: [],
  })
  await db.entities.add({ ...e, campaignId: c.id })
  const app = renderApp(`/c/${c.id}/prep/players/e/${e.id}`)
  await screen.findByRole('heading', { level: 1, name: e.identity.pseudo })
  if (tab) await app.user.click(screen.getByRole('tab', { name: tab }))
  return { ...app, campaignId: c.id }
}

function gorak(): Entity {
  return createEntity('player', '', rules, { identity: { pseudo: 'Gorak' }, hpRoll: 14 })
}

describe('quick HP field', () => {
  it('applies damage, healing and temporary HP; rejects nonsense', async () => {
    const g = gorak()
    const { user } = await openSheet(g)
    const field = screen.getByLabelText('Modifier les PV de Gorak')
    await user.type(field, '-7{Enter}')
    expect(entity(g.id).hp.current).toBe(18)
    expect(field).toHaveValue('')
    await user.type(field, 't+4{Enter}')
    expect(entity(g.id).hp.temp).toBe(4)
    await user.type(field, 'abc{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Écris par exemple -7, +5 ou t+4.')
    await user.clear(field)
    await user.type(field, '-14{Enter}')
    expect(entity(g.id).hp).toMatchObject({ current: 8, temp: 0 })
    expect(screen.getAllByText('Blessé').length).toBeGreaterThan(0)
  })
})

describe('characteristic checks', () => {
  it('clicking a characteristic rolls a check shown in the roll feed and the history', async () => {
    const g = gorak()
    const { user } = await openSheet(g, 'Statistiques')
    await user.click(screen.getByRole('button', { name: 'Tester Force (10)' }))
    const feed = await screen.findByTestId('roll-feed')
    expect(within(feed).getByText('Test de Force')).toBeInTheDocument()
    expect(within(feed).getByText(/Réussite|Échec/)).toBeInTheDocument()
    expect(useRollStore.getState().rolls).toHaveLength(1)
    expect(useRollStore.getState().rolls[0]).toMatchObject({ entityId: g.id, kind: 'check' })
  })

  it('the actions menu offers characteristic-specific checks', async () => {
    const g = gorak()
    const { user } = await openSheet(g, 'Statistiques')
    await user.click(screen.getByRole('button', { name: 'Actions de Dextérité' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Discrétion' }))
    await waitFor(() =>
      expect(useRollStore.getState().rolls[0]?.label).toBe('Discrétion (Dextérité)'),
    )
  })
})

describe('conditions', () => {
  it('adds a condition from the library and lets it expire when a turn passes', async () => {
    const g = gorak()
    const { user } = await openSheet(g, 'État')
    // The starter 'Étourdi' has no duration; the GM-defined one (same name) lasts 1 turn.
    await user.selectOptions(screen.getByLabelText('Depuis la bibliothèque'), 'Étourdi (1 tour)')
    await user.click(screen.getAllByRole('button', { name: 'Ajouter' })[0]!)
    expect(entity(g.id).conditions.map((c) => c.name)).toEqual(['Étourdi'])
    // Étourdi: Dexterity −2 while active.
    await user.click(screen.getAllByRole('button', { name: 'Passer un tour' })[0]!)
    expect(entity(g.id).conditions).toEqual([])
    expect(await screen.findByText('Étourdi a expiré pour Gorak')).toBeInTheDocument()
  })
})

describe('inventory', () => {
  it('uses a consumable: heals and spends one unit', async () => {
    const g = gorak()
    g.hp.current = 5
    g.inventory = [
      newItem({
        name: 'Potion de soin',
        type: 'consumable',
        quantity: 2,
        use: { kind: 'heal', expression: '2d4' },
      }),
    ]
    const { user } = await openSheet(g, 'Inventaire')
    await user.click(screen.getByRole('button', { name: 'Utiliser' }))
    expect(entity(g.id).inventory[0]?.quantity).toBe(1)
    expect(entity(g.id).hp.current).toBeGreaterThanOrEqual(7)
  })

  it('changes the purse with tolerant input', async () => {
    const g = gorak()
    const { user } = await openSheet(g, 'Inventaire')
    await user.type(screen.getByLabelText(/Ajouter ou retirer de l’argent/), '3 po 5 pa{Enter}')
    expect(entity(g.id).purse).toBe(350)
    expect(screen.getByText('3 po 5 pa')).toBeInTheDocument()
  })
})

describe('dice tray', () => {
  it('rolls free notation, rejects invalid notation and keeps the history', async () => {
    const g = gorak()
    const { user } = await openSheet(g)
    await user.click(screen.getByRole('button', { name: 'Dés et historique des jets' }))
    const tray = await screen.findByRole('complementary', { name: 'Dés' })
    const expression = within(tray).getByLabelText('Expression')
    await user.clear(expression)
    await user.type(expression, '2d6+3{Enter}')
    expect(useRollStore.getState().rolls[0]).toMatchObject({
      expression: '2d6+3',
      kind: 'free',
      entityId: null,
    })
    await user.clear(expression)
    await user.type(expression, '2d6+{Enter}')
    expect(within(tray).getByRole('alert')).toHaveTextContent('L’expression s’arrête trop tôt.')
    expect(within(tray).getByRole('list', { name: 'Historique' }).children).toHaveLength(1)
  })
})

describe('level up', () => {
  it('XP unlocks the level-up assistant, which applies +1 max HP', async () => {
    const g = gorak()
    const { user } = await openSheet(g, 'Statistiques')
    await user.type(screen.getByLabelText('Ajouter de l’XP'), '150{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Niveau supérieur !' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gorak monte de niveau' })
    expect(within(dialog).getByText('PV max 25 → 26')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Passer au niveau 2' }))
    expect(entity(g.id)).toMatchObject({ level: 2, hp: { current: 26 } })
  })
})

describe('active skills', () => {
  it('launches a skill on a target and puts it on cooldown', async () => {
    const g = gorak()
    g.skills = [
      normalizeSkill({
        id: 'cleave',
        name: 'Taillade',
        kind: 'active',
        cooldown: 2,
        effect: { kind: 'damage', expression: '5', conditionId: null },
      }),
    ]
    const c = await campaignRepository.create({ name: 'Test' })
    const goblin = createEntity('enemy', c.id, rules, {
      identity: { pseudo: 'Gobelin 1' },
      hpRoll: 4,
    })
    await db.entities.bulkAdd([{ ...g, campaignId: c.id }, goblin])
    const { user } = renderApp(`/c/${c.id}/prep/players/e/${g.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Gorak' })
    await user.click(screen.getByRole('tab', { name: 'Compétences' }))
    await user.click(screen.getByRole('button', { name: 'Lancer Taillade' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Gobelin 1/)).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Lancer' }))
    expect(entity(goblin.id).hp.current).toBe(15 - 5)
    expect(screen.getByRole('button', { name: 'Lancer Taillade' })).toBeDisabled()
    expect(screen.getByText('Recharge : 2 tours')).toBeInTheDocument()
  })
})
