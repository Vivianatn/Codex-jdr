import { lazy, Suspense } from 'react'
import { Navigate, useParams, useRouteError } from 'react-router'
import { CreationWizard } from '@/features/characters/wizard/CreationWizard'
import { useT } from '@/i18n'
import { useUiStore } from '@/stores/uiStore'

/** /c/:id and /c/:id/prep land on the last prep section visited for that campaign. */
export function ResumePrep() {
  const { campaignId = '' } = useParams()
  const section = useUiStore((s) => s.lastPrepSection[campaignId] ?? 'dashboard')
  return <Navigate to={`/c/${campaignId}/prep/${section}`} replace />
}

export function RouteError() {
  const t = useT()
  const error = useRouteError()
  console.error(error)
  return (
    <div role="alert" className="flex h-full items-center justify-center p-8 text-ink-muted">
      {t.errors.generic}
    </div>
  )
}

export function WizardRoute() {
  const { section = '' } = useParams()
  return <CreationWizard section={section} />
}

// The map screens carry Konva: they load on demand.
const MapEditorPage = lazy(() =>
  import('@/features/maps/MapEditorPage').then((m) => ({ default: m.MapEditorPage })),
)
const PlayerView = lazy(() =>
  import('@/features/maps/PlayerView').then((m) => ({ default: m.PlayerView })),
)

export function MapEditorRoute() {
  return (
    <Suspense fallback={null}>
      <MapEditorPage />
    </Suspense>
  )
}

export function PlayerViewRoute() {
  return (
    <Suspense fallback={null}>
      <PlayerView />
    </Suspense>
  )
}
