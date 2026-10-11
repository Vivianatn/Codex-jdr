import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bestiaryRepository } from '@/db/bestiary'
import { campaignRepository } from '@/db/campaigns'
import { db } from '@/db/db'
import { createEntity } from '@/domain/entity'
import { STAT_KEYS } from '@/domain/types'
import { defaultRules } from '@/rules'
import { campaignHistory, flushAutosave, useCampaignStore } from '@/stores/campaignStore'
import { renderApp } from '@/test/renderApp'

const rules = defaultRules()
const STAT_LABELS = [
  'Force',
  'Constitution',
  'Dextérité',
  'Intelligence',
  'Charisme',
  'Sagesse',
  'Chance',
]

beforeEach(async () => {
  await useCampaignStore.getState().unload()
  await Promise.all([db.campaigns.clear(), db.entities.clear(), db.bestiary.clear()])
})

async function newCampaign() {
  return campaignRepository.create({ name: 'Test' })
}

const storeEntities = () => Object.values(useCampaignStore.getState().entities)

describe('creation wizard', () => {
  it('creates a player from pre-rolled values and blocks until 2 actives / 1 passive / 1 class passive', async () => {
    const c = await newCampaign()
    const { user, router } = renderApp(`/c/${c.id}/prep/players/new?kind=player`)
    const next = async () => user.click(screen.getByRole('button', { name: /Suivant/ }))

    // 1. Identity
    expect(await screen.findByRole('heading', { name: 'Nouveau joueur' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled()
    await user.type(screen.getByLabelText(/Pseudo/), 'Gorak')
    await user.type(screen.getByLabelText('Classe'), 'Barbare')
    await next()

    // 2. Characteristics, typed in (rolled beforehand)
    expect(screen.getByText('Il manque 7 caractéristiques.')).toBeInTheDocument()
    await screen.findByLabelText('Force')
    for (const [i, label] of STAT_LABELS.entries()) {
      await user.type(screen.getByLabelText(label), String(10 + i))
    }
    await next()

    // 3. HP: 10 + 14 + 1
    await user.type(await screen.findByLabelText('Jet de PV (1d20)'), '14')
    expect(screen.getByText('10 + 14 + 1 = 25')).toBeInTheDocument()
    await next()

    // 4. Skills: blocked until exactly 2 / 1 / 1
    await screen.findByRole('button', { name: 'Ajouter : Compétences actives' })
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled()
    const addSkill = async (group: string, name: string) => {
      await user.click(screen.getByRole('button', { name: `Ajouter : ${group}` }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Nom'), name)
      await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    }
    await addSkill('Compétences actives', 'Rage')
    await addSkill('Compétences actives', 'Cri de guerre')
    await addSkill('Compétences passives', 'Endurci')
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled()
    await addSkill('Passif de classe', 'Peau de pierre')
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeEnabled()
    // A third active breaks the rule again.
    await addSkill('Compétences actives', 'Charge')
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retirer : Charge' }))
    await next()

    // 5. Inventory, 6. Recap
    await user.type(await screen.findByLabelText('Ajouter un objet'), 'Potion de soin')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await next()
    expect(await screen.findByText(/# fiche Gorak/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer la fiche' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Gorak' })).toBeInTheDocument()
    const [gorak] = storeEntities()
    expect(gorak).toMatchObject({
      kind: 'player',
      level: 1,
      hp: { roll: 14, current: 25, temp: 0 },
      stats: { strength: 10, luck: 16 },
    })
    expect(gorak?.skills.map((s) => s.kind).sort()).toEqual([
      'active',
      'active',
      'class',
      'passive',
    ])
    expect(gorak?.inventory.map((i) => i.name)).toEqual(['Potion de soin'])
    expect(gorak?.journal[0]?.text).toBe('Gorak rejoint la campagne')
    expect(router.state.location.pathname).toBe(`/c/${c.id}/prep/players/e/${gorak?.id}`)

    await flushAutosave()
    expect(await db.entities.get(gorak!.id)).toBeDefined()
  })

  it('accepts the two d20 of each characteristic and rounds up', async () => {
    const c = await newCampaign()
    const { user } = renderApp(`/c/${c.id}/prep/allies/new?kind=familiar`)
    expect(await screen.findByRole('heading', { name: 'Nouveau familier' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Pseudo/), 'Plume')
    await user.click(screen.getByRole('button', { name: /Suivant/ }))
    await user.click(await screen.findByRole('radio', { name: 'Les deux d20' }))
    for (const label of STAT_LABELS) {
      await user.type(screen.getByLabelText(`${label} — d20 n°1`), '14')
      await user.type(screen.getByLabelText(`${label} — d20 n°2`), '9')
    }
    // (14 + 9) / 2 = 11.5 → 12, and the step is complete.
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /Suivant/ }))
    await user.type(await screen.findByLabelText('Jet de PV (1d20)'), '5')
    await user.click(screen.getByRole('button', { name: /Suivant/ }))
    // Skills are not enforced for familiars by default.
    expect(await screen.findByText(/Facultatif/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Suivant/ }))
    await screen.findByLabelText('Ajouter un objet')
    await user.click(screen.getByRole('button', { name: /Suivant/ }))
    await user.click(await screen.findByRole('button', { name: 'Créer la fiche' }))
    await screen.findByRole('heading', { level: 1, name: 'Plume' })
    expect(storeEntities()[0]).toMatchObject({
      kind: 'familiar',
      stats: { strength: 12, luck: 12 },
    })
  })
})

describe('character sheet', () => {
  it('levels up (+1 max HP per level), journals it, and Ctrl+Z undoes it', async () => {
    const c = await newCampaign()
    const gorak = createEntity('player', c.id, rules, { identity: { pseudo: 'Gorak' }, hpRoll: 14 })
    await db.entities.add(gorak)
    const { user } = renderApp(`/c/${c.id}/prep/players/e/${gorak.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Gorak' })

    await user.click(screen.getByRole('tab', { name: 'Statistiques' }))
    const level = screen.getByLabelText('Niveau')
    await user.clear(level)
    await user.type(level, '3{Enter}')
    expect(screen.getByText(/10 \+ 14 \+ 1 \+ 2 = 27/)).toBeInTheDocument()
    expect(useCampaignStore.getState().entities[gorak.id]?.hp.current).toBe(27)

    await user.click(screen.getByRole('tab', { name: 'Journal' }))
    expect(screen.getByText('Niveau 1 → 3')).toBeInTheDocument()

    await user.keyboard('{Control>}z{/Control}')
    expect(useCampaignStore.getState().entities[gorak.id]?.level).toBe(1)
    expect(campaignHistory.getState().canRedo).toBe(true)
  })

  it('adds a stat modifier and shows the effective value', async () => {
    const c = await newCampaign()
    const e = createEntity('ally', c.id, rules, { identity: { pseudo: 'Bran' } })
    await db.entities.add(e)
    const { user } = renderApp(`/c/${c.id}/prep/allies/e/${e.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Bran' })
    await user.click(screen.getByRole('tab', { name: 'Statistiques' }))
    await user.type(screen.getByLabelText('Valeur'), '3')
    await user.type(screen.getByLabelText('Source'), 'Gantelets')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(screen.getByLabelText('Effectif 13')).toBeInTheDocument()
    expect(useCampaignStore.getState().entities[e.id]?.modifiers).toEqual([
      expect.objectContaining({ stat: 'strength', value: 3, label: 'Gantelets' }),
    ])
  })
})

describe('Discord import', () => {
  it('imports a pasted sheet as a new player', async () => {
    const c = await newCampaign()
    const { user } = renderApp(`/c/${c.id}/prep/players`)
    await user.click(await screen.findByRole('button', { name: 'Importer depuis Discord' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText('Fiche Discord'))
    await user.paste(
      [
        '# fiche lyra_88',
        '## Identité :',
        '- Pseudo : Lyra',
        '## Statistiques :',
        '- Niveau : 2',
        '- PV(points de vie): 28',
        ...STAT_LABELS.map((l) => `- ${l} : 12`),
        '## Compétences :',
        '- [Active] Tir précis',
      ].join('\n'),
    )
    expect(within(dialog).getByText(/7\/7 caractéristiques/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Importer la fiche' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Lyra' })).toBeInTheDocument()
    const [lyra] = storeEntities()
    expect(lyra).toMatchObject({
      level: 2,
      hp: { roll: 16, current: 28 },
      identity: { discordName: 'lyra_88' },
    })
    expect(STAT_KEYS.every((k) => lyra?.stats[k] === 12)).toBe(true)
  })
})

describe('bestiary', () => {
  it('adds numbered copies of a template to the campaign', async () => {
    const c = await newCampaign()
    const goblin = createEntity('enemy', '', rules, { identity: { pseudo: 'Gobelin' }, hpRoll: 4 })
    await bestiaryRepository.save(goblin)
    const { user } = renderApp(`/c/${c.id}/prep/bestiary`)

    await user.click(await screen.findByRole('button', { name: 'Ajouter à la campagne : Gobelin' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Seront créés : de « Gobelin 1 » à « Gobelin 3 »'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))

    const instances = await screen.findByRole('list', { name: 'Ennemis de la campagne' })
    for (const n of [1, 2, 3])
      expect(within(instances).getByText(`Gobelin ${n}`)).toBeInTheDocument()
    expect(storeEntities()).toHaveLength(3)

    // The undo button in the toast removes the whole batch at once.
    campaignHistory.getState().undo()
    await waitFor(() => expect(storeEntities()).toHaveLength(0))
  })
})

describe('campaign rules', () => {
  it('changing HP per level updates every sheet immediately', async () => {
    const c = await newCampaign()
    const e = createEntity('player', c.id, rules, {
      identity: { pseudo: 'Gorak' },
      hpRoll: 14,
      level: 5,
    })
    await db.entities.add(e)
    const { user, router } = renderApp(`/c/${c.id}/prep/rules`)
    const perLevel = await screen.findByLabelText('PV max gagnés par niveau')
    await user.clear(perLevel)
    await user.type(perLevel, '3{Enter}')
    await waitFor(async () =>
      expect((await campaignRepository.get(c.id))?.rules.hp.perLevel).toBe(3),
    )

    await router.navigate(`/c/${c.id}/prep/players/e/${e.id}`)
    await user.click(await screen.findByRole('tab', { name: 'Statistiques' }))
    // 10 + 14 + 1 + 4 levels × 3
    expect(screen.getByText(/= 37/)).toBeInTheDocument()
  })

  it('refuses a face that is both a critical success and failure', async () => {
    const c = await newCampaign()
    const { user } = renderApp(`/c/${c.id}/prep/rules`)
    const fields = await screen.findAllByLabelText('Mineur')
    await user.clear(fields[0]!)
    await user.type(fields[0]!, '2, 19{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('à la fois une réussite et un échec')
    expect((await campaignRepository.get(c.id))?.rules.checks.criticalSuccess.minor).toEqual([2])
  })
})
