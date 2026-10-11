import { Copy, Map as MapIcon, Pencil, Play, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Ornament } from '@/components/Brand'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { NumberInput } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { newMap, type GameMap, type GridType } from '@/domain/maps'
import { useCampaign } from '@/features/shell/campaignContext'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'

/** Préparation › Cartes: the campaign's boards (D-228). */
export function MapsPage() {
  const t = useT()
  const campaign = useCampaign()
  const navigate = useNavigate()
  const maps = useCampaignStore((s) => s.maps)
  const playing = useCampaignStore((s) => s.play.mapId)
  const addMap = useCampaignStore((s) => s.addMap)
  const removeMap = useCampaignStore((s) => s.removeMap)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<GameMap | null>(null)
  const list = Object.values(maps).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const editorPath = (id: string) => `/c/${campaign.id}/prep/maps/m/${id}`

  const newButton = (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      {t.maps.new}
    </Button>
  )

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.maps.pageTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t.maps.pageSubtitle}</p>
        </div>
        {list.length > 0 && newButton}
      </div>
      <Ornament className="my-6 max-w-sm" />

      {list.length === 0 ? (
        <EmptyMaps action={newButton} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((map) => (
            <li
              key={map.id}
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    to={editorPath(map.id)}
                    className="font-medium text-ink hover:text-accent-text hover:underline"
                  >
                    {map.name}
                  </Link>
                  <p className="tabular mt-0.5 text-xs text-ink-muted">
                    {t.maps.size(map.cols, map.rows)} ·{' '}
                    {map.grid.type === 'hex' ? t.maps.hex : t.maps.square} ·{' '}
                    {t.maps.tokensCount(map.tokens.length)}
                  </p>
                </div>
                {playing === map.id && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                    {t.maps.playing}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1">
                <Button size="sm" icon={<Pencil />} onClick={() => navigate(editorPath(map.id))}>
                  {t.common.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Play />}
                  onClick={() => {
                    updatePlay((p) => ({ ...p, mapId: map.id }), t.maps.wentTo(map.name))
                    navigate(`/c/${campaign.id}/play`)
                  }}
                >
                  {t.maps.play}
                </Button>
                <span className="flex-1" />
                <IconButton
                  size="sm"
                  label={t.maps.duplicate(map.name)}
                  icon={<Copy />}
                  onClick={() => {
                    const copy: GameMap = {
                      ...structuredClone(map),
                      id: crypto.randomUUID(),
                      name: t.maps.copyName(map.name),
                      tokens: [],
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    }
                    addMap(copy, t.maps.created(copy.name))
                    toast.success(t.maps.created(copy.name))
                  }}
                />
                <IconButton
                  size="sm"
                  label={`${t.common.delete} : ${map.name}`}
                  icon={<Trash />}
                  onClick={() => setDeleting(map)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateMapDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(input) => {
          const map = newMap(campaign.id, input)
          addMap(map, t.maps.created(map.name))
          toast.success(t.maps.created(map.name))
          setCreating(false)
          navigate(editorPath(map.id))
        }}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? t.maps.deleteTitle(deleting.name) : ''}
        description={t.maps.deleteBody}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleting) return
                removeMap(deleting.id, t.maps.deleted(deleting.name))
                toast(t.maps.deleted(deleting.name))
                setDeleting(null)
              }}
            >
              {t.common.delete}
            </Button>
          </>
        }
      />
    </PageTransition>
  )
}

function EmptyMaps({ action }: { action: React.ReactNode }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <MapIcon className="size-8 text-ink-muted" aria-hidden />
      <p className="font-medium text-ink">{t.maps.pageTitle}</p>
      <p className="max-w-md text-sm text-ink-muted">{t.maps.empty}</p>
      {action}
    </div>
  )
}

export function CreateMapDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: {
    name: string
    cols: number
    rows: number
    gridType: GridType
    size: number
  }) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [gridType, setGridType] = useState<GridType>('square')
  const [cols, setCols] = useState(30)
  const [rows, setRows] = useState(20)
  const [size, setSize] = useState(64)
  const submit = () => {
    if (!name.trim()) return
    onCreate({ name: name.trim(), cols, rows, gridType, size })
    setName('')
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t.maps.createTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={submit}>
            {t.maps.new}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <TextField
          label={t.maps.name}
          value={name}
          placeholder={t.maps.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <SegmentedControl<GridType>
          label={t.maps.gridType}
          value={gridType}
          onValueChange={setGridType}
          options={[
            { value: 'square', label: t.maps.square },
            { value: 'hex', label: t.maps.hex },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label={t.maps.cols} value={cols} min={1} max={200} onCommit={setCols} />
          <NumberInput label={t.maps.rows} value={rows} min={1} max={200} onCommit={setRows} />
          <NumberInput label={t.maps.cellSize} value={size} min={8} max={400} onCommit={setSize} />
        </div>
      </form>
    </Dialog>
  )
}
