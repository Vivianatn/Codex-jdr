import type { Entity, StatKey } from '@/domain/types'
import type { GameActions } from '@/features/game/gameActions'
import type { Messages } from '@/i18n/locales/fr'

export type StatDialog =
  | { kind: 'bonus'; stat: StatKey }
  | { kind: 'melee' | 'ranged' }
  | { kind: 'opposed'; stat: StatKey }
  | { kind: 'persuasion' | 'intimidation' | 'deception' }
  | { kind: 'identify' }

export interface MenuEntry {
  label: string
  onSelect: () => void
  disabled?: boolean
}

/**
 * Actions of each characteristic (SPEC §4.3–4.9): generic test variants, then
 * the characteristic's own actions. Labelled checks show up in the history
 * as "Discrétion (Dextérité)" etc.
 */
export function statMenu(
  t: Messages,
  entity: Entity,
  stat: StatKey,
  actions: GameActions,
  openDialog: (dialog: StatDialog) => void,
): MenuEntry[][] {
  const name = t.stats.names[stat]
  const labelled = (action: string, extra: Parameters<GameActions['check']>[2] = {}) => ({
    label: action,
    onSelect: () =>
      actions.check(entity.id, stat, { label: t.checks.label(action, name), ...extra }),
  })
  const generic: MenuEntry[] = [
    {
      label: t.checks.advantage,
      onSelect: () => actions.check(entity.id, stat, { mode: 'advantage' }),
    },
    {
      label: t.checks.disadvantage,
      onSelect: () => actions.check(entity.id, stat, { mode: 'disadvantage' }),
    },
    { label: t.checks.secret, onSelect: () => actions.check(entity.id, stat, { secret: true }) },
    { label: t.checks.withBonus, onSelect: () => openDialog({ kind: 'bonus', stat }) },
  ]
  const opposed = { label: t.checks.opposed, onSelect: () => openDialog({ kind: 'opposed', stat }) }
  const specific: Record<StatKey, MenuEntry[]> = {
    strength: [{ label: t.checks.melee, onSelect: () => openDialog({ kind: 'melee' }) }, opposed],
    constitution: [
      ...Object.values(t.checks.resistances).map((label) => labelled(label)),
      labelled(t.checks.concentration),
    ],
    dexterity: [
      { label: t.checks.ranged, onSelect: () => openDialog({ kind: 'ranged' }) },
      labelled(t.checks.stealth),
      labelled(t.checks.lockpicking),
      labelled(t.checks.dodge),
      opposed,
    ],
    intelligence: [
      labelled(t.checks.knowledge),
      labelled(t.checks.riddle),
      {
        label: t.checks.identify,
        onSelect: () => openDialog({ kind: 'identify' }),
        disabled: !entity.inventory.some((i) => i.hidden && !i.hidden.identified),
      },
    ],
    charisma: [
      { label: t.checks.persuasion + '…', onSelect: () => openDialog({ kind: 'persuasion' }) },
      { label: t.checks.intimidation + '…', onSelect: () => openDialog({ kind: 'intimidation' }) },
      { label: t.checks.deception + '…', onSelect: () => openDialog({ kind: 'deception' }) },
    ],
    wisdom: [
      {
        label: t.checks.insight,
        onSelect: () => actions.insight(entity.id),
      },
      labelled(t.checks.mental),
    ],
    luck: [{ label: t.checks.luckReroll, onSelect: () => actions.luckReroll(entity.id) }],
  }
  return [generic, specific[stat]]
}
