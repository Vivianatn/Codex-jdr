import { useLiveQuery } from 'dexie-react-hooks'
import { Monitor, Play, Wifi } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CandleOrnament } from '@/components/Brand'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/fields'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { sessionRepository } from '@/db/sessions'
import type { PlayMode } from '@/domain/sessions'
import { createLiveActions } from '@/features/game/liveActions'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'

const FREE = '__free__'

/** Play starts by hand (D-244): pick a session plan (or none) and a mode. */
export function StartPlayPanel() {
  const t = useT()
  const campaign = useCampaign()
  const [params] = useSearchParams()
  const plans = useLiveQuery(() => sessionRepository.listPlans(campaign.id), [campaign.id])
  const online = useOnlineStore((s) => s.role !== 'offline')
  const [planId, setPlanId] = useState<string>(params.get('session') ?? FREE)
  const [mode, setMode] = useState<PlayMode>(online ? 'online' : 'local')
  const [busy, setBusy] = useState(false)
  const actions = useMemo(() => createLiveActions(t, campaign), [t, campaign])
  const chosen = plans?.some((p) => p.id === planId) ? planId : FREE

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-bg p-6">
      <div
        className="w-full max-w-lg space-y-5 rounded-[20px] border border-line bg-surface-raised p-6 shadow-overlay"
        data-testid="start-play"
      >
        <div className="flex flex-col items-center text-center">
          <CandleOrnament className="h-20" />
          <h1 className="mt-2 type-screen-title text-[1.75rem] text-ink">
            {t.sessions.startTitle}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{t.sessions.startBody}</p>
        </div>
        <SelectField<string>
          label={t.sessions.startPlan}
          value={chosen}
          onChange={setPlanId}
          options={[
            { value: FREE, label: t.sessions.startFree },
            ...(plans ?? []).map((p) => ({ value: p.id, label: p.title })),
          ]}
        />
        <div className="space-y-1.5">
          <p className="text-[0.8125rem] font-semibold text-ink">{t.sessions.startMode}</p>
          <SegmentedControl<PlayMode>
            label={t.sessions.startMode}
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'local', label: t.sessions.modeLocal, icon: <Monitor /> },
              { value: 'online', label: t.sessions.modeOnline, icon: <Wifi /> },
            ]}
          />
          <p className="text-xs text-ink-muted">
            {mode === 'local'
              ? t.sessions.modeLocalHint
              : online
                ? t.sessions.modeOnlineHint
                : t.sessions.modeOnlineNeedsHost}
          </p>
        </div>
        <Button
          variant="primary"
          className="w-full"
          icon={<Play />}
          disabled={busy || (mode === 'online' && !online)}
          onClick={async () => {
            setBusy(true)
            try {
              await actions.start({ planId: chosen === FREE ? null : chosen, mode })
              toast.success(t.sessions.started)
            } catch (error) {
              console.error(error)
              toast.error(t.errors.generic)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? t.sessions.starting : t.sessions.start}
        </Button>
      </div>
    </div>
  )
}
