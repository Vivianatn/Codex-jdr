import { hpFormulaParts, hpMax, hpRollFromMax, isValidDie, type RulesConfig } from '@/rules'
import { plainCondition } from './conditions'
import { createEntity, effectiveStats, entityHpMax, newId, normalizeSkill } from './entity'
import { newItem } from './items'
import {
  STAT_KEYS,
  type Entity,
  type EntityKind,
  type EntityOfKind,
  type Identity,
  type SkillKind,
  type StatKey,
  type Stats,
} from './types'

/**
 * Discord sheet format (SPEC §2.2). The labels below are part of the data
 * format — they mirror the template players already use — not UI strings.
 */
export const DISCORD_STAT_LABELS: Record<StatKey, string> = {
  strength: 'Force',
  constitution: 'Constitution',
  dexterity: 'Dexterité',
  intelligence: 'Intelligence',
  charisma: 'Charisme',
  wisdom: 'Sagesse',
  luck: 'Chance',
}

const SKILL_LABELS: Record<SkillKind, string> = {
  active: 'Active',
  passive: 'Passive',
  class: 'Passif de classe',
}

const HP_LABEL = 'PV(points de vie)'
const DESCRIPTION_LABEL = 'Description (texte ou photo) + Mindset'

/** Multi-line text as indented continuation lines (renders inside the list item on Discord). */
function continuation(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
}

function inline(name: string, detail: string): string {
  const [first = '', ...rest] = detail.split('\n')
  const head = first ? `${name} : ${first}` : name
  return rest.length ? `${head}\n${continuation(rest.join('\n'))}` : head
}

export function sheetTitle(entity: Entity): string {
  const { discordName, pseudo } = entity.identity
  return (entity.kind === 'player' ? discordName || pseudo : pseudo || discordName).trim()
}

export function toDiscordMarkdown(entity: Entity, rules: RulesConfig): string {
  const id = entity.identity
  const max = entityHpMax(entity, rules)
  const effective = effectiveStats(entity)
  const lines: string[] = []

  lines.push(`# fiche ${sheetTitle(entity)}`, '')
  lines.push('## Identité :')
  lines.push(`- Pseudo : ${id.pseudo}`)
  lines.push(`- Classe : ${id.className}`)
  lines.push(`- type d'arme : ${id.weaponType}`)
  lines.push(`- provenance : ${id.origin}`)
  lines.push(`- ${DESCRIPTION_LABEL} :`)
  const quote = [id.description, id.mindset ? `Mindset : ${id.mindset}` : '']
    .filter(Boolean)
    .join('\n\n')
  if (quote) lines.push(...quote.split('\n').map((line) => (line ? `> ${line}` : '>')))

  lines.push('## Statistiques :')
  lines.push(`- Niveau : ${entity.level}`)
  lines.push(
    `- ${HP_LABEL}: ${entity.hp.current}/${max} (${hpFormulaParts(entity.hp.roll, entity.level, rules).join(' + ')})`,
  )
  for (const key of STAT_KEYS) {
    const { base, total } = effective[key]
    lines.push(
      `- ${DISCORD_STAT_LABELS[key]} : ${base}${total !== base ? ` (effectif ${total})` : ''}`,
    )
  }

  lines.push('## Compétences :')
  const order: SkillKind[] = ['class', 'active', 'passive']
  for (const kind of order) {
    for (const skill of entity.skills.filter((s) => s.kind === kind)) {
      const stat = skill.stat ? ` (${DISCORD_STAT_LABELS[skill.stat]})` : ''
      lines.push(`- [${SKILL_LABELS[kind]}] ${inline(skill.name + stat, skill.description)}`)
    }
  }
  lines.push('----')

  lines.push('## Etat :')
  for (const condition of entity.conditions)
    lines.push(`- ${inline(condition.name, condition.note)}`)
  lines.push('----')

  lines.push('## Inventaire :')
  for (const item of entity.inventory) {
    const qty = item.quantity !== 1 ? ` x${item.quantity}` : ''
    lines.push(`- ${inline(item.name + qty, item.description)}`)
  }
  lines.push('----')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type SheetWarning =
  | { code: 'notASheet' }
  | { code: 'missingName' }
  | { code: 'missingStat'; stat: StatKey }
  | { code: 'missingHp' }
  | { code: 'hpRollOutOfRange'; roll: number }
  | { code: 'unknownSkillKind'; name: string }

export interface ParsedSkill {
  name: string
  kind: SkillKind
  stat: StatKey | null
  description: string
}

export interface ParsedSheet {
  title: string
  identity: Partial<Omit<Identity, 'portrait'>>
  level: number | null
  hp: { current: number | null; max: number | null; roll: number | null }
  stats: Partial<Stats>
  skills: ParsedSkill[]
  conditions: { name: string; note: string }[]
  inventory: { name: string; quantity: number; description: string }[]
  warnings: SheetWarning[]
}

/** Lowercase, no accents, single spaces — for tolerant label matching. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type Section = 'identity' | 'stats' | 'skills' | 'conditions' | 'inventory' | null

function sectionOf(heading: string): Section {
  const h = normalize(heading)
  if (h.startsWith('identite')) return 'identity'
  if (h.startsWith('statistique')) return 'stats'
  if (h.startsWith('competence')) return 'skills'
  if (h.startsWith('etat')) return 'conditions'
  if (h.startsWith('inventaire')) return 'inventory'
  return null
}

/** "Label : value", "Label: value" or "Label value" → value, if the line starts with the label. */
function valueAfterLabel(line: string, labels: string[]): string | null {
  const text = line.trim()
  const n = normalize(text)
  for (const label of labels) {
    const l = normalize(label)
    if (!n.startsWith(l)) continue
    // Find where the label ends in the original text (accents/spacing may differ).
    let end = 0
    while (end < text.length && normalize(text.slice(0, end)) !== l) end++
    const rest = text.slice(end)
    if (rest === '' || /^[\s:]/.test(rest)) return rest.replace(/^\s*:?\s*/, '').trim()
  }
  return null
}

const DICE = /\d*\s*d\s*\d+(\s*\/\s*\d+)?/gi

function firstNumber(text: string): number | null {
  const match = text.replace(DICE, ' ').match(/-?\d+(?:[.,]\d+)?/)
  return match ? Number(match[0].replace(',', '.')) : null
}

function parseHp(value: string, rules: RulesConfig, level: number): ParsedSheet['hp'] {
  const result: ParsedSheet['hp'] = { current: null, max: null, roll: null }
  const text = value.trim()
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)/)
  const parens = text.match(/\(([^)]*)\)/)
  if (fraction) {
    result.current = Number(fraction[1])
    result.max = Number(fraction[2])
  } else if (text.includes('=')) {
    result.max = firstNumber(text.slice(text.lastIndexOf('=') + 1))
  } else if (/d\s*20|nv/i.test(text)) {
    return result // unfilled template line
  } else if (/^\d+(\s*\+\s*\d+)+$/.test(text)) {
    result.max = text.split('+').reduce((sum, n) => sum + Number(n), 0)
  } else {
    result.max = firstNumber(text)
  }
  // "(10 + 14 + 1…)" gives the roll directly.
  const parts = (parens?.[1] ?? (text.includes('=') ? text.slice(0, text.lastIndexOf('=')) : ''))
    .split('+')
    .map((p) => p.trim())
  if (parts.length >= 2 && Number(parts[0]) === rules.hp.base && /^\d+$/.test(parts[1] ?? '')) {
    result.roll = Number(parts[1])
  } else if (result.max !== null) {
    result.roll = hpRollFromMax(result.max, level, rules)
  }
  return result
}

function kindFromWord(word: string): SkillKind | null {
  const n = normalize(word)
  if (n.includes('classe')) return 'class'
  if (/\bpassi(f|ve)\b/.test(n)) return 'passive'
  if (/\bacti(f|ve)\b/.test(n)) return 'active'
  return null
}

/** Kind from "[Active] …", "Active : …" or "… (active) …" — never from the description. */
function skillKindOf(text: string): { kind: SkillKind | null; rest: string } {
  const bracket = text.match(/^\[([^\]]+)\]\s*(.*)$/s)
  if (bracket) return { kind: kindFromWord(bracket[1] ?? ''), rest: bracket[2] ?? '' }
  const prefix = text.match(/^(passif de classe|passive|passif|active|actif)\s*:\s*(.*)$/is)
  if (prefix) return { kind: kindFromWord(prefix[1] ?? ''), rest: prefix[2] ?? '' }
  const paren = text.match(/\s*\((passif de classe|passive|passif|active|actif)\)/i)
  if (paren) return { kind: kindFromWord(paren[1] ?? ''), rest: text.replace(paren[0], '').trim() }
  return { kind: null, rest: text }
}

const STAT_BY_LABEL = new Map(
  STAT_KEYS.map((key) => [normalize(DISCORD_STAT_LABELS[key]), key] as const),
)

/** Splits "Name (Force) : description" into its parts. */
function splitNamed(text: string): { name: string; stat: StatKey | null; detail: string } {
  const sep = text.indexOf(' : ')
  const colon = sep >= 0 ? sep : text.endsWith(' :') ? text.length - 2 : -1
  let name = (colon >= 0 ? text.slice(0, colon) : text).trim()
  const detail = colon >= 0 ? text.slice(colon + 3).trim() : ''
  let stat: StatKey | null = null
  const statMatch = name.match(/\s*\(([^)]+)\)$/)
  if (statMatch) {
    const key = STAT_BY_LABEL.get(normalize(statMatch[1] ?? ''))
    if (key) {
      stat = key
      name = name.slice(0, statMatch.index).trim()
    }
  }
  return { name, stat, detail }
}

interface ListItem {
  text: string
  more: string[]
}

export function parseDiscordSheet(input: string, rules: RulesConfig): ParsedSheet {
  const sheet: ParsedSheet = {
    title: '',
    identity: {},
    level: null,
    hp: { current: null, max: null, roll: null },
    stats: {},
    skills: [],
    conditions: [],
    inventory: [],
    warnings: [],
  }

  // 1. Group lines into sections of list items (with continuation lines).
  const sections: Record<Exclude<Section, null>, ListItem[]> = {
    identity: [],
    stats: [],
    skills: [],
    conditions: [],
    inventory: [],
  }
  let current: Section = null
  let recognised = false
  for (const raw of input.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const trimmed = line.trim()
    if (/^#\s/.test(trimmed) && !/^##/.test(trimmed)) {
      sheet.title = trimmed
        .replace(/^#\s*/, '')
        .replace(/^fiche\s*/i, '')
        .trim()
      recognised = true
      continue
    }
    if (/^##/.test(trimmed)) {
      current = sectionOf(trimmed.replace(/^#+\s*/, '').replace(/:\s*$/, ''))
      if (current) recognised = true
      continue
    }
    if (!current || /^-{3,}$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) continue
    const items = sections[current]
    const bullet = line.match(/^\s{0,1}[-*•]\s?(.*)$/)
    if (bullet) {
      items.push({ text: (bullet[1] ?? '').trim(), more: [] })
    } else if (items.length) {
      items.at(-1)!.more.push(trimmed.replace(/^>\s?/, ''))
    }
  }
  if (!recognised) sheet.warnings.push({ code: 'notASheet' })

  const joinMore = (item: ListItem) =>
    item.more
      .join('\n')
      .replace(/^\n+|\n+$/g, '')
      .trim()

  // 2. Identity
  // "Nom Discord" must be tried before "Nom".
  const fields: [keyof Omit<Identity, 'portrait' | 'description' | 'mindset'>, string[]][] = [
    ['discordName', ['Nom Discord', 'Discord']],
    ['pseudo', ['Pseudo', 'Nom']],
    ['className', ['Classe']],
    ['weaponType', ["type d'arme", 'Arme']],
    ['origin', ['provenance', 'Origine']],
  ]
  for (const item of sections.identity) {
    const description = valueAfterLabel(item.text, [DESCRIPTION_LABEL, 'Description'])
    if (description !== null) {
      const full = [description, joinMore(item)].filter(Boolean).join('\n')
      const split = full.split(/^\s*\**mindset\**\s*:\s*/im)
      sheet.identity.description = (split[0] ?? '').trim()
      if (split.length > 1) sheet.identity.mindset = split.slice(1).join('\n').trim()
      continue
    }
    const mindset = valueAfterLabel(item.text, ['Mindset'])
    if (mindset !== null) {
      sheet.identity.mindset = [mindset, joinMore(item)].filter(Boolean).join('\n')
      continue
    }
    for (const [field, labels] of fields) {
      const value = valueAfterLabel(item.text, labels)
      if (value !== null) {
        sheet.identity[field] = value
        break
      }
    }
  }

  // 3. Statistics (level first: the HP roll depends on it)
  for (const item of sections.stats) {
    const level = valueAfterLabel(item.text, ['Niveau', 'Nv'])
    if (level !== null) sheet.level = firstNumber(level)
  }
  const level = sheet.level ?? 1
  for (const item of sections.stats) {
    const hp = valueAfterLabel(item.text, [HP_LABEL, 'PV (points de vie)', 'Points de vie', 'PV'])
    if (hp !== null) {
      sheet.hp = parseHp(hp, rules, level)
      continue
    }
    for (const key of STAT_KEYS) {
      const value = valueAfterLabel(item.text, [DISCORD_STAT_LABELS[key]])
      if (value !== null) {
        const n = firstNumber(value)
        if (n !== null) sheet.stats[key] = n
        break
      }
    }
  }

  // 4. Lists
  for (const item of sections.skills) {
    const { kind, rest } = skillKindOf(item.text)
    const { name, stat, detail } = splitNamed(rest)
    if (!name) continue
    if (!kind) sheet.warnings.push({ code: 'unknownSkillKind', name })
    const description = [detail, joinMore(item)].filter(Boolean).join('\n')
    sheet.skills.push({ name, kind: kind ?? 'active', stat, description })
  }
  for (const item of sections.conditions) {
    const { name, detail } = splitNamed(item.text)
    if (name)
      sheet.conditions.push({ name, note: [detail, joinMore(item)].filter(Boolean).join('\n') })
  }
  for (const item of sections.inventory) {
    const { name: raw, detail } = splitNamed(item.text)
    const qty = raw.match(/\s*\(?\s*[x×]\s*(\d+)\s*\)?$/i)
    const name = qty ? raw.slice(0, qty.index).trim() : raw
    if (name)
      sheet.inventory.push({
        name,
        quantity: qty ? Number(qty[1]) : 1,
        description: [detail, joinMore(item)].filter(Boolean).join('\n'),
      })
  }

  // 5. Warnings
  if (recognised) {
    if (!sheet.identity.pseudo && !sheet.title) sheet.warnings.push({ code: 'missingName' })
    for (const key of STAT_KEYS)
      if (sheet.stats[key] === undefined) sheet.warnings.push({ code: 'missingStat', stat: key })
    if (sheet.hp.max === null) sheet.warnings.push({ code: 'missingHp' })
    else if (sheet.hp.roll !== null && !isValidDie(sheet.hp.roll))
      sheet.warnings.push({ code: 'hpRollOutOfRange', roll: sheet.hp.roll })
  }
  return sheet
}

/** Builds an entity from a parsed sheet; missing stats default to 10, missing HP to a roll of 10. */
export function entityFromSheet<K extends EntityKind>(
  sheet: ParsedSheet,
  kind: K,
  campaignId: string,
  rules: RulesConfig,
  now = Date.now(),
): EntityOfKind<K> {
  const level = Math.max(1, Math.floor(sheet.level ?? 1))
  const identity: Partial<Identity> = { ...sheet.identity }
  if (kind === 'player') identity.discordName ||= sheet.title
  else identity.pseudo ||= sheet.title
  const roll = sheet.hp.roll ?? 10
  const entity = createEntity(kind, campaignId, rules, {
    identity,
    level,
    hpRoll: roll,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, sheet.stats[k] ?? 10])) as Stats,
    now,
  })
  const max = hpMax(roll, level, rules)
  return {
    ...entity,
    hp: { roll, current: Math.min(sheet.hp.current ?? max, max), temp: 0 },
    skills: sheet.skills.map((s) => normalizeSkill({ ...s, id: newId() })),
    conditions: sheet.conditions.map((c) => plainCondition(c.name, c.note)),
    inventory: sheet.inventory.map((i) => newItem(i)),
  }
}
