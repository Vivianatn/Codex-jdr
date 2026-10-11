import { ArrowRight, Gift, ImagePlus, Plus, RotateCw, Trash, X } from 'lucide-react'
import { useContext, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import {
  CheckboxField,
  CommitInput,
  CommitTextArea,
  NumberInput,
  SelectField,
} from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { assetRepository } from '@/db/assets'
import { validateDice } from '@/dice'
import { allConditionTemplates } from '@/domain/conditions'
import { entityName, withJournal } from '@/domain/entity'
import { newItem } from '@/domain/items'
import {
  fillFog,
  type AreaShape,
  type GameMap,
  type GridType,
  type MapElement,
  type Wall,
} from '@/domain/maps'
import { STAT_KEYS, type Item, type StatKey } from '@/domain/types'
import { ItemDialog } from '@/features/characters/ItemDialog'
import { diceErrorMessage } from '@/features/game/diceErrors'
import { useMapActions } from '@/features/game/useMapActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { fitImage, imageFromFile } from '@/lib/images'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { useMapViewStore } from '@/stores/mapViewStore'
import { useUiStore } from '@/stores/uiStore'
import type { MapChange } from './MapCanvas'
import { PanelDock } from './panelDock'

/** Panel on the right of the map. */
export function MapPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose?: () => void
  children: ReactNode
}) {
  const docked = useContext(PanelDock)
  const t = useT()
  return (
    <aside
      aria-label={title}
      className={
        docked
          ? 'flex w-80 shrink-0 flex-col overflow-hidden border-l border-line bg-bg'
          : 'codex-glass absolute top-[4.5rem] right-4 bottom-24 z-20 flex w-80 flex-col overflow-hidden'
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="truncate font-sans text-sm font-semibold tracking-normal text-ink">
          {title}
        </h2>
        {onClose && <IconButton size="sm" label={t.common.close} icon={<X />} onClick={onClose} />}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">{children}</div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-sans text-xs font-semibold tracking-wider text-ink-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

const pct = (v: number) => Math.round(v * 100)

// ---------------------------------------------------------------------------
// Map settings (editor)
// ---------------------------------------------------------------------------

export function MapSettingsPanel({
  map,
  onChange,
  calibrateCells,
  setCalibrateCells,
}: {
  map: GameMap
  onChange: MapChange
  calibrateCells: number
  setCalibrateCells: (n: number) => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const file = useRef<HTMLInputElement>(null)
  const label = t.maps.settingsSaved
  const patch = (fn: (m: GameMap) => GameMap) => onChange(fn, label)

  async function importBackground(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return toast.error(t.maps.imageTooBig)
    try {
      const img = await imageFromFile(f)
      const data = fitImage(img, 4096, 4096)
      const asset = await assetRepository.add(campaign.id, data, f.name)
      const scale = Math.min(1, 4096 / img.naturalWidth, 4096 / img.naturalHeight)
      const width = img.naturalWidth * scale
      const height = img.naturalHeight * scale
      onChange(
        (m) => ({
          ...m,
          background: { ...m.background, assetId: asset.id, x: 0, y: 0, scale: 1 },
          // Cover the image with cells of the current size.
          cols: Math.max(1, Math.round(width / m.grid.size)),
          rows: Math.max(1, Math.round(height / m.grid.size)),
          grid: { ...m.grid, offsetX: 0, offsetY: 0 },
          fog: {
            ...m.fog,
            revealed: '0'.repeat(
              Math.max(1, Math.round(width / m.grid.size)) *
                Math.max(1, Math.round(height / m.grid.size)),
            ),
          },
        }),
        label,
      )
    } catch {
      toast.error(t.identity.invalidImage)
    }
  }

  return (
    <MapPanel title={t.maps.settings}>
      <CommitInput
        label={t.maps.name}
        value={map.name}
        onCommit={(name) => name && patch((m) => ({ ...m, name }))}
      />
      <Section title={t.maps.gridType}>
        <SegmentedControl<GridType>
          label={t.maps.gridType}
          size="sm"
          value={map.grid.type}
          onValueChange={(type) => patch((m) => ({ ...m, grid: { ...m.grid, type } }))}
          options={[
            { value: 'square', label: t.maps.square },
            { value: 'hex', label: t.maps.hex },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label={t.maps.cols}
            value={map.cols}
            min={1}
            max={200}
            onCommit={(cols) => patch((m) => resize(m, cols, m.rows))}
          />
          <NumberInput
            label={t.maps.rows}
            value={map.rows}
            min={1}
            max={200}
            onCommit={(rows) => patch((m) => resize(m, m.cols, rows))}
          />
          <NumberInput
            label={t.maps.cellSize}
            value={Math.round(map.grid.size)}
            min={8}
            max={400}
            onCommit={(size) => patch((m) => ({ ...m, grid: { ...m.grid, size } }))}
          />
          <NumberInput
            label={t.maps.gridOpacity}
            value={pct(map.grid.opacity)}
            min={0}
            max={100}
            onCommit={(v) => patch((m) => ({ ...m, grid: { ...m.grid, opacity: v / 100 } }))}
          />
          <NumberInput
            label={t.maps.offsetX}
            value={Math.round(map.grid.offsetX)}
            min={-2000}
            max={2000}
            onCommit={(offsetX) => patch((m) => ({ ...m, grid: { ...m.grid, offsetX } }))}
          />
          <NumberInput
            label={t.maps.offsetY}
            value={Math.round(map.grid.offsetY)}
            min={-2000}
            max={2000}
            onCommit={(offsetY) => patch((m) => ({ ...m, grid: { ...m.grid, offsetY } }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <CheckboxField
            label={t.maps.gridVisible}
            checked={map.grid.visible}
            onChange={(visible) => patch((m) => ({ ...m, grid: { ...m.grid, visible } }))}
          />
          <CheckboxField
            label={t.maps.gridAuto}
            checked={map.grid.color === 'auto'}
            onChange={(auto) =>
              patch((m) => ({
                ...m,
                grid: { ...m.grid, color: auto ? 'auto' : '#211C26', opacity: auto ? 1 : 0.25 },
              }))
            }
          />
          {map.grid.color !== 'auto' && (
            <label className="flex items-center gap-1.5 text-sm text-ink">
              {t.maps.gridColor}
              <input
                type="color"
                value={map.grid.color}
                onChange={(e) =>
                  patch((m) => ({ ...m, grid: { ...m.grid, color: e.target.value } }))
                }
                className="h-7 w-9 cursor-pointer rounded border border-line-strong bg-transparent"
              />
            </label>
          )}
        </div>
        <NumberInput
          label={t.maps.calibrateCells}
          value={calibrateCells}
          min={1}
          max={20}
          onCommit={setCalibrateCells}
        />
      </Section>

      <Section title={t.maps.background}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<ImagePlus />} onClick={() => file.current?.click()}>
            {t.maps.backgroundImport}
          </Button>
          {map.background.assetId && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash />}
              onClick={() =>
                patch((m) => ({ ...m, background: { ...m.background, assetId: null } }))
              }
            >
              {t.maps.backgroundRemove}
            </Button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="map-background-input"
          onChange={(e) => {
            void importBackground(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {map.background.assetId && (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label={t.maps.backgroundScale}
              value={pct(map.background.scale)}
              min={1}
              max={1000}
              onCommit={(v) =>
                patch((m) => ({ ...m, background: { ...m.background, scale: v / 100 } }))
              }
            />
            <NumberInput
              label={t.maps.backgroundOpacity}
              value={pct(map.background.opacity)}
              min={0}
              max={100}
              onCommit={(v) =>
                patch((m) => ({ ...m, background: { ...m.background, opacity: v / 100 } }))
              }
            />
            <NumberInput
              label={t.maps.backgroundX}
              value={Math.round(map.background.x)}
              min={-5000}
              max={5000}
              onCommit={(x) => patch((m) => ({ ...m, background: { ...m.background, x } }))}
            />
            <NumberInput
              label={t.maps.backgroundY}
              value={Math.round(map.background.y)}
              min={-5000}
              max={5000}
              onCommit={(y) => patch((m) => ({ ...m, background: { ...m.background, y } }))}
            />
          </div>
        )}
      </Section>

      <FogSection map={map} onChange={onChange} />
    </MapPanel>
  )
}

function resize(m: GameMap, cols: number, rows: number): GameMap {
  let revealed = ''
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      revealed += c < m.cols && r < m.rows ? (m.fog.revealed[r * m.cols + c] ?? '0') : '0'
  return { ...m, cols, rows, fog: { ...m.fog, revealed } }
}

export function FogSection({ map, onChange }: { map: GameMap; onChange: MapChange }) {
  const t = useT()
  const label = t.maps.settingsSaved
  return (
    <Section title={t.maps.fog}>
      <CheckboxField
        label={t.maps.fogEnabled}
        checked={map.fog.enabled}
        onChange={(enabled) => onChange((m) => ({ ...m, fog: { ...m.fog, enabled } }), label)}
      />
      {map.fog.enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                onChange(
                  (m) => ({ ...m, fog: { ...m.fog, revealed: fillFog(m, true) } }),
                  t.maps.fogRevealed,
                )
              }
            >
              {t.maps.fogRevealAll}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                onChange(
                  (m) => ({ ...m, fog: { ...m.fog, revealed: fillFog(m, false) } }),
                  t.maps.fogHidden,
                )
              }
            >
              {t.maps.fogHideAll}
            </Button>
          </div>
          <CheckboxField
            label={t.maps.autoReveal}
            checked={map.vision.autoReveal}
            onChange={(autoReveal) =>
              onChange((m) => ({ ...m, vision: { ...m.vision, autoReveal } }), label)
            }
          />
          {map.vision.autoReveal && (
            <>
              <NumberInput
                label={t.maps.visionRadius}
                value={map.vision.radius}
                min={1}
                max={50}
                onCommit={(radius) =>
                  onChange((m) => ({ ...m, vision: { ...m.vision, radius } }), label)
                }
              />
              <CheckboxField
                label={t.maps.wallsBlockSight}
                checked={map.vision.wallsBlockSight}
                onChange={(wallsBlockSight) =>
                  onChange((m) => ({ ...m, vision: { ...m.vision, wallsBlockSight } }), label)
                }
              />
            </>
          )}
        </>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Selected element (editor and play)
// ---------------------------------------------------------------------------

export function ElementPanel({
  map,
  element,
  mode,
  onChange,
}: {
  map: GameMap
  element: MapElement
  mode: 'edit' | 'play'
  onChange: MapChange
}) {
  const t = useT()
  const label = t.maps.elementChanged
  const close = () => useMapViewStore.getState().select({ type: 'none' })
  const patch = (p: Partial<MapElement>, l = label) =>
    onChange(
      (m) => ({
        ...m,
        elements: m.elements.map((e) => (e.id === element.id ? { ...e, ...p } : e)),
      }),
      l,
    )

  return (
    <MapPanel title={element.label || t.maps.kinds[element.kind]} onClose={close}>
      {mode === 'edit' && (
        <Section title={t.maps.element}>
          <CommitInput
            label={t.maps.label}
            value={element.label}
            onCommit={(v) => patch({ label: v })}
          />
          <div className="grid grid-cols-3 gap-2">
            <NumberInput
              label={t.maps.width}
              value={element.w}
              min={1}
              max={20}
              onCommit={(w) => patch({ w })}
            />
            <NumberInput
              label={t.maps.height}
              value={element.h}
              min={1}
              max={20}
              onCommit={(h) => patch({ h })}
            />
            <NumberInput
              label={t.maps.rotation}
              value={element.rotation}
              min={0}
              max={359}
              onCommit={(rotation) => patch({ rotation })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<RotateCw />}
              onClick={() => patch({ rotation: (element.rotation + 90) % 360 })}
            >
              {t.maps.rotate}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash />}
              onClick={() => {
                onChange(
                  (m) => ({ ...m, elements: m.elements.filter((e) => e.id !== element.id) }),
                  t.maps.elementDeleted,
                )
                close()
              }}
            >
              {t.maps.deleteElement}
            </Button>
          </div>
        </Section>
      )}
      {element.layer !== 'gm' && (
        <CheckboxField
          label={t.maps.hidden}
          checked={element.hidden}
          onChange={(hidden) => patch({ hidden }, hidden ? t.maps.hide : t.maps.reveal)}
        />
      )}
      {element.chest && (
        <ChestSection map={map} element={element} mode={mode} onChange={onChange} />
      )}
      {element.trap && <TrapSection map={map} element={element} mode={mode} patch={patch} />}
      {element.lever && (
        <Button
          onClick={() =>
            patch(
              { lever: { on: !element.lever!.on } },
              t.maps.leverToggled(element.label || t.maps.lever),
            )
          }
        >
          {t.maps.lever} : {element.lever.on ? t.maps.leverOn : t.maps.leverOff}
        </Button>
      )}
      {element.link && <LinkSection map={map} element={element} mode={mode} patch={patch} />}
      {element.npc && <NpcSection element={element} mode={mode} patch={patch} />}
      {element.note && (
        <CommitTextArea
          label={t.maps.noteText}
          value={element.note.text}
          onCommit={(text) => patch({ note: { text } })}
        />
      )}
    </MapPanel>
  )
}

function ChestSection({
  map,
  element,
  mode,
  onChange,
}: {
  map: GameMap
  element: MapElement
  mode: 'edit' | 'play'
  onChange: MapChange
}) {
  const t = useT()
  const characters = useCampaignStore((s) => s.entities)
  const update = useCampaignStore((s) => s.updateEntity)
  const [editing, setEditing] = useState<Item | null>(null)
  const items = element.chest!.items
  const people = map.tokens.map((tk) => characters[tk.entityId]).filter((e) => e !== undefined)
  const [target, setTarget] = useState('')
  const who = people.find((p) => p!.id === target) ?? people[0]
  const setItems = (next: Item[], l: string) =>
    onChange(
      (m) => ({
        ...m,
        elements: m.elements.map((e) =>
          e.id === element.id ? { ...e, chest: { ...e.chest!, items: next } } : e,
        ),
      }),
      l,
    )

  return (
    <Section title={t.maps.chestItems}>
      {mode === 'play' && (
        <CheckboxField
          label={t.maps.chestOpen}
          checked={element.chest!.opened}
          onChange={(opened) =>
            onChange(
              (m) => ({
                ...m,
                elements: m.elements.map((e) =>
                  e.id === element.id ? { ...e, chest: { ...e.chest!, opened } } : e,
                ),
              }),
              t.maps.elementChanged,
            )
          }
        />
      )}
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.maps.chestEmpty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {item.name}
                {item.quantity > 1 && (
                  <span className="tabular ml-1 text-ink-muted">×{item.quantity}</span>
                )}
              </span>
              {mode === 'play' && who && (
                <IconButton
                  size="sm"
                  label={`${t.maps.takeItem} ${entityName(who)} : ${item.name}`}
                  icon={<Gift />}
                  onClick={() => {
                    const name = entityName(who)
                    campaignHistory.getState().transaction(t.maps.taken(item.name, name), () => {
                      setItems(
                        items.filter((i) => i.id !== item.id),
                        t.maps.taken(item.name, name),
                      )
                      update(
                        who.id,
                        (e) =>
                          withJournal(
                            {
                              ...e,
                              inventory: [
                                ...e.inventory,
                                { ...item, id: crypto.randomUUID(), slot: null },
                              ],
                            },
                            'item',
                            t.journal.itemAdded(item.name, item.quantity),
                          ),
                        t.maps.taken(item.name, name),
                      )
                    })
                    toast.success(t.maps.taken(item.name, name))
                  }}
                />
              )}
              <IconButton
                size="sm"
                label={`${t.common.remove} : ${item.name}`}
                icon={<Trash />}
                onClick={() =>
                  setItems(
                    items.filter((i) => i.id !== item.id),
                    t.maps.elementChanged,
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {mode === 'play' && people.length > 0 && (
        <SelectField<string>
          label={t.maps.takeItem}
          value={who?.id ?? ''}
          onChange={setTarget}
          options={people.map((p) => ({ value: p!.id, label: entityName(p!) }))}
        />
      )}
      <Button size="sm" icon={<Plus />} onClick={() => setEditing(newItem({ name: '' }))}>
        {t.maps.addItem}
      </Button>
      <ItemDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          setItems([...items, item], t.maps.elementChanged)
          setEditing(null)
        }}
      />
    </Section>
  )
}

function TrapSection({
  map,
  element,
  mode,
  patch,
}: {
  map: GameMap
  element: MapElement
  mode: 'edit' | 'play'
  patch: (p: Partial<MapElement>, label?: string) => void
}) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useMapActions()
  const trap = element.trap!
  const [error, setError] = useState<string | null>(null)
  const conditions = allConditionTemplates(campaign.library.conditions)
  const setTrap = (p: Partial<typeof trap>, l?: string) => patch({ trap: { ...trap, ...p } }, l)
  return (
    <Section title={t.maps.trapEffect}>
      <NumberInput
        label={t.maps.trapDifficulty}
        value={trap.difficulty}
        min={0}
        max={20}
        onCommit={(difficulty) => setTrap({ difficulty })}
      />
      <SelectField<typeof trap.effect.kind>
        label={t.maps.trapEffect}
        value={trap.effect.kind}
        onChange={(kind) => setTrap({ effect: { ...trap.effect, kind } })}
        options={(['none', 'damage', 'condition'] as const).map((k) => ({
          value: k,
          label: t.maps.trapEffectKinds[k],
        }))}
      />
      {trap.effect.kind === 'damage' && (
        <CommitInput
          label={t.maps.trapExpression}
          value={trap.effect.expression}
          error={error}
          inputClassName="font-mono"
          onCommit={(expression) => {
            try {
              if (expression) validateDice(expression)
              setError(null)
              setTrap({ effect: { ...trap.effect, expression } })
            } catch (e) {
              setError(diceErrorMessage(t, e))
            }
          }}
        />
      )}
      {trap.effect.kind === 'condition' && (
        <SelectField<string>
          label={t.maps.trapCondition}
          value={trap.effect.conditionId ?? ''}
          onChange={(conditionId) =>
            setTrap({ effect: { ...trap.effect, conditionId: conditionId || null } })
          }
          options={[
            { value: '', label: t.common.none },
            ...conditions.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      )}
      <CheckboxField
        label={t.maps.trapDetected}
        checked={trap.detected}
        onChange={(detected) => setTrap({ detected })}
      />
      {mode === 'play' && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => actions.groupPerception(map.id)}
            title={t.maps.perceptionHint}
          >
            {t.maps.perception}
          </Button>
          {!trap.triggered ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => actions.triggerTrap(map.id, element.id)}
            >
              {t.maps.trigger}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setTrap({ triggered: false }, t.maps.rearmed)}>
              {t.maps.rearm}
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}

function LinkSection({
  map,
  element,
  mode,
  patch,
}: {
  map: GameMap
  element: MapElement
  mode: 'edit' | 'play'
  patch: (p: Partial<MapElement>, label?: string) => void
}) {
  const t = useT()
  const maps = useCampaignStore((s) => s.maps)
  const updatePlay = useCampaignStore((s) => s.updatePlay)
  const target = element.link!.mapId ? maps[element.link!.mapId] : undefined
  return (
    <Section title={t.maps.linkTarget}>
      <SelectField<string>
        label={t.maps.linkTarget}
        value={element.link!.mapId ?? ''}
        onChange={(mapId) => patch({ link: { mapId: mapId || null } })}
        options={[
          { value: '', label: t.maps.noTarget },
          ...Object.values(maps)
            .filter((m) => m.id !== map.id)
            .map((m) => ({ value: m.id, label: m.name })),
        ]}
      />
      {mode === 'play' && target && (
        <Button
          size="sm"
          icon={<ArrowRight />}
          onClick={() => {
            updatePlay((p) => ({ ...p, mapId: target.id }), t.maps.wentTo(target.name))
            useMapViewStore.getState().select({ type: 'none' })
          }}
        >
          {t.maps.goTo}
        </Button>
      )}
    </Section>
  )
}

function NpcSection({
  element,
  mode,
  patch,
}: {
  element: MapElement
  mode: 'edit' | 'play'
  patch: (p: Partial<MapElement>, label?: string) => void
}) {
  const t = useT()
  const entities = useCampaignStore((s) => s.entities)
  const openQuick = useUiStore((s) => s.openQuick)
  const id = element.npc!.entityId
  return (
    <Section title={t.maps.npcEntity}>
      <SelectField<string>
        label={t.maps.npcEntity}
        value={id ?? ''}
        onChange={(entityId) => patch({ npc: { entityId: entityId || null } })}
        options={[
          { value: '', label: t.common.none },
          ...Object.values(entities).map((e) => ({
            value: e.id,
            label: `${entityName(e)} (${t.kinds[e.kind]})`,
          })),
        ]}
      />
      {mode === 'play' && id && entities[id] && (
        <Button size="sm" onClick={() => openQuick(id)}>
          {t.maps.openNpc}
        </Button>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Walls & doors
// ---------------------------------------------------------------------------

export function WallPanel({
  map,
  wall,
  mode,
  onChange,
}: {
  map: GameMap
  wall: Wall
  mode: 'edit' | 'play'
  onChange: MapChange
}) {
  const t = useT()
  const actions = useMapActions()
  const entities = useCampaignStore((s) => s.entities)
  const close = () => useMapViewStore.getState().select({ type: 'none' })
  const door = wall.door
  const people = map.tokens.map((tk) => entities[tk.entityId]).filter((e) => e !== undefined)
  const [picker, setPicker] = useState('')
  const who = people.find((p) => p!.id === picker) ?? people[0]
  const setDoor = (p: Partial<NonNullable<Wall['door']>>, l: string) =>
    onChange(
      (m) => ({
        ...m,
        walls: m.walls.map((w) =>
          w.id === wall.id && w.door ? { ...w, door: { ...w.door, ...p } } : w,
        ),
      }),
      l,
    )
  return (
    <MapPanel title={door ? t.maps.door : t.maps.wall} onClose={close}>
      {door && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => actions.toggleDoor(map.id, wall.id)}
              disabled={door.locked && !door.open}
            >
              {door.open ? t.maps.closeDoor : t.maps.openDoor}
            </Button>
            <Button size="sm" onClick={() => actions.setDoorLock(map.id, wall.id, !door.locked)}>
              {door.locked ? t.maps.unlock : t.maps.lock}
            </Button>
          </div>
          <NumberInput
            label={t.maps.doorDifficulty}
            value={door.difficulty}
            min={0}
            max={20}
            onCommit={(difficulty) => setDoor({ difficulty }, t.maps.elementChanged)}
          />
          {mode === 'play' && door.locked && who && (
            <div className="flex items-end gap-2">
              <SelectField<string>
                label={t.maps.picker}
                value={who.id}
                onChange={setPicker}
                options={people.map((p) => ({ value: p!.id, label: entityName(p!) }))}
                className="min-w-0 flex-1"
              />
              <Button size="md" onClick={() => actions.pickLock(map.id, wall.id, who.id)}>
                {t.maps.pickLock}
              </Button>
            </div>
          )}
        </>
      )}
      {mode === 'edit' && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash />}
          onClick={() => {
            onChange(
              (m) => ({ ...m, walls: m.walls.filter((w) => w.id !== wall.id) }),
              t.maps.wallDeleted,
            )
            close()
          }}
        >
          {t.maps.deleteWall}
        </Button>
      )}
    </MapPanel>
  )
}

// ---------------------------------------------------------------------------
// Area of effect (play)
// ---------------------------------------------------------------------------

export function AreaPanel({ map, area }: { map: GameMap; area: AreaShape }) {
  const t = useT()
  const campaign = useCampaign()
  const actions = useMapActions()
  const entities = useCampaignStore((s) => s.entities)
  const targets = actions.areaTargets(map.id, area).filter((id) => entities[id])
  const [excluded, setExcluded] = useState<string[]>([])
  const chosen = targets.filter((id) => !excluded.includes(id))
  const [kind, setKind] = useState<'damage' | 'heal'>('damage')
  const [expression, setExpression] = useState('')
  const [save, setSave] = useState<StatKey | 'none'>('none')
  const [error, setError] = useState<string | null>(null)
  const [conditionId, setConditionId] = useState('')
  const [checkStat, setCheckStat] = useState<StatKey>('dexterity')
  const conditions = allConditionTemplates(campaign.library.conditions)
  const statOptions = STAT_KEYS.map((k) => ({ value: k, label: t.stats.names[k] }))
  const close = () => useMapViewStore.getState().setArea(null)

  return (
    <MapPanel title={`${t.maps.area} — ${t.maps.areaTargets(chosen.length)}`} onClose={close}>
      {targets.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.maps.areaNone}</p>
      ) : (
        <ul className="space-y-1">
          {targets.map((id) => (
            <li key={id}>
              <CheckboxField
                label={entityName(entities[id]!)}
                checked={!excluded.includes(id)}
                onChange={(on) => setExcluded((x) => (on ? x.filter((i) => i !== id) : [...x, id]))}
              />
            </li>
          ))}
        </ul>
      )}
      <Section title={t.maps.areaDamage + ' / ' + t.maps.areaHeal}>
        <SegmentedControl<'damage' | 'heal'>
          label={t.maps.areaDamage}
          size="sm"
          value={kind}
          onValueChange={setKind}
          options={[
            { value: 'damage', label: t.maps.areaDamage },
            { value: 'heal', label: t.maps.areaHeal },
          ]}
        />
        <TextField
          label={t.maps.areaExpression}
          value={expression}
          placeholder="3d6"
          error={error}
          inputClassName="font-mono"
          onChange={(e) => {
            setExpression(e.target.value)
            setError(null)
          }}
        />
        {kind === 'damage' && (
          <SelectField<StatKey | 'none'>
            label={t.maps.areaSaveStat}
            value={save}
            onChange={setSave}
            options={[{ value: 'none', label: t.maps.areaNoSave }, ...statOptions]}
          />
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!chosen.length || !expression.trim()}
          onClick={() => {
            try {
              validateDice(expression)
            } catch (e) {
              return setError(diceErrorMessage(t, e))
            }
            actions.areaHp(chosen, {
              kind,
              expression,
              save: kind === 'damage' && save !== 'none' ? save : null,
              label: t.maps.areaLabel,
            })
          }}
        >
          {t.maps.areaApply}
        </Button>
      </Section>
      {conditions.length > 0 && (
        <Section title={t.maps.areaCondition}>
          <div className="flex items-end gap-2">
            <SelectField<string>
              label={t.maps.areaCondition}
              hideLabel
              value={conditionId || conditions[0]!.id}
              onChange={setConditionId}
              options={conditions.map((c) => ({ value: c.id, label: c.name }))}
              className="min-w-0 flex-1"
            />
            <Button
              size="md"
              disabled={!chosen.length}
              onClick={() => actions.applyCondition(chosen, conditionId || conditions[0]!.id)}
            >
              {t.maps.areaApply}
            </Button>
          </div>
        </Section>
      )}
      <Section title={t.maps.areaCheck}>
        <div className="flex items-end gap-2">
          <SelectField<StatKey>
            label={t.maps.areaCheck}
            hideLabel
            value={checkStat}
            onChange={setCheckStat}
            options={statOptions}
            className="min-w-0 flex-1"
          />
          <Button
            size="md"
            disabled={!chosen.length}
            onClick={() => actions.areaCheck(chosen, checkStat)}
          >
            {t.dice.roll}
          </Button>
        </div>
      </Section>
      <Button variant="ghost" size="sm" onClick={close}>
        {t.maps.areaClose}
      </Button>
    </MapPanel>
  )
}
