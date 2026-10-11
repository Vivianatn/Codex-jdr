import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { defaultRules } from '@/rules'
import { entityFromSheet, parseDiscordSheet, toDiscordMarkdown } from './discord'
import { plainCondition } from './conditions'
import { createEntity, newId, normalizeSkill } from './entity'
import { newItem } from './items'
import { STAT_KEYS, type Entity, type SkillKind, type Stats } from './types'

const rules = defaultRules()

const word = fc.constantFrom(
  'Gorak',
  'épée',
  'du',
  'Nord',
  'lame',
  'sombre',
  'Écho',
  'l’ancien',
  'feu',
  'glace',
  '12',
  'Sœur',
  'à',
  'fer',
  'lune',
  'Ölaf',
)
const phrase = fc.array(word, { minLength: 1, maxLength: 4 }).map((w) => w.join(' '))
const optional = fc.oneof(fc.constant(''), phrase)
const multiline = fc.oneof(
  fc.constant(''),
  fc.array(phrase, { minLength: 1, maxLength: 3 }).map((l) => l.join('\n')),
)
const statKey = fc.constantFrom(...STAT_KEYS)

const entityArb = fc
  .record({
    kind: fc.constantFrom('player' as const, 'ally' as const, 'enemy' as const),
    discordName: phrase,
    pseudo: phrase,
    className: optional,
    weaponType: optional,
    origin: optional,
    description: multiline,
    mindset: multiline,
    level: fc.integer({ min: 1, max: 40 }),
    roll: fc.integer({ min: 1, max: 20 }),
    damage: fc.integer({ min: 0, max: 80 }),
    stats: fc.tuple(...STAT_KEYS.map(() => fc.integer({ min: 1, max: 20 }))),
    skills: fc.array(
      fc.record({
        name: phrase,
        kind: fc.constantFrom<SkillKind>('active', 'passive', 'class'),
        stat: fc.option(statKey, { nil: null }),
        description: multiline,
      }),
      { maxLength: 6 },
    ),
    conditions: fc.array(fc.record({ name: phrase, note: multiline }), { maxLength: 3 }),
    inventory: fc.array(
      fc.record({
        name: phrase,
        quantity: fc.integer({ min: 1, max: 99 }),
        description: multiline,
      }),
      { maxLength: 5 },
    ),
  })
  .map((r): Entity => {
    const e = createEntity(r.kind, 'c1', rules, {
      identity: {
        discordName: r.kind === 'player' ? r.discordName : '',
        pseudo: r.pseudo,
        className: r.className,
        weaponType: r.weaponType,
        origin: r.origin,
        description: r.description,
        mindset: r.mindset,
      },
      level: r.level,
      hpRoll: r.roll,
      stats: Object.fromEntries(STAT_KEYS.map((k, i) => [k, r.stats[i]])) as Stats,
    })
    e.hp.current = Math.max(0, e.hp.current - r.damage)
    e.skills = r.skills.map((s) => normalizeSkill({ ...s, id: newId() }))
    e.conditions = r.conditions.map((c) => plainCondition(c.name, c.note))
    e.inventory = r.inventory.map((i) => newItem(i))
    return e
  })

/** What the Discord format is expected to carry (ids, portrait and journal are not). */
function essence(e: Entity) {
  const { portrait: _portrait, ...identity } = e.identity
  return {
    identity,
    level: e.level,
    hp: { roll: e.hp.roll, current: e.hp.current },
    stats: e.stats,
    // Export groups skills by kind: class, active, passive.
    skills: (['class', 'active', 'passive'] as const).flatMap((kind) =>
      e.skills
        .filter((s) => s.kind === kind)
        .map(({ name, kind, stat, description }) => ({ name, kind, stat, description })),
    ),
    conditions: e.conditions.map(({ name, note }) => ({ name, note })),
    inventory: e.inventory.map(({ name, quantity, description }) => ({
      name,
      quantity,
      description,
    })),
  }
}

describe('Discord export', () => {
  it('follows the reference sheet structure', () => {
    const e = createEntity('player', 'c1', rules, {
      identity: {
        discordName: 'bob#1234',
        pseudo: 'Gorak',
        className: 'Barbare',
        weaponType: 'Hache',
        origin: 'Les Monts Gelés',
        description: 'Grand, balafré.',
        mindset: 'Protéger le clan.',
      },
      hpRoll: 14,
      stats: {
        strength: 15,
        constitution: 12,
        dexterity: 9,
        intelligence: 7,
        charisma: 11,
        wisdom: 10,
        luck: 13,
      },
    })
    e.skills = [
      normalizeSkill({
        id: '1',
        name: 'Rage',
        kind: 'active',
        stat: 'strength',
        description: 'Double les dégâts.',
      }),
      normalizeSkill({
        id: '2',
        name: 'Peau de pierre',
        kind: 'class',
        stat: null,
        description: '',
      }),
    ]
    e.inventory = [newItem({ name: 'Potion de soin', quantity: 2 })]

    expect(toDiscordMarkdown(e, rules)).toBe(
      [
        '# fiche bob#1234',
        '',
        '## Identité :',
        '- Pseudo : Gorak',
        '- Classe : Barbare',
        "- type d'arme : Hache",
        '- provenance : Les Monts Gelés',
        '- Description (texte ou photo) + Mindset :',
        '> Grand, balafré.',
        '>',
        '> Mindset : Protéger le clan.',
        '## Statistiques :',
        '- Niveau : 1',
        '- PV(points de vie): 25/25 (10 + 14 + 1)',
        '- Force : 15',
        '- Constitution : 12',
        '- Dexterité : 9',
        '- Intelligence : 7',
        '- Charisme : 11',
        '- Sagesse : 10',
        '- Chance : 13',
        '## Compétences :',
        '- [Passif de classe] Peau de pierre',
        '- [Active] Rage (Force) : Double les dégâts.',
        '----',
        '## Etat :',
        '----',
        '## Inventaire :',
        '- Potion de soin x2',
        '----',
      ].join('\n'),
    )
  })

  it('shows the effective value when modifiers apply', () => {
    const e = createEntity('player', 'c1', rules, {
      stats: { ...createEntity('player', '', rules).stats, strength: 12 },
    })
    e.modifiers = [{ id: 'm', stat: 'strength', value: 2, label: 'Gantelets' }]
    expect(toDiscordMarkdown(e, rules)).toContain('- Force : 12 (effectif 14)')
  })
})

describe('Discord round trip', () => {
  it('sheet → Markdown → sheet loses nothing (property)', () => {
    fc.assert(
      fc.property(entityArb, (entity) => {
        const markdown = toDiscordMarkdown(entity, rules)
        const parsed = parseDiscordSheet(markdown, rules)
        expect(parsed.warnings).toEqual([])
        const back = entityFromSheet(parsed, entity.kind, 'c1', rules)
        expect(essence(back)).toEqual(essence(entity))
      }),
      { numRuns: 300 },
    )
  })
})

describe('Discord import of hand-written sheets', () => {
  it('reads a sheet filled loosely by a player', () => {
    const text = `# fiche Lyra_88
## Identité :
- Pseudo: Lyra
- Classe : Rôdeuse
- Type d’arme : Arc long
- Provenance : Forêt de Brume
- Description (texte ou photo) + Mindset : Silencieuse, cheveux argentés.
Mindset : se méfie des nobles
## Statistiques :
- Niveau : 1
(DETERMINE PAR LANCES DE DES LORS DE LA PREMIERE SESSION)
- PV(points de vie): 10 + 1d20+Nv = 27
- Force 2d20/2 = 9
- Constitution : 12
- Dextérité : 17
- Intelligence: 11,5
- Charisme 10
- Sagesse : 14
- Chance : 8
## Compétences :
(2 actives 1 Passives au début + Passif de classe (Caractéristique physique)
- Tir précis (active) : +2 au prochain tir
- Pas de loup (passive)
- Passif de classe : Vision nocturne
----
## Etat :
----
## Inventaire :
- Flèches (x20)
- Cape elfique : discrétion
----`
    const sheet = parseDiscordSheet(text, rules)
    expect(sheet.warnings).toEqual([])
    expect(sheet.title).toBe('Lyra_88')
    expect(sheet.identity).toMatchObject({
      pseudo: 'Lyra',
      className: 'Rôdeuse',
      weaponType: 'Arc long',
      origin: 'Forêt de Brume',
      description: 'Silencieuse, cheveux argentés.',
      mindset: 'se méfie des nobles',
    })
    expect(sheet.level).toBe(1)
    expect(sheet.hp).toEqual({ current: null, max: 27, roll: 16 })
    expect(sheet.stats).toEqual({
      strength: 9,
      constitution: 12,
      dexterity: 17,
      intelligence: 11.5,
      charisma: 10,
      wisdom: 14,
      luck: 8,
    })
    expect(sheet.skills).toEqual([
      { name: 'Tir précis', kind: 'active', stat: null, description: '+2 au prochain tir' },
      { name: 'Pas de loup', kind: 'passive', stat: null, description: '' },
      { name: 'Vision nocturne', kind: 'class', stat: null, description: '' },
    ])
    expect(sheet.inventory).toEqual([
      { name: 'Flèches', quantity: 20, description: '' },
      { name: 'Cape elfique', quantity: 1, description: 'discrétion' },
    ])

    const entity = entityFromSheet(sheet, 'player', 'c1', rules)
    expect(entity.identity.discordName).toBe('Lyra_88')
    expect(entity.hp).toEqual({ roll: 16, current: 27, temp: 0 })
  })

  it('reports what is missing from the blank template', () => {
    const blank = `# fiche NOM DISCORD

## Identité :
- Pseudo
- Classe
## Statistiques :
- Niveau : 1
- PV(points de vie): 10 + 1d20+Nv
- Force 2d20/2
- Constitution 2d20/2
## Compétences :
----`
    const sheet = parseDiscordSheet(blank, rules)
    const codes = sheet.warnings.map((w) => (w.code === 'missingStat' ? `stat:${w.stat}` : w.code))
    expect(codes).toContain('missingHp')
    expect(codes).toContain('stat:strength')
    expect(codes).toContain('stat:luck')
    expect(sheet.stats).toEqual({})
  })

  it('flags text that is not a sheet', () => {
    expect(parseDiscordSheet('bonjour tout le monde', rules).warnings).toEqual([
      { code: 'notASheet' },
    ])
  })

  it('warns when the HP do not match a d20 roll', () => {
    const sheet = parseDiscordSheet('# fiche X\n## Statistiques :\n- Niveau : 1\n- PV : 60', rules)
    expect(sheet.warnings).toContainEqual({ code: 'hpRollOutOfRange', roll: 49 })
  })

  it('flags skills without a recognisable kind', () => {
    const sheet = parseDiscordSheet('# fiche X\n## Compétences :\n- Coup de boule : ouch', rules)
    expect(sheet.skills[0]).toMatchObject({ name: 'Coup de boule', kind: 'active' })
    expect(sheet.warnings).toContainEqual({ code: 'unknownSkillKind', name: 'Coup de boule' })
  })
})
