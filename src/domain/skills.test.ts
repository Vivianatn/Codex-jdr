import { beforeEach, describe, expect, it } from 'vitest'
import { activeDb } from '@/db/db'
import { defaultRules, hpMaxAt } from '@/rules'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { createEntity, entityHpMax, normalizeSkill } from './entity'
import { familiarsOf, freeFamiliars, ownerOptions, withOwner } from './familiars'
import {
  adoptSkills,
  attachSkill,
  newSkillDefinition,
  skillFromDefinition,
  syncSkill,
} from './skills'

const rules = defaultRules()

describe('skill library (D-218)', () => {
  it('attaching gives a linked copy with full uses; attaching twice does nothing', () => {
    const def = { ...newSkillDefinition('active', 'c1'), name: 'Rage', usesMax: 2 }
    const e = attachSkill(createEntity('enemy', 'c1', rules), def)
    expect(e.skills[0]).toMatchObject({ name: 'Rage', sourceId: def.id, usesLeft: 2 })
    expect(attachSkill(e, def)).toBe(e)
  })

  it('syncing keeps the per-character state', () => {
    const def = { ...newSkillDefinition('active', 'c1'), name: 'Rage', usesMax: 3, cooldown: 4 }
    const copy = { ...skillFromDefinition(def), usesLeft: 1, cooldownLeft: 3, enabled: false }
    const synced = syncSkill(copy, { ...def, name: 'Fureur', usesMax: 2, cooldown: 2 })
    expect(synced).toMatchObject({ name: 'Fureur', usesLeft: 1, cooldownLeft: 2, enabled: false })
  })

  it('adopts loose skills, merging identical ones', () => {
    const a = createEntity('player', 'c1', rules)
    const b = createEntity('ally', 'c1', rules)
    a.skills = [normalizeSkill({ id: 's1', name: 'Rage', kind: 'active', description: 'Grr' })]
    b.skills = [
      normalizeSkill({ id: 's2', name: 'rage ', kind: 'active', description: 'Grr' }),
      normalizeSkill({ id: 's3', name: 'Rage', kind: 'passive', description: '' }),
    ]
    const { added, entities } = adoptSkills([a, b], {}, 'c1')
    expect(added.map((d) => `${d.kind}:${d.name}`)).toEqual(['active:Rage', 'passive:Rage'])
    expect(entities[0]!.skills[0]!.sourceId).toBe(entities[1]!.skills[0]!.sourceId)
    expect(entities[1]!.skills[1]!.sourceId).toBe(added[1]!.id)
  })
})

describe('campaign store: skills are shared and undoable', () => {
  beforeEach(async () => {
    await useCampaignStore.getState().unload()
    await activeDb().entities.clear()
    await activeDb().skills.clear()
  })

  it('editing a library skill updates every holder in one undo step', async () => {
    const def = { ...newSkillDefinition('passive', 'c1'), name: 'Colosse' }
    const a = attachSkill(createEntity('player', 'c1', rules), def)
    const b = attachSkill(createEntity('enemy', 'c1', rules), def)
    await activeDb().skills.add(def)
    await activeDb().entities.bulkAdd([a, b])
    await useCampaignStore.getState().load('c1')

    useCampaignStore.getState().saveSkill({ ...def, name: 'Titan' }, 'edit')
    const names = () =>
      Object.values(useCampaignStore.getState().entities).map((e) => e.skills[0]!.name)
    expect(names()).toEqual(['Titan', 'Titan'])
    campaignHistory.getState().undo()
    expect(names()).toEqual(['Colosse', 'Colosse'])
    expect(useCampaignStore.getState().skills[def.id]!.name).toBe('Colosse')
  })

  it('old characters are adopted into the library when the campaign opens', async () => {
    const old = createEntity('player', 'c1', rules)
    old.skills = [normalizeSkill({ id: 'x', name: 'Charge', kind: 'active' })]
    await activeDb().entities.add(old)
    await useCampaignStore.getState().load('c1')
    const { skills, entities } = useCampaignStore.getState()
    const [def] = Object.values(skills)
    expect(def?.name).toBe('Charge')
    expect(entities[old.id]!.skills[0]!.sourceId).toBe(def!.id)
  })

  it('deleting a library skill removes it from every holder', async () => {
    const def = { ...newSkillDefinition('active', 'c1'), name: 'Coup' }
    const a = attachSkill(createEntity('player', 'c1', rules), def)
    await activeDb().skills.add(def)
    await activeDb().entities.add(a)
    await useCampaignStore.getState().load('c1')
    useCampaignStore.getState().removeSkill(def.id, 'delete')
    expect(useCampaignStore.getState().entities[a.id]!.skills).toEqual([])
  })
})

describe('HP given directly', () => {
  it('keeps the given max and applies the per-level rule afterwards', () => {
    const e = createEntity('player', 'c1', rules, { level: 5, hpMax: 60 })
    expect(entityHpMax(e, rules)).toBe(60)
    expect(e.hp.current).toBe(60)
    expect(hpMaxAt(e.hp, 7, rules)).toBe(62) // +1 per level
    expect(hpMaxAt(e.hp, 3, rules)).toBe(58)
  })
})

describe('familiars', () => {
  it('can belong to a player, an ally or an enemy', () => {
    const player = createEntity('player', 'c1', rules, { identity: { pseudo: 'Lyra' } })
    const ogre = createEntity('enemy', 'c1', rules, { identity: { pseudo: 'Ogre' } })
    const cat = createEntity('familiar', 'c1', rules, { identity: { pseudo: 'Chat' } })
    const wolf = withOwner(createEntity('familiar', 'c1', rules), ogre.id)
    const all = [player, ogre, cat, wolf]
    expect(ownerOptions(all).map((o) => o.kind)).toEqual(['player', 'enemy'])
    expect(familiarsOf(all, ogre.id)).toEqual([wolf])
    expect(freeFamiliars(all)).toEqual([cat])
  })

  it('removing a master frees its familiars, and undo restores the link', async () => {
    await useCampaignStore.getState().unload()
    await activeDb().entities.clear()
    const ogre = createEntity('enemy', 'c1', rules)
    const wolf = withOwner(createEntity('familiar', 'c1', rules), ogre.id)
    await activeDb().entities.bulkAdd([ogre, wolf])
    await useCampaignStore.getState().load('c1')
    useCampaignStore.getState().removeEntity(ogre.id, 'remove')
    const ownerOf = () => {
      const f = useCampaignStore.getState().entities[wolf.id]!
      return f.kind === 'familiar' ? f.details.ownerId : 'not a familiar'
    }
    expect(ownerOf()).toBeNull()
    campaignHistory.getState().undo()
    expect(ownerOf()).toBe(ogre.id)
  })
})
