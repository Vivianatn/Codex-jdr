import {
  CheckboxField,
  CommitInput,
  CommitTextArea,
  NumberInput,
  SelectField,
} from '@/components/ui/fields'
import { DISPOSITIONS, type Disposition, type Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { BodyPicker } from '../BodyPicker'
import { canOwnFamiliars, type OwnerOption } from '@/domain/familiars'
import type { SheetEditor } from '../useSheetEditor'
import { FamiliarLinks } from './FamiliarLinks'

export interface SheetContext {
  /** Possible familiar masters (players, allies and enemies of the campaign). */
  owners: OwnerOption[]
  /** Name of the bestiary template an enemy was created from. */
  templateName?: string
}

export function IdentityTab({
  entity,
  editor,
  context,
}: {
  entity: Entity
  editor: SheetEditor
  context: SheetContext
}) {
  const t = useT()
  const id = entity.identity
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="shrink-0">
        <p className="mb-1.5 text-sm font-medium text-ink">{t.identity.body}</p>
        <BodyPicker
          src={id.body}
          onChange={(body) => editor.identity('body', body)}
          className="h-72 w-48"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <CommitInput
            label={t.identity.pseudo}
            hint={t.identity.pseudoHint}
            value={id.pseudo}
            onCommit={(v) => editor.identity('pseudo', v)}
          />
          <CommitInput
            label={t.identity.discordName}
            value={id.discordName}
            onCommit={(v) => editor.identity('discordName', v)}
          />
          <CommitInput
            label={t.identity.className}
            value={id.className}
            onCommit={(v) => editor.identity('className', v)}
          />
          <CommitInput
            label={t.identity.weaponType}
            value={id.weaponType}
            onCommit={(v) => editor.identity('weaponType', v)}
          />
          <CommitInput
            label={t.identity.origin}
            value={id.origin}
            onCommit={(v) => editor.identity('origin', v)}
            className="sm:col-span-2"
          />
        </div>
        <CommitTextArea
          label={t.identity.description}
          value={id.description}
          onCommit={(v) => editor.identity('description', v)}
        />
        <CommitTextArea
          label={t.identity.mindset}
          value={id.mindset}
          onCommit={(v) => editor.identity('mindset', v)}
        />
        <KindDetails entity={entity} editor={editor} context={context} />
        {canOwnFamiliars(entity) && <FamiliarLinks owner={entity} />}
      </div>
    </div>
  )
}

function KindDetails({
  entity,
  editor,
  context,
}: {
  entity: Entity
  editor: SheetEditor
  context: SheetContext
}) {
  const t = useT()
  switch (entity.kind) {
    case 'player':
      return (
        <NumberInput
          label={t.details.xp}
          value={entity.details.xp}
          min={0}
          className="max-w-48"
          onCommit={(xp) => editor.details({ xp })}
        />
      )
    case 'enemy':
      return (
        <div className="space-y-4">
          {context.templateName && (
            <p className="text-sm text-ink-muted">{t.details.fromTemplate(context.templateName)}</p>
          )}
          <NumberInput
            label={t.details.xpReward}
            value={entity.details.xpReward}
            min={0}
            className="max-w-48"
            onCommit={(xpReward) => editor.details({ xpReward })}
          />
          <CommitTextArea
            label={t.details.loot}
            value={entity.details.loot}
            onCommit={(loot) => editor.details({ loot })}
          />
        </div>
      )
    case 'familiar':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<string>
            label={t.details.owner}
            value={entity.details.ownerId ?? ''}
            onChange={(v) => editor.details({ ownerId: v || null })}
            options={[
              { value: '', label: t.common.none },
              ...context.owners
                .filter((o) => o.id !== entity.id)
                .map((o) => ({ value: o.id, label: `${o.name} (${t.kinds[o.kind]})` })),
            ]}
          />
          <NumberInput
            label={t.details.loyalty}
            hint="0–100"
            value={entity.details.loyalty}
            min={0}
            max={100}
            onCommit={(loyalty) => editor.details({ loyalty })}
          />
          <CheckboxField
            label={t.details.actsOnOwnerTurn}
            checked={entity.details.actsOnOwnerTurn}
            onChange={(actsOnOwnerTurn) => editor.details({ actsOnOwnerTurn })}
            className="sm:col-span-2"
          />
        </div>
      )
    case 'ally':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<Disposition>
            label={t.details.disposition}
            value={entity.details.disposition}
            onChange={(disposition) => editor.details({ disposition })}
            options={DISPOSITIONS.map((d) => ({ value: d, label: t.details.dispositions[d] }))}
          />
          <CommitInput
            label={t.details.controlledBy}
            hint={t.details.controlledByHint}
            value={entity.details.controlledBy}
            onCommit={(controlledBy) => editor.details({ controlledBy })}
          />
        </div>
      )
  }
}
