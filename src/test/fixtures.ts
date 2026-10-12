import { activeDb } from '@/db/db'
import { emptyPlayState, HOST_ID } from '@/domain/turns'
import type { ConditionTemplate } from '@/domain/types'
import { defaultRules, type RulesConfig } from '@/rules'

/**
 * A GM who switched every optional mechanic on (Codex enables none by default,
 * D-217). Tests use it to exercise those mechanics with explicit values.
 */
export function configuredRules(): RulesConfig {
  const rules = defaultRules()
  rules.combat = { strengthDamageBonus: true, unarmedDamage: '1d4' }
  rules.defense = { fromDexterity: true, fromEquipment: true }
  rules.carry = { kgPerStrength: 5, overloadedDexPenalty: 2 }
  rules.fatigue = { maxExhaustion: 6, checkPenaltyPerLevel: 1 }
  rules.rests = {
    shortRestHeal: '1d6',
    longRest: {
      fullHp: true,
      clearTempHp: true,
      reduceExhaustion: true,
      restoreLuck: true,
      restoreSkills: true,
    },
  }
  rules.luck = { pointsPerLuck: 5 }
  rules.xp = { mode: 'linear', perLevel: 100, table: [] }
  rules.disposition = { step: 1, criticalStep: 2 }
  rules.currency = [
    { id: 'gold', name: 'Or', short: 'po', value: 100 },
    { id: 'silver', name: 'Argent', short: 'pa', value: 10 },
    { id: 'copper', name: 'Cuivre', short: 'pc', value: 1 },
  ]
  return rules
}

const base: Omit<ConditionTemplate, 'id' | 'name'> = {
  description: '',
  icon: 'star',
  color: 'gray',
  duration: null,
  modifiers: [],
  perTurn: null,
  save: null,
  concentration: false,
}

/** Conditions as a GM might define them, with explicit effects. */
export const TEST_CONDITIONS: Record<'poisoned' | 'burning' | 'stunned', ConditionTemplate> = {
  poisoned: {
    ...base,
    id: 'poisoned',
    name: 'Empoisonné',
    duration: 3,
    perTurn: { kind: 'damage', expression: '1d4' },
    save: 'constitution',
  },
  burning: {
    ...base,
    id: 'burning',
    name: 'En feu',
    duration: 3,
    perTurn: { kind: 'damage', expression: '1d6' },
    save: 'dexterity',
  },
  stunned: {
    ...base,
    id: 'stunned',
    name: 'Étourdi',
    duration: 1,
    modifiers: [{ id: 'm-stun', stat: 'dexterity', value: -2, label: 'Étourdi' }],
  },
}

/** Puts a campaign in a game started by this device (D-244), as if « Démarrer la partie » was clicked. */
export async function startLocalGame(campaignId: string): Promise<void> {
  const db = activeDb()
  const campaign = await db.campaigns.get(campaignId)
  await db.campaigns.update(campaignId, {
    play: {
      ...(campaign?.play ?? emptyPlayState()),
      live: {
        runId: 'test-run',
        planId: null,
        mode: 'local',
        startedAt: 0,
        operator: { id: HOST_ID, name: 'MJ' },
      },
    },
  })
}
