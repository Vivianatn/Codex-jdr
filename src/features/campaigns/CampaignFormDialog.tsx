import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { useT } from '@/i18n'

export interface CampaignFormValues {
  name: string
  description: string
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial?: CampaignFormValues
  onSubmit: (values: CampaignFormValues) => Promise<void>
}) {
  const t = useT()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? t.campaigns.createDialogTitle : t.campaigns.renameDialogTitle}
      description={mode === 'create' ? t.campaigns.createDialogBody : undefined}
    >
      {/* Keyed form: fresh state each time the dialog opens. */}
      {open && (
        <CampaignForm
          mode={mode}
          initial={initial}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      )}
    </Dialog>
  )
}

function CampaignForm({
  mode,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initial?: CampaignFormValues
  onCancel: () => void
  onSubmit: (values: CampaignFormValues) => Promise<void>
}) {
  const t = useT()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError(t.campaigns.nameRequired)
      return
    }
    setBusy(true)
    try {
      await onSubmit({ name, description })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextField
        label={t.common.name}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (error) setError(null)
        }}
        placeholder={t.campaigns.namePlaceholder}
        error={error}
        autoFocus
        maxLength={120}
      />
      <TextAreaField
        label={t.common.description}
        hint={t.common.optional}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t.campaigns.descriptionPlaceholder}
        maxLength={500}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {mode === 'create' ? t.common.create : t.common.save}
        </Button>
      </div>
    </form>
  )
}
