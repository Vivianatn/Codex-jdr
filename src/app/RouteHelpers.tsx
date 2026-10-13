import { Navigate, useParams, useRouteError } from 'react-router'
import { useT } from '@/i18n'
import { useUiStore } from '@/stores/uiStore'
import { CreationWizard } from './screens'

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
