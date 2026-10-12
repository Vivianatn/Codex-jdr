import type { RollRecord } from '@/domain/rolls'
import type { TurnState } from '@/domain/turns'
import type { Entity } from '@/domain/types'
import type { SoundName } from '@/lib/audio/sfx'
import type { HpFx } from '@/stores/fxStore'

/** Which sounds an event makes (D-251). Pure: the hook only plays what this says. */

export interface Cue {
  name: SoundName
  /** Seconds after the event. */
  delay: number
}

/** The dice rattle, then the verdict once they have settled. */
export function cuesForRoll(roll: Pick<RollRecord, 'check'>): Cue[] {
  const dice: Cue = { name: 'dice', delay: 0 }
  const outcome = roll.check?.outcome
  if (!outcome) return [dice]
  const verdict: SoundName = outcome.critical
    ? outcome.critical.kind === 'success'
      ? 'critSuccess'
      : 'critFailure'
    : outcome.success
      ? 'success'
      : 'failure'
  return [dice, { name: verdict, delay: 0.35 }]
}

/** One sound for a burst of HP changes (an area spell hits five goblins: one thud). */
export function cueForHp(changes: readonly Pick<HpFx, 'kind' | 'severe'>[]): SoundName | null {
  if (!changes.length) return null
  if (changes.some((c) => c.kind === 'damage' && c.severe)) return 'heavyDamage'
  if (changes.some((c) => c.kind === 'damage')) return 'damage'
  return 'heal'
}

/** A new round, someone else's turn, or the GM's turn. */
export function cueForTurn(before: TurnState, after: TurnState): SoundName | null {
  if (after.status === 'stopped') return null
  if (after.status === 'gm') return before.status === 'gm' ? null : 'gmTurn'
  if (before.status !== 'playing' || after.round !== before.round) return 'round'
  return after.memberId !== before.memberId ? 'turn' : null
}

/** True when a character of the same campaign gained a level. */
export function someoneLeveledUp(
  before: Record<string, Pick<Entity, 'level'>>,
  after: Record<string, Pick<Entity, 'level'>>,
): boolean {
  return Object.entries(after).some(([id, e]) => {
    const previous = before[id]
    return previous !== undefined && e.level > previous.level
  })
}
