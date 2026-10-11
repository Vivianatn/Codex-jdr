import { TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/fields'
import { TextAreaField } from '@/components/ui/TextField'
import { entityFromSheet, parseDiscordSheet } from '@/domain/discord'
import { entityName } from '@/domain/entity'
import { STAT_KEYS, type EntityKind } from '@/domain/types'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { warningText } from './sheetWarnings'
import { useCharacterActions } from './useCharacterActions'

/** Paste a Discord sheet, see what was understood, create the character. */
export function DiscordImportDialog({
  open,
  onOpenChange,
  kinds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kinds offered; enemies are imported as bestiary templates. */
  kinds: EntityKind[]
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useCharacterActions()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<EntityKind>(kinds[0] ?? 'player')
  const sheet = useMemo(
    () => (text.trim() ? parseDiscordSheet(text, campaign.rules) : null),
    [text, campaign.rules],
  )
  const preview = sheet ? entityFromSheet(sheet, kind, campaign.id, campaign.rules) : null
  const blocking = sheet?.warnings.some((w) => w.code === 'notASheet') ?? true

  function close() {
    setText('')
    onOpenChange(false)
  }

  async function submit() {
    if (!sheet || !preview || blocking) return
    const name = entityName(preview)
    if (preview.kind === 'enemy') {
      await actions.saveTemplate(
        { ...preview, campaignId: campaign.id },
        t.discordImport.imported(name),
      )
    } else {
      actions.addToCampaign(preview, t.discordImport.imported(name), t.discordImport.imported(name))
    }
    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={t.discordImport.title}
      description={t.discordImport.body}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={submit} disabled={blocking}>
            {t.discordImport.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kinds.length > 1 && (
          <SelectField<EntityKind>
            label={t.discordImport.kind}
            value={kind}
            onChange={setKind}
            options={kinds.map((k) => ({ value: k, label: t.kinds[k] }))}
            className="max-w-56"
          />
        )}
        <TextAreaField
          label={t.discordImport.text}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'# fiche …\n\n## Identité :\n- Pseudo : …'}
          className="min-h-56 font-mono text-xs"
          spellCheck={false}
        />
        {sheet && preview && (
          <section
            aria-live="polite"
            className="rounded-md border border-line bg-surface-2 p-3 text-sm"
          >
            <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">
              {t.discordImport.preview}
            </h3>
            {!blocking && (
              <p className="mt-1 text-ink">
                <span className="font-medium">{entityName(preview)}</span>
                {preview.identity.className && ` · ${preview.identity.className}`} · {t.sheet.level}{' '}
                {preview.level} · {t.sheet.hpMax} {preview.hp.current}
                <br />
                <span className="text-ink-muted">
                  {t.discordImport.summary(
                    STAT_KEYS.filter((k) => sheet.stats[k] !== undefined).length,
                    sheet.skills.length,
                    sheet.inventory.length,
                  )}
                </span>
              </p>
            )}
            {sheet.warnings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sheet.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2 text-ink">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    {warningText(t, w)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Dialog>
  )
}
