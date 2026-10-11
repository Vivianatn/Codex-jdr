import type { DiceGroupResult } from '@/dice'
import type { CheckOutcome } from '@/rules'
import type { RollMode } from './checks'
import type { StatKey } from './types'

export type RollKind = 'free' | 'check' | 'damage' | 'heal' | 'effect'

/** One entry of the roll history (SPEC §7). */
export interface RollRecord {
  id: string
  campaignId: string
  at: number
  /** Character who rolled, or null for a GM roll. */
  entityId: string | null
  kind: RollKind
  /** "Discrétion (Dextérité)", "Boule de feu", or the expression for a free roll. */
  label: string
  expression: string
  total: number
  breakdown: string
  groups: DiceGroupResult[]
  /** Hidden from the players' view (phase 4). */
  secret: boolean
  check: {
    stat: StatKey
    value: number
    bonus: number
    mode: RollMode
    natural: number
    outcome: CheckOutcome
  } | null
  /** Set when this roll replaces another one (luck point). */
  rerollOf: string | null
  /** Free text shown under the result ("Ce que ressent le joueur…"). */
  note: string
}

/** Kept per campaign; older entries are dropped. */
export const ROLL_HISTORY_LIMIT = 500
