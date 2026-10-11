import { useParams } from 'react-router'
import { Ornament } from '@/components/Brand'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import type { PrepSection } from '@/stores/uiStore'
import { DashboardPage } from './DashboardPage'
import { SECTION_ICONS, sectionLabel } from './sections'

/** Routes each prep section to its page. Sections not built yet show an informative empty state. */
export function PrepSectionPage() {
  const t = useT()
  const section = useParams().section as PrepSection

  if (section === 'dashboard') return <DashboardPage />

  const Icon = SECTION_ICONS[section]
  const copy = t.sections[section]
  return (
    <PageTransition key={section} className="px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">{sectionLabel(t, section)}</h1>
      <Ornament className="my-6 max-w-sm" />
      <EmptyState icon={<Icon />} title={copy.emptyTitle} body={copy.emptyBody} />
    </PageTransition>
  )
}
