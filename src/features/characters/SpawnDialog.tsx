import { Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { entityName } from '@/domain/entity'
import type { EnemyTemplate } from '@/domain/types'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useCharacterActions } from './useCharacterActions'
import { clamp } from '@/lib/numbers'

/** "Ajouter à la campagne": N numbered copies of a template at a given level. */
export function SpawnButton({
  template,
  variant = 'primary',
  size = 'md',
}: {
  template: EnemyTemplate
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={<Copy />}
        onClick={() => setOpen(true)}
        aria-label={`${t.bestiary.spawn} : ${entityName(template)}`}
      >
        {t.bestiary.spawn}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t.bestiary.spawnTitle(entityName(template))}
      >
        {open && <SpawnForm template={template} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  )
}

function SpawnForm({ template, onDone }: { template: EnemyTemplate; onDone: () => void }) {
  const t = useT()
  const actions = useCharacterActions()
  const [quantity, setQuantity] = useState('3')
  const [level, setLevel] = useState(String(template.level))
  const q = clamp(Math.floor(Number(quantity) || 1), 1, 50)
  const lvl = Math.max(1, Math.floor(Number(level) || 1))
  const highest = useCampaignStore((s) =>
    Math.max(
      0,
      ...Object.values(s.entities).map((e) =>
        e.kind === 'enemy' && e.details.templateId === template.id
          ? (e.details.copyNumber ?? 0)
          : 0,
      ),
    ),
  )
  const name = entityName(template)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        actions.spawn(template, q, lvl)
        onDone()
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t.bestiary.quantity}
          type="number"
          min={1}
          max={50}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          autoFocus
        />
        <TextField
          label={t.bestiary.level}
          type="number"
          min={1}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        />
      </div>
      <p className="text-sm text-ink-muted" aria-live="polite">
        {t.bestiary.spawnPreview(`${name} ${highest + 1}`, `${name} ${highest + q}`)}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {t.common.add}
        </Button>
      </div>
    </form>
  )
}
